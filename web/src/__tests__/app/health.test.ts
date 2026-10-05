import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// U14: /api/health is a readiness latch — 503 until one real render of / succeeds AND Strapi
// accepts the API token for every endpoint the site reads (P0-V11), then a cheap 200 that never
// checks anything again.

vi.mock('@/lib/config', () => ({
  config: { strapi: { url: 'http://strapi:1337', apiToken: 'test-token' } },
}));

const smoke = vi.fn();
const strapiStatus = new Map<string, number | 'down'>(); // endpoint -> status (default 200)
const strapiCalls: string[] = [];

function page(status: number, body: string) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}
const RENDERED = '<!DOCTYPE html><html><body><header class="fixed">…</header><main>…</main></body></html>';

const mockFetch = vi.fn(async (url: string, _init?: RequestInit) => {
  if (url.startsWith('http://127.0.0.1:3000')) return smoke(url);
  const endpoint = url.replace('http://strapi:1337/api/', '').split('?')[0];
  strapiCalls.push(endpoint);
  const status = strapiStatus.get(endpoint) ?? 200;
  if (status === 'down') throw new TypeError('fetch failed');
  return { ok: status < 300, status };
});

let GET: () => Promise<Response>;

beforeEach(async () => {
  vi.stubGlobal('fetch', mockFetch);
  smoke.mockReset();
  mockFetch.mockClear();
  strapiStatus.clear();
  strapiCalls.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.resetModules(); // fresh latch per test
  ({ GET } = await import('@/app/api/health/route'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/health (readiness latch)', () => {
  it('renders / once (following the redirect) and opens on a 200 with the site header', async () => {
    smoke.mockResolvedValueOnce(page(200, RENDERED));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    const [url, init] = mockFetch.mock.calls.find(([u]) => u.startsWith('http://127.0.0.1'))!;
    expect(url).toBe('http://127.0.0.1:3000/');
    expect(init).toMatchObject({ redirect: 'follow', cache: 'no-store' });
  });

  it('stays 503 while the render fails, and retries on the next probe', async () => {
    smoke
      .mockResolvedValueOnce(page(500, 'Internal Server Error'))
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce(page(200, RENDERED));

    expect((await GET()).status).toBe(503);
    expect((await GET()).status).toBe(503);
    expect((await GET()).status).toBe(200);
    expect(smoke).toHaveBeenCalledTimes(3);
  });

  it('a 200 without the header marker (not a real page) does not open the latch', async () => {
    smoke.mockResolvedValueOnce(page(200, '{"status":"ok"}'));

    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'warming' });
  });

  it('a 404 page (it has a header too) does not open the latch', async () => {
    smoke.mockResolvedValueOnce(page(404, RENDERED));
    expect((await GET()).status).toBe(503);
  });

  it('once open, it answers 200 without rendering or asking Strapi again', async () => {
    smoke.mockResolvedValueOnce(page(200, RENDERED));
    await GET();
    const calls = mockFetch.mock.calls.length;
    smoke.mockRejectedValue(new Error('would time out under load'));
    strapiStatus.set('pages', 401);

    for (let i = 0; i < 5; i++) expect((await GET()).status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(calls);
  });

  it('concurrent probes share one smoke check', async () => {
    let release!: (value: unknown) => void;
    smoke.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));

    const probes = [GET(), GET(), GET()];
    release(page(200, RENDERED));
    const statuses = (await Promise.all(probes)).map((r) => r.status);

    expect(statuses).toEqual([200, 200, 200]);
    expect(smoke).toHaveBeenCalledTimes(1);
  });

  it('is never prerendered at build time', async () => {
    const route = await import('@/app/api/health/route');
    expect(route.dynamic).toBe('force-dynamic');
  });
});

describe('the latch asks Strapi whether it accepts the API token (P0-V11)', () => {
  it('asks every endpoint the site reads, with the token', async () => {
    const { STRAPI_READ_ENDPOINTS } = await import('@/lib/strapi/auth-probe');
    smoke.mockResolvedValueOnce(page(200, RENDERED));

    expect((await GET()).status).toBe(200);
    expect(new Set(strapiCalls)).toEqual(new Set(STRAPI_READ_ENDPOINTS));
    const strapiInit = mockFetch.mock.calls.find(([u]) => u.startsWith('http://strapi'))![1]!;
    expect((strapiInit.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('a 401 keeps the latch closed even though the page rendered (e.g. served from a warm Redis)', async () => {
    smoke.mockResolvedValue(page(200, RENDERED));
    strapiStatus.set('categories', 401);

    expect((await GET()).status).toBe(503);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('REJECTS the API token for categories (401)'));
  });

  it('a 403 on one content type (an under-privileged token) keeps it closed too', async () => {
    smoke.mockResolvedValue(page(200, RENDERED));
    strapiStatus.set('upload/files', 403);

    expect((await GET()).status).toBe(503);
  });

  it('a fixed token opens it on the next probe', async () => {
    smoke.mockResolvedValue(page(200, RENDERED));
    strapiStatus.set('pages', 401);
    expect((await GET()).status).toBe(503);

    strapiStatus.clear();
    expect((await GET()).status).toBe(200);
  });

  it('a Strapi outage (network errors, 5xx, an empty single type) never keeps it closed', async () => {
    smoke.mockResolvedValue(page(200, RENDERED));
    strapiStatus.set('categories', 'down');
    strapiStatus.set('pages', 503);
    strapiStatus.set('footer', 404);

    expect((await GET()).status).toBe(200);
  });
});
