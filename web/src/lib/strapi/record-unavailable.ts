/**
 * A route's own record — the CMS page, category, article, partner, or the roster a player is read
 * from — could not be loaded: Strapi failed (5xx, the client's 10 s timeout, network) and no copy
 * is cached. It is NEVER "not found": a 404 would tell visitors and search engines the page is
 * gone. The proxy's record gate (src/proxy.ts) answers 503 "temporarily unavailable" before the
 * page renders; a page that still meets it (Strapi failing between the gate and the render)
 * errors (500) — never a 404, never an empty page. Nothing stores it: the data cache's failure
 * memo (10 s) is the only memory of the failure.
 */
export class RecordUnavailableError extends Error {
  readonly recordUnavailable = true;

  constructor(readonly fn: string) {
    super(`${fn}: Strapi failed and no copy is cached — temporarily unavailable`);
    this.name = 'RecordUnavailableError';
  }
}

export function isRecordUnavailableError(error: unknown): error is RecordUnavailableError {
  return typeof error === 'object' && error !== null && (error as { recordUnavailable?: unknown }).recordUnavailable === true;
}
