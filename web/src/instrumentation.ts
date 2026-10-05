/**
 * Runs once when a Next.js server process starts. Starts the Prometheus endpoint (:9464) in the
 * Node.js runtime only; the data cache and the Strapi client report into it through a
 * process-global sink (packages/cache/src/metrics.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startMetricsServer } = await import('./lib/metrics-server');
    startMetricsServer();
  }
}
