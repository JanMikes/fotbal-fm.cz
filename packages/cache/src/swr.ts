import { getRedisClient } from './redis';
import { metrics, type CacheResult } from './metrics';
import { isUpstreamAuthError, isUpstreamError } from './errors';

type RedisClient = import('ioredis').default;

/*
 * Data cache v2 (fotbal-fm web-cache plan Phase 1, lily D75): tag generations instead of deletes.
 *
 * - Every entry is stamped with the generations of its tags when its load STARTED (`tv`). Strapi
 *   bumps a tag's generation after every committed write of a content type with that tag; a read
 *   that finds `tv` !== the current generations knows the entry predates a write. Nothing is ever
 *   deleted, so a write never empties the cache: readers refresh in the foreground for at most
 *   FOREGROUND_BUDGET_MS, then fall back to the stale value while the refresh finishes.
 * - Entries hold the raw Strapi response of one request (the key hashes its URL) and callers map
 *   on read: a changed query is a new key, a changed mapper applies at once — entries survive
 *   deploys (hard TTL 7 d).
 * - Soft TTL (5 min): an entry older than that is served once more while one background refresh
 *   runs. This bounds every invalidation that never reached Redis (SQL edits, a lost bump).
 * - Single-flight per (key, generation signature): concurrent readers of the same generation share
 *   one load; a reader at a newer generation never joins a load that started before the bump (V9).
 * - Failures: an upstream failure (Strapi 5xx/timeout/network) serves the stale value if one
 *   exists, else the caller's `onError` fallback (never stored) behind the per-key failure memo
 *   from Phase 0. An auth failure (401/403) never becomes a fallback: stale if it exists, else it
 *   propagates. Anything else (a bug, a framework control-flow signal) always propagates.
 * - Redis unavailable: an in-process memo (30 s) keeps Strapi off the hot path until Redis returns.
 */

export const TAGVER = 'fotbalfm:v2:tagver';
export const TAGTS = 'fotbalfm:v2:tagts';
export const TRANSPORT = 'fotbalfm:v2:transport';
export const ENTRY_PREFIX = 'fotbalfm:v2:d:';

const HARD_TTL_S = 7 * 24 * 3600; // stale-if-error window; entries carry EX, so volatile-lru may evict them
export const FOREGROUND_BUDGET_MS = 1500;
const TAG_MEMO_MS = 250;
export const NO_REDIS_MEMO_MS = 30_000;
const NO_REDIS_MEMO_MAX = 500;
/** How long a failed miss short-circuits further loads of the same key (Phase 0 V41). */
export const FAILURE_MEMO_MS = 10_000;
const FAILURE_MEMO_MAX_KEYS = 1000;

type Gens = Record<string, number>;
type Entry<T> = { v: T; at: number; tv: Gens };

export interface CachedOptions<T> {
  /** Data function name: the metrics label and part of the key. */
  fn: string;
  /** The Strapi request URL (path + query) the load performs: the key is a hash of it. */
  url: string;
  /** Tags of every content type the request filters on or populates (`all` is implied). */
  tags: readonly string[];
  /** Performs the request. Throws an UpstreamError / UpstreamAuthError on Strapi failures. */
  load: () => Promise<T>;
  /** Value for a miss whose load failed upstream. Never stored. Without it the error propagates. */
  onError?: () => T;
}

