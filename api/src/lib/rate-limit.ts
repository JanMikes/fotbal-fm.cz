import type { Context } from 'hono';

export interface RateLimiter {
  /** Returns false when `key` has exhausted its allowance for the current window. */
  check(key: string): boolean;
  /** Drops all counters (tests). */
  reset(): void;
}

interface Entry {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window in-memory limiter, one instance per protected endpoint. Good enough for a
 * single API process; keys are IPs or user ids. Expired entries are swept lazily so the
 * map cannot grow without bound.
 */
export function createRateLimiter(options: { limit: number; windowMs: number }): RateLimiter {
  const entries = new Map<string, Entry>();
  let lastSweep = 0;

  function sweep(now: number) {
    if (now - lastSweep < options.windowMs) return;
    lastSweep = now;
    for (const [key, entry] of entries) {
      if (now >= entry.resetAt) entries.delete(key);
    }
  }

  return {
    check(key) {
      const now = Date.now();
      sweep(now);
      const entry = entries.get(key);
      if (!entry || now >= entry.resetAt) {
        entries.set(key, { count: 1, resetAt: now + options.windowMs });
        return true;
      }
      if (entry.count >= options.limit) return false;
      entry.count += 1;
      return true;
    },
    reset() {
      entries.clear();
    },
  };
}

export function clientIp(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}
