import { describe, it, expect, vi, beforeAll } from 'vitest';

// The web's Prometheus endpoint (lily D75 Phase 1). D-V2: the 401/403 series of
// fotbalfm_strapi_requests_total exist at 0 from startup, so the first rejection is an increase
// FotbalFmStrapiAuthErrors can see (a counter child born at 1 is invisible to increase()).

const PORT = 19_000 + Math.floor(Math.random() * 900);
process.env.METRICS_PORT = String(PORT);

vi.mock('@fotbal-fm/cache', async (importActual) => ({
  ...(await importActual<typeof import('@fotbal-fm/cache')>()),
  getRedisClient: vi.fn(async () => null), // no Redis: no transport hash to read
}));

const { metrics } = await import('@fotbal-fm/cache');
const { STRAPI_READ_ENDPOINTS } = await import('@/lib/strapi/auth-probe');
const { startMetricsServer } = await import('@/lib/metrics-server');

async function scrape(): Promise<string> {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/metrics`);
      if (res.ok) return await res.text();
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('metrics server did not answer');
}

const value = (body: string, series: string): number | undefined => {
  const line = body.split('\n').find((l) => l.startsWith(`${series} `));
  return line === undefined ? undefined : Number(line.split(' ')[1]);
};

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  startMetricsServer();
});

describe('metrics server', () => {
  it('D-V2: exposes fotbalfm_strapi_requests_total{status="401"|"403"} = 0 for every type the site reads, before any request', async () => {
    const body = await scrape();
    const types = new Set(STRAPI_READ_ENDPOINTS.map((e) => e.split('/')[0]));
    expect(types.size).toBe(STRAPI_READ_ENDPOINTS.length);
    for (const type of types) {
      for (const status of ['401', '403']) {
        expect(value(body, `fotbalfm_strapi_requests_total{type="${type}",status="${status}"}`)).toBe(0);
      }
    }
    expect(body).not.toMatch(/fotbalfm_strapi_requests_total\{[^}]*status="200"/); // only the auth series are pre-created
  });

  it('counts a rejection on top of the pre-created series, and other statuses as they happen', async () => {
    metrics.strapiRequest('matches', '401', 0.05);
    metrics.strapiRequest('matches', '200', 0.05);
    const body = await scrape();
    expect(value(body, 'fotbalfm_strapi_requests_total{type="matches",status="401"}')).toBe(1);
    expect(value(body, 'fotbalfm_strapi_requests_total{type="matches",status="200"}')).toBe(1);
    expect(value(body, 'fotbalfm_strapi_requests_total{type="pages",status="403"}')).toBe(0);
  });

  it('without a transport heartbeat in Redis the heartbeat gauge reads 0 — "never", which FotbalFmCacheTransportStale treats as stale', async () => {
    // A label-less gauge is never absent: after reset() it exports 0. The alert's `time() - max(...) > 300`
    // therefore fires when the transport hash is missing; its absent() clause covers a missing series.
    const body = await scrape();
    expect(value(body, 'fotbalfm_cache_transport_heartbeat_timestamp_seconds')).toBe(0);
  });
});