export function softTtlMs(): number {
  const configured = Number(process.env.DATA_CACHE_SOFT_TTL_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 5 * 60_000;
}

/**
 * `DATA_CACHE_MODE=off` bypasses Redis (every read goes to Strapi, single-flighted). Anything
 * else, including unset, is "on": the image must be safe before the infra sets the variable.
 */
export function cacheMode(): 'on' | 'off' {
  return process.env.DATA_CACHE_MODE === 'off' ? 'off' : 'on';
}

// --- in-process state (one per web process, never written to Redis) ----------------------

const flights = new Map<string, Promise<unknown>>();
const recentFailures = new Map<string, number>(); // key -> failed at
// Keys whose foreground refresh already blew the budget and is still running (C-V3): later readers
// of the invalidated entry get the stale copy at once instead of each waiting the budget again.
// An entry lives only as long as its flight (≤ the Strapi client's 10 s timeout).
const slowRefreshes = new Set<string>();
const noRedisMemo = new Map<string, { v: unknown; at: number }>();
let tagMemo: { at: number; gens: Gens } | null = null;

function count(fn: string, result: CacheResult): void {
  metrics.cacheRequest(fn, result);
}

/** The failure memo is open for `key`: its last load failed upstream less than FAILURE_MEMO_MS ago. */
function failedRecently(key: string): boolean {
  const failedAt = recentFailures.get(key);
  return failedAt !== undefined && Date.now() - failedAt < FAILURE_MEMO_MS;
}

function rememberFailure(key: string): void {
  recentFailures.delete(key); // re-insert so Map order stays oldest-first
  recentFailures.set(key, Date.now());
  if (recentFailures.size > FAILURE_MEMO_MAX_KEYS) {
    const oldest = recentFailures.keys().next().value;
    if (oldest !== undefined) recentFailures.delete(oldest);
  }
}

function withAll(tags: readonly string[]): string[] {
  return [...new Set([...tags, 'all'])];
}

function signature(tags: string[], gens: Gens): string {
  return tags.map((t) => `${t}=${gens[t] ?? 0}`).join(',');
}

function isInvalidated(entry: Entry<unknown>, tags: string[], gens: Gens): boolean {
  // `!==`, not `>`: a reset counter (Redis restart, deleted hash) must invalidate too (V11).
  return tags.some((t) => (gens[t] ?? 0) !== (entry.tv?.[t] ?? 0));
}

async function sha1Hex(text: string): Promise<string> {
  // WebCrypto, not node:crypto: this module is also bundled for the browser (unused there).
  const digest = await globalThis.crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function entryKey(fn: string, url: string): Promise<string> {
  return `${ENTRY_PREFIX}${fn}:${await sha1Hex(url)}`;
}

/** Current tag generations, memoized for TAG_MEMO_MS (~25 fields; one HGETALL). */
async function tagGens(redis: RedisClient): Promise<Gens> {
  if (tagMemo && Date.now() - tagMemo.at < TAG_MEMO_MS) return tagMemo.gens;
  const raw = await redis.hgetall(TAGVER);
  const gens = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)]));
  tagMemo = { at: Date.now(), gens };
  return gens;
}

/** Logs a failed load once (in the flight, not per joiner). Bugs and Next signals are not logged here. */
function logFailure(fn: string, error: unknown): void {
  if (isUpstreamAuthError(error)) {
    console.error(`[Cache] ${fn}: Strapi REJECTED the API token — not cached: ${(error as Error).message}`);
  } else if (isUpstreamError(error)) {
    console.error(`[Cache] ${fn}: upstream failed, not cached: ${error.message}`);
  }
}

/**
 * One load per flight key at a time; the value is handed to `store` (Redis or the no-Redis memo)
 * inside the flight, so a reader arriving right after finds it instead of starting a second load.
 */
function load<T>(
  flightKey: string,
  failureKey: string,
  o: CachedOptions<T>,
  store: (value: T) => Promise<void>,
): Promise<T> {
  const running = flights.get(flightKey) as Promise<T> | undefined;
  if (running) {
    count(o.fn, 'singleflight_join');
    return running;
  }
  const promise = (async () => {
    try {
      const value = await o.load();
      recentFailures.delete(failureKey);
      await store(value);
      return value;
    } catch (error) {
      if (isUpstreamError(error)) rememberFailure(failureKey);
      logFailure(o.fn, error);
      throw error;
    } finally {
      flights.delete(flightKey);
    }
  })();
  flights.set(flightKey, promise);
  return promise;
}

