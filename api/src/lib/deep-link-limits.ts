import { createRateLimiter } from './rate-limit.js';

/**
 * One set of limiters for every path that resolves or claims a deep link — the dedicated
 * routes AND the login/register enrichment — so the auth endpoints cannot be used to probe
 * codes without limit. Codes are unguessable (32^8) but custom marketing codes may be short.
 */
export const resolveLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });
export const claimLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
export const createLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 60_000 });

export const RATE_LIMIT_MESSAGE = 'Příliš mnoho požadavků. Zkuste to prosím později.';

export function resetDeepLinkLimiters(): void {
  resolveLimiter.reset();
  claimLimiter.reset();
  createLimiter.reset();
}
