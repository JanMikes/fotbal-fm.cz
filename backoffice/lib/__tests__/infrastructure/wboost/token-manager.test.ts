import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Dynamic imports AFTER stubs
const { WboostTokenManager } = await import('@/lib/infrastructure/wboost/token-manager');
const { AppError, NetworkError } = await import('@/lib/core/errors');

function makeManager() {
  return new WboostTokenManager({
    apiBase: 'http://wboost.test',
    clientId: 'cid',
    clientSecret: 'csecret',
  });
}

function mockTokenResponse(expiresIn = 3600, token = 'tok123') {
  const body = { access_token: token, expires_in: expiresIn, token_type: 'Bearer' };
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

/** Build a fake JWT whose payload carries the given `exp` (seconds since epoch). */
function makeJwt(expSeconds: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ exp: expSeconds })}.sig`;
}

describe('WboostTokenManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches a token on first call', async () => {
    mockFetch.mockResolvedValueOnce(mockTokenResponse());

    const mgr = makeManager();
    const token = await mgr.getToken();

    expect(token).toBe('tok123');
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://wboost.test/api/token');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.body).toContain('grant_type=client_credentials');
    expect(init.body).toContain('client_id=cid');
    expect(init.body).toContain('client_secret=csecret');
  });

  it('returns cached token on second call within TTL', async () => {
    mockFetch.mockResolvedValueOnce(mockTokenResponse(3600, 'cached-tok'));

    const mgr = makeManager();
    const t1 = await mgr.getToken();
    const t2 = await mgr.getToken();

    expect(t1).toBe('cached-tok');
    expect(t2).toBe('cached-tok');
    expect(mockFetch).toHaveBeenCalledOnce(); // only one network call
  });

  it('refetches after expiry (token past expiresAt)', async () => {
    // First call: returns token with very short TTL
    mockFetch.mockResolvedValueOnce(mockTokenResponse(1, 'first-tok'));
    // Second call: returns fresh token
    mockFetch.mockResolvedValueOnce(mockTokenResponse(3600, 'second-tok'));

    const mgr = makeManager();
    await mgr.getToken(); // caches first token, expiresAt = now + 0.9s

    // Fast-forward Date.now to after expiry
    const realNow = Date.now();
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(realNow + 2000); // 2 seconds later

    const t2 = await mgr.getToken();
    expect(t2).toBe('second-tok');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    dateSpy.mockRestore();
  });

  it('invalidate() forces a new fetch on next getToken()', async () => {
    mockFetch.mockResolvedValueOnce(mockTokenResponse(3600, 'first'));
    mockFetch.mockResolvedValueOnce(mockTokenResponse(3600, 'second'));

    const mgr = makeManager();
    await mgr.getToken();
    mgr.invalidate();
    const t2 = await mgr.getToken();

    expect(t2).toBe('second');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('uses the JWT exp claim for expiry, not expires_in', async () => {
    // expires_in says 1s, but the JWT exp is an hour out → should still cache.
    const jwt = makeJwt(Math.floor(Date.now() / 1000) + 3600);
    mockFetch.mockResolvedValueOnce(mockTokenResponse(1, jwt));

    const mgr = makeManager();
    const t1 = await mgr.getToken();
    const t2 = await mgr.getToken();

    expect(t1).toBe(jwt);
    expect(t2).toBe(jwt);
    expect(mockFetch).toHaveBeenCalledOnce(); // cached via JWT exp despite expires_in=1
  });

  it('refreshes when the JWT exp is within the skew window', async () => {
    // exp only 30s away → inside the 60s refresh skew → treated as expired.
    const soon = makeJwt(Math.floor(Date.now() / 1000) + 30);
    mockFetch.mockResolvedValueOnce(mockTokenResponse(3600, soon));
    mockFetch.mockResolvedValueOnce(mockTokenResponse(3600, makeJwt(Math.floor(Date.now() / 1000) + 3600)));

    const mgr = makeManager();
    await mgr.getToken();
    await mgr.getToken();

    expect(mockFetch).toHaveBeenCalledTimes(2); // refetched because exp was imminent
  });

  it('dedupes concurrent getToken() calls into a single fetch', async () => {
    mockFetch.mockResolvedValueOnce(mockTokenResponse(3600, 'shared'));

    const mgr = makeManager();
    const [a, b, c] = await Promise.all([mgr.getToken(), mgr.getToken(), mgr.getToken()]);

    expect([a, b, c]).toEqual(['shared', 'shared', 'shared']);
    expect(mockFetch).toHaveBeenCalledOnce(); // thundering herd avoided
  });

  it('maps 401 response to AppError UNAUTHORIZED', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'invalid_client' }),
      text: () => Promise.resolve('invalid_client'),
    });

    const mgr = makeManager();

    try {
      await mgr.getToken();
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      const appErr = e as InstanceType<typeof AppError>;
      expect(appErr.statusCode).toBe(401);
      expect(appErr.code).toBe('UNAUTHORIZED');
    }
  });

  it('throws NetworkError when fetch itself fails', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    const mgr = makeManager();
    await expect(mgr.getToken()).rejects.toBeInstanceOf(NetworkError);
  });

  it('surfaces the raw body + content-type when a 200 response is not JSON', async () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      text: () => Promise.resolve('<html><body>Service Unavailable</body></html>'),
    });

    const mgr = makeManager();
    try {
      await mgr.getToken();
      expect.unreachable('should have thrown');
    } catch (e) {
      const appErr = e as InstanceType<typeof AppError>;
      expect(appErr).toBeInstanceOf(AppError);
      expect(appErr.statusCode).toBe(502);
      expect(appErr.message).toContain('Service Unavailable'); // raw body reaches the UI
      expect(appErr.message).toContain('text/html'); // content-type included
    }
    expect(consoleErr).toHaveBeenCalled(); // also logged to stdout
    consoleErr.mockRestore();
  });

  it('throws a clear error (with body) when the token JSON has no access_token', async () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: () => Promise.resolve(JSON.stringify({ error: 'invalid_client' })),
    });

    const mgr = makeManager();
    await expect(mgr.getToken()).rejects.toThrow(/access_token/);
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });
});