type Outcome<T> = { value: T } | { error: unknown } | 'timeout';

/** The promise's outcome, or 'timeout' after `ms` (the promise runs on; it never rejects unhandled). */
async function within<T>(promise: Promise<T>, ms: number): Promise<Outcome<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), ms);
  });
  const outcome = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    return await Promise.race([outcome, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Fire-and-forget: a background refresh's failure is counted, never unhandled. */
function background(promise: Promise<unknown>, fn: string): void {
  promise.catch(() => count(fn, 'refresh_error'));
}

/**
 * A miss: there is no copy to serve instead, so the reader waits for the load — never a budget.
 * A slow-but-answering Strapi gives a slow but correct page, never the fallback (an empty section,
 * or a 404 for a page/category record). Only an upstream FAILURE (5xx, the client's 10 s timeout,
 * network) gives `onError`, and for FAILURE_MEMO_MS after it the key answers `onError` at once
 * (open). After that the next read is the probe (half-open): it waits for the load like any miss —
 * single-flighted, so concurrent readers share it — and a success clears the memo.
 * Non-upstream errors (bugs, auth, framework signals) propagate.
 */
async function missLoad<T>(failureKey: string, o: CachedOptions<T>, start: () => Promise<T>): Promise<T> {
  if (o.onError && failedRecently(failureKey)) {
    count(o.fn, 'fallback');
    return o.onError(); // open: Strapi failed this key moments ago, don't wait for it again
  }
  try {
    return await start();
  } catch (error) {
    if (!o.onError || !isUpstreamError(error)) throw error;
    count(o.fn, 'fallback');
    return o.onError();
  }
}

/** Redis unreachable: an in-process memo keeps Strapi at ≤1 load per key per NO_REDIS_MEMO_MS. */
async function withoutRedis<T>(key: string, o: CachedOptions<T>): Promise<T> {
  const memo = noRedisMemo.get(key);
  if (memo && Date.now() - memo.at < NO_REDIS_MEMO_MS) {
    count(o.fn, 'memo_hit');
    return memo.v as T;
  }
  return missLoad(key, o, () =>
    load(`${key}|no-redis`, key, o, async (value) => {
      noRedisMemo.delete(key);
      noRedisMemo.set(key, { v: value, at: Date.now() });
      if (noRedisMemo.size > NO_REDIS_MEMO_MAX) {
        const oldest = noRedisMemo.keys().next().value;
        if (oldest !== undefined) noRedisMemo.delete(oldest);
      }
    }),
  );
}

export async function cached<T>(o: CachedOptions<T>): Promise<T> {
  if (cacheMode() === 'off') {
    count(o.fn, 'bypass'); // NOT burst-safe: Strapi is back on the hot path (single-flighted only)
    const key = `off:${o.fn}:${o.url}`;
    return missLoad(key, o, () => load(key, key, o, async () => {}));
  }

  const key = await entryKey(o.fn, o.url);
  const tags = withAll(o.tags);

  let redis: RedisClient | null = null;
  let gens: Gens | null = null;
  let entry: Entry<T> | null = null;
  try {
    redis = await getRedisClient();
    if (redis) {
      gens = await tagGens(redis);
      const stored = await redis.get(key);
      entry = stored ? (JSON.parse(stored) as Entry<T>) : null;
    }
  } catch (error) {
    count(o.fn, 'redis_error');
    console.error(`[Cache] ${o.fn}: Redis read failed: ${(error as Error).message}`);
    gens = null;
  }
  if (!redis || !gens) {
    count(o.fn, 'redis_unavailable');
    return withoutRedis(key, o);
  }

  const client = redis;
  const g = gens;
  const sig = signature(tags, g);
  // Generations captured BEFORE the load: a write committed during the load leaves an older stamp,
  // so the next read refreshes again (never wrong, at most one extra load).
  const tv = Object.fromEntries(tags.map((t) => [t, g[t] ?? 0]));
  const refresh = () =>
    load(`${key}|${sig}`, key, o, async (value) => {
      const stamped: Entry<T> = { v: value, at: Date.now(), tv };
      await client.set(key, JSON.stringify(stamped), 'EX', HARD_TTL_S).catch((error: Error) => {
        count(o.fn, 'redis_error');
        console.error(`[Cache] ${o.fn}: Redis write failed: ${error.message}`);
      });
    });

  if (!entry) {
    count(o.fn, 'miss');
    return missLoad(key, o, refresh);
  }

  if (isInvalidated(entry, tags, g)) {
    count(o.fn, 'invalidated');
    // C-V3: Strapi failed this key moments ago, or a refresh of it is already running past the
    // budget (Strapi hung or slow) — serve the stale copy now instead of every reader waiting the
    // budget again. No new load while the memo is open; the first read after it expires refreshes
    // in the foreground again (the half-open probe, as on a miss).
    if (failedRecently(key)) {
      count(o.fn, 'stale_if_error');
      return entry.v;
    }
    if (slowRefreshes.has(key)) {
      count(o.fn, 'budget_exceeded');
      return entry.v;
    }
    const pending = refresh();
    const outcome = await within(pending, FOREGROUND_BUDGET_MS); // V10: Strapi latency is capped for users
    if (outcome === 'timeout') {
      count(o.fn, 'budget_exceeded');
      background(pending, o.fn);
      slowRefreshes.add(key);
      const settled = () => slowRefreshes.delete(key);
      pending.then(settled, settled);
      return entry.v;
    }
    if ('value' in outcome) return outcome.value;
    if (isUpstreamError(outcome.error) || isUpstreamAuthError(outcome.error)) {
      count(o.fn, 'stale_if_error');
      return entry.v;
    }
    throw outcome.error;
  }

  if (Date.now() - entry.at > softTtlMs()) {
    count(o.fn, 'soft_stale');
    background(refresh(), o.fn);
    return entry.v;
  }

  count(o.fn, 'hit');
  return entry.v;
}

/**
 * Whether an entry exists for (fn, url) — fresh, soft-stale or invalidated alike: anything a
 * reader can serve without Strapi. `null` when that cannot be told (cache off, Redis unavailable).
 * Used by the web's record gate (proxy.ts), which must never start a refresh of its own.
 */
export async function hasEntry(fn: string, url: string): Promise<boolean | null> {
  if (cacheMode() === 'off') return null;
  try {
    const redis = await getRedisClient();
    if (!redis) return null;
    return (await redis.exists(await entryKey(fn, url))) === 1;
  } catch {
    return null;
  }
}

/**
 * Bumps tag generations now (the transitional webhook endpoint and the api syncs' flush). Returns
 * false when Redis is unavailable — the caller logs it; Strapi's transport bumps the same writes.
 */
export async function bumpTags(tags: readonly string[]): Promise<boolean> {
  if (tags.length === 0) return true;
  const redis = await getRedisClient();
  if (!redis) return false;
  const now = String(Date.now());
  const m = redis.multi();
  for (const t of tags) {
    m.hincrby(TAGVER, t, 1);
    m.hset(TAGTS, t, now);
  }
  await m.exec();
  tagMemo = null; // this process sees its own bump at once
  return true;
}

/** Tests only: forget all in-process state. */
export function __resetSwrState(): void {
  flights.clear();
  recentFailures.clear();
  slowRefreshes.clear();
  noRedisMemo.clear();
  tagMemo = null;
}

/** Tests only: sizes of the in-process maps. */
export function __swrStateSize(): { flights: number; recentFailures: number; slowRefreshes: number; noRedisMemo: number } {
  return { flights: flights.size, recentFailures: recentFailures.size, slowRefreshes: slowRefreshes.size, noRedisMemo: noRedisMemo.size };
}
