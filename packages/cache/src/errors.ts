/*
 * Error brands the data cache acts on. Recognised by a brand property rather than `instanceof`,
 * so they still work if a bundler ends up with two copies of this package.
 */

/**
 * The data source failed (HTTP error status, timeout, network): the only kind of error the
 * cache turns into a caller's `onError` fallback on a miss, serves stale data for, and
 * remembers in the failure memo. Data-source clients throw it (web's StrapiError extends it).
 */
export class UpstreamError extends Error {
  readonly upstreamFailure = true as const;
}

export function isUpstreamError(error: unknown): error is UpstreamError {
  return typeof error === 'object' && error !== null && (error as { upstreamFailure?: unknown }).upstreamFailure === true;
}

/**
 * The data source rejected our credentials (Strapi 401/403): a configuration error, never an
 * outage. It must not turn into empty data — on a miss it propagates (the page fails, a new
 * container's readiness latch stays closed, blackbox sees it) — but where a stale value exists
 * it is served, loudly logged and counted (`fotbalfm_strapi_requests_total{status="401"}`).
 */
export class UpstreamAuthError extends Error {
  readonly upstreamAuthFailure = true as const;
}

export function isUpstreamAuthError(error: unknown): error is UpstreamAuthError {
  return typeof error === 'object' && error !== null && (error as { upstreamAuthFailure?: unknown }).upstreamAuthFailure === true;
}
