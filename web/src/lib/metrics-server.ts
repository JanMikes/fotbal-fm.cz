import http from 'node:http';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from '@prometheus-io/client';
import { getRedisClient, setMetricsSink, TAGVER, TRANSPORT } from '@fotbal-fm/cache';
import { STRAPI_READ_ENDPOINTS } from '@/lib/strapi/auth-probe';
import { typeLabel } from '@/lib/strapi/type-label';

/*
 * Prometheus endpoint of the web container (lily D75 Phase 1, Contract F: `metrics.scrape`,
 * `metrics.port: 9464` on the `monitoring` network). A separate HTTP server, never routed by
 * Traefik. Started once per process from instrumentation.ts (Node.js runtime only).
 *
 * - fotbalfm_datacache_requests_total{fn,result}     — the data cache's outcome per read
 * - fotbalfm_strapi_requests_total{type,status}       — every Strapi request (status: HTTP code | timeout | network)
 * - fotbalfm_strapi_request_duration_seconds{type}
 * - fotbalfm_cache_tag_generation{tag}                — read from Redis at scrape time
 * - fotbalfm_cache_transport_*                        — Strapi's bump transport, from the hash it heartbeats
 *                                                       into Redis every 30 s (Strapi has no metrics endpoint)
 * - Node.js defaults (event-loop lag percentiles, heap, GC, …)
 */

const PORT = Number(process.env.METRICS_PORT ?? 9464);
const REDIS_READ_TIMEOUT_MS = 1000;

type Snapshot = { gens: Record<string, string>; transport: Record<string, string> } | null;
let snapshot: { at: number; value: Promise<Snapshot> } | null = null;

/** One Redis round trip per scrape, shared by every gauge (bounded: a stalled Redis costs 1 s). */
function readSnapshot(): Promise<Snapshot> {
  if (snapshot && Date.now() - snapshot.at < 1000) return snapshot.value;
  const value = (async (): Promise<Snapshot> => {
    const redis = await getRedisClient();
    if (!redis) return null;
    const read = Promise.all([redis.hgetall(TAGVER), redis.hgetall(TRANSPORT)]);
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), REDIS_READ_TIMEOUT_MS).unref());
    const result = await Promise.race([read, timeout]).catch(() => null);
    return result ? { gens: result[0], transport: result[1] } : null;
  })();
  snapshot = { at: Date.now(), value };
  return value;
}

function seconds(ms: string | undefined): number | null {
  const n = Number(ms);
  return Number.isFinite(n) && n > 0 ? n / 1000 : null;
}

export function startMetricsServer(): void {
  const started = Symbol.for('fotbalfm.metrics.started');
  const holder = globalThis as { [started]?: boolean };
  if (holder[started]) return; // dev reloads, a second instrumentation bundle
  holder[started] = true;

  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const cacheRequests = new Counter({
    name: 'fotbalfm_datacache_requests_total',
    help: 'Data cache reads by data function and outcome (hit, miss, invalidated, soft_stale, budget_exceeded, stale_if_error, fallback, redis_unavailable, …).',
    labelNames: ['fn', 'result'],
    registers: [registry],
  });
  const strapiRequests = new Counter({
    name: 'fotbalfm_strapi_requests_total',
    help: 'Requests from web to Strapi by content type and HTTP status (or timeout/network).',
    labelNames: ['type', 'status'],
    registers: [registry],
  });
  // D-V2: a labelled counter child exists only after its first inc(), so a {status="401"} series
  // would first appear already at ≥1 and increase() would never count that first rejection
  // (FotbalFmStrapiAuthErrors stays silent on a burst). Pre-create the auth-failure series at 0
  // for every type the site reads.
  for (const type of new Set(STRAPI_READ_ENDPOINTS.map(typeLabel))) {
    for (const status of ['401', '403']) strapiRequests.inc({ type, status }, 0);
  }
  const strapiDuration = new Histogram({
    name: 'fotbalfm_strapi_request_duration_seconds',
    help: 'Duration of requests from web to Strapi.',
    labelNames: ['type'],
    buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  new Gauge({
    name: 'fotbalfm_cache_tag_generation',
    help: 'Current generation of each data cache tag (fotbalfm:v2:tagver; Strapi bumps it after every write).',
    labelNames: ['tag'],
    registers: [registry],
    async collect() {
      this.reset();
      const s = await readSnapshot();
      for (const [tag, gen] of Object.entries(s?.gens ?? {})) this.set({ tag }, Number(gen));
    },
  });
  new Gauge({
    name: 'fotbalfm_cache_transport_heartbeat_timestamp_seconds',
    help: "Last heartbeat of Strapi's cache-bump transport (written every 30 s while Strapi runs and reaches Redis).",
    registers: [registry],
    async collect() {
      this.reset();
      const hb = seconds((await readSnapshot())?.transport.hb_at);
      if (hb !== null) this.set(hb);
    },
  });
  new Gauge({
    name: 'fotbalfm_cache_transport_last_bump_timestamp_seconds',
    help: 'When Strapi last bumped cache tags successfully.',
    registers: [registry],
    async collect() {
      this.reset();
      const ok = seconds((await readSnapshot())?.transport.ok_at);
      if (ok !== null) this.set(ok);
    },
  });
  new Gauge({
    name: 'fotbalfm_cache_transport_pending',
    help: "Tags waiting in Strapi's transport at its last heartbeat.",
    registers: [registry],
    async collect() {
      this.reset();
      const t = (await readSnapshot())?.transport;
      if (t?.pending !== undefined) this.set(Number(t.pending));
    },
  });
  new Gauge({
    name: 'fotbalfm_cache_transport_pending_age_seconds',
    help: "Age of the oldest pending bump at Strapi's last heartbeat (0 when none).",
    registers: [registry],
    async collect() {
      this.reset();
      const t = (await readSnapshot())?.transport;
      const oldest = seconds(t?.oldest_pending_at);
      const hb = seconds(t?.hb_at);
      if (t) this.set(oldest !== null && hb !== null ? Math.max(0, hb - oldest) : 0);
    },
  });
  new Counter({
    name: 'fotbalfm_cache_transport_failures_total',
    help: "Failed tag-bump flushes of Strapi's transport since Strapi started (from its heartbeat).",
    registers: [registry],
    async collect() {
      this.reset();
      const failures = Number((await readSnapshot())?.transport.fail_total);
      if (Number.isFinite(failures) && failures > 0) this.inc(failures);
    },
  });

  setMetricsSink({
    cacheRequest: (fn, result) => cacheRequests.inc({ fn, result }),
    strapiRequest: (type, status, durationSeconds) => {
      strapiRequests.inc({ type, status });
      strapiDuration.observe({ type }, durationSeconds);
    },
  });

  const server = http.createServer(async (req, res) => {
    if (req.method !== 'GET' || req.url?.split('?')[0] !== '/metrics') {
      res.writeHead(404).end();
      return;
    }
    try {
      const body = await registry.metrics();
      res.writeHead(200, { 'Content-Type': registry.contentType }).end(body);
    } catch (error) {
      res.writeHead(500).end((error as Error).message);
    }
  });
  server.on('error', (error) => {
    // Never take the site down for its metrics (e.g. the port is taken in local dev).
    console.error(`[Metrics] server failed on :${PORT}: ${error.message}`);
  });
  server.listen(PORT, '0.0.0.0', () => console.log(`[Metrics] Prometheus endpoint on :${PORT}/metrics`));
}
