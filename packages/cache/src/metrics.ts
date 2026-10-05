/*
 * Metrics hook of the data cache. The cache only reports; whoever runs the Prometheus endpoint
 * (web's instrumentation) installs the sink. The sink lives on globalThis, not in this module:
 * Next.js may load this package more than once (instrumentation bundle, route bundles), and all
 * copies must report into the same registry. No prom-client import here — this package is also
 * reachable from client-component imports and must stay free of Node-only modules.
 */

export type CacheResult =
  | 'hit'
  | 'soft_stale'
  | 'invalidated'
  | 'miss'
  | 'budget_exceeded'
  | 'stale_if_error'
  | 'refresh_error'
  | 'redis_unavailable'
  | 'redis_error'
  | 'singleflight_join'
  | 'fallback'
  | 'memo_hit'
  | 'bypass';

export interface MetricsSink {
  cacheRequest(fn: string, result: CacheResult): void;
  strapiRequest(type: string, status: string, seconds: number): void;
}

const SINK = Symbol.for('fotbalfm.metrics.sink');
type Holder = { [SINK]?: MetricsSink };

export function setMetricsSink(sink: MetricsSink | undefined): void {
  (globalThis as Holder)[SINK] = sink;
}

export const metrics: MetricsSink = {
  cacheRequest(fn, result) {
    (globalThis as Holder)[SINK]?.cacheRequest(fn, result);
  },
  strapiRequest(type, status, seconds) {
    (globalThis as Holder)[SINK]?.strapiRequest(type, status, seconds);
  },
};
