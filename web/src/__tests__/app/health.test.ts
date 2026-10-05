import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// U14: /api/health is a readiness latch — 503 until one real render of / succeeds, then a cheap
// 200 that never renders again.

const mockFetch = vi.fn();

function page(status: number, body: string) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}
const RENDERED = '<!DOCTYPE html><html><body><header class="fixed">…</header><main>…</main></body></html>';

let GET: () => Promise<Response>;

beforeEach(async () => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.resetModules(); // fresh latch per test
  ({ GET } = await import('@/app/api/health/route'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/health (readiness latch)', () => {
  it('renders / once (following the redirect) and opens on a 200 with the site header', async () => {
    mockFetch.mockResolvedValueOnce(page(200, RENDERED));

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3000/');
    expect(init).toMatchObject({ redirect: 'follow', cache: 'no-store' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('stays 503 while the render fails, and retries on the next probe', async () => {
    mockFetch
      .mockResolvedValueOnce(page(500, 'Internal Server Error'))
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce(page(200, RENDERED));

    expect((await GET()).status).toBe(503);
    expect((await GET()).status).toBe(503);
    expect((await GET()).status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('a 200 without the header marker (not a real page) does not open the latch', async () => {
    mockFetch.mockResolvedValueOnce(page(200, '{"status":"ok"}'));

    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'warming' });
  });

  it('a 404 page (it has a header too) does not open the latch', async () => {
    mockFetch.mockResolvedValueOnce(page(404, RENDERED));
    expect((await GET()).status).toBe(503);
  });

  it('once open, it answers 200 without rendering again — even if rendering would now fail', async () => {
    mockFetch.mockResolvedValueOnce(page(200, RENDERED));
    await GET();
    mockFetch.mockRejectedValue(new Error('would time out under load'));

    for (let i = 0; i < 5; i++) expect((await GET()).status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('concurrent probes share one smoke render', async () => {
    let release!: (value: unknown) => void;
    mockFetch.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));

    const probes = [GET(), GET(), GET()];
    release(page(200, RENDERED));
    const statuses = (await Promise.all(probes)).map((r) => r.status);

    expect(statuses).toEqual([200, 200, 200]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('is never prerendered at build time', async () => {
    const route = await import('@/app/api/health/route');
    expect(route.dynamic).toBe('force-dynamic');
  });
});
