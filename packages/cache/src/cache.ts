import { getRedisClient } from './redis';

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const CACHE_PREFIX = 'fotbalfm:';
const NULL_SENTINEL = '__CACHE_NULL__';

export async function cacheGet<T>(key: string): Promise<{ hit: true; value: T } | { hit: false }> {
  const client = await getRedisClient();
  if (!client) return { hit: false };

  try {
    const raw = await client.get(CACHE_PREFIX + key);
    if (raw === null) return { hit: false };
    if (raw === NULL_SENTINEL) return { hit: true, value: null as T };
    return { hit: true, value: JSON.parse(raw) as T };
  } catch (error) {
    console.error(`[Cache] Error getting key ${key}:`, error);
    return { hit: false };
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    const serialized = value === null || value === undefined ? NULL_SENTINEL : JSON.stringify(value);
    await client.setex(CACHE_PREFIX + key, ttlSeconds, serialized);
    return true;
  } catch (error) {
    console.error(`[Cache] Error setting key ${key}:`, error);
    return false;
  }
}

export async function cacheDelete(key: string): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;

  try {
    return await client.del(CACHE_PREFIX + key);
  } catch (error) {
    console.error(`[Cache] Error deleting key ${key}:`, error);
    return 0;
  }
}

async function scanKeys(pattern: string): Promise<string[]> {
  const client = await getRedisClient();
  if (!client) return [];

  const keys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await client.scan(cursor, 'MATCH', CACHE_PREFIX + pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');

  return keys;
}

async function deleteKeys(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;
  const client = await getRedisClient();
  if (!client) return 0;

  let deleted = 0;
  // Batch deletes in chunks of 500 to avoid huge Redis commands
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500);
    deleted += await client.del(...chunk);
  }
  return deleted;
}

export async function cacheDeletePattern(pattern: string): Promise<number> {
  try {
    const keys = await scanKeys(pattern);
    if (keys.length === 0) return 0;
    const deleted = await deleteKeys(keys);
    console.log(`[Cache] Deleted ${deleted} keys matching: ${pattern}`);
    return deleted;
  } catch (error) {
    console.error(`[Cache] Error deleting pattern ${pattern}:`, error);
    return 0;
  }
}

export async function cacheClearAll(): Promise<boolean> {
  try {
    const keys = await scanKeys('*');
    if (keys.length > 0) {
      const deleted = await deleteKeys(keys);
      console.log(`[Cache] Cleared ${deleted} cache entries`);
    }
    return true;
  } catch (error) {
    console.error('[Cache] Error clearing cache:', error);
    return false;
  }
}

// --- cacheGetOrSet: single-flight + never caching a failure ------------------------------
//
// Both maps are in-process only (one per web process) and never written to Redis.
//
// inflight: one load per key at a time. Every concurrent miss of a key waits for the same
//   load instead of sending its own request upstream (the 2026-10-05 burst sent each miss
//   to Strapi). With one web replica, two during a rollout, that is ≤2 upstream calls per key.
//
// recentFailures: a small per-key circuit breaker. A failed load is never cached in Redis —
//   the caller's `onError` value is rendered for that one request — but the key is remembered
//   for FAILURE_MEMO_MS. Within that window callers with an `onError` get it immediately
//   instead of waiting for the same failure again (a hung Strapi costs the 10 s client timeout
//   per attempt). After the window one load probes upstream again (half-open) and every caller,
//   the one that started it included, waits for it at most HALF_OPEN_WAIT_MS before falling
//   back; the probe itself runs on in the background. A recovered Strapi answers well within the
//   wait, so callers get the real value — which also keeps one render consistent when its layout
//   and page read the same key — while a still-hung Strapi costs a request 1.5 s per key, not
//   the 10 s client timeout (pages chain dependent keys, so that was 20 s per request). A
//   success forgets the failure, a failure re-opens the window.
//   Per key rather than global on purpose: a broken query or a 4xx on one key must not take
//   every other key offline. The cost of per key: during an outage each cold key still pays
//   the full client timeout once, on its first failure; after that it is fail-fast.

/** How long a failed load short-circuits further loads of the same key. */
export const FAILURE_MEMO_MS = 10_000;
/** Bound on remembered failures; the oldest is dropped beyond it. */
export const FAILURE_MEMO_MAX_KEYS = 1000;
/** How long any caller waits for a half-open probe before taking its fallback. */
export const HALF_OPEN_WAIT_MS = 1500;

const inflight = new Map<string, Promise<unknown>>();
const recentFailures = new Map<string, number>(); // key -> failed at (ms)

function rememberFailure(key: string): void {
  recentFailures.delete(key); // re-insert so Map order stays oldest-first
  recentFailures.set(key, Date.now());
  if (recentFailures.size > FAILURE_MEMO_MAX_KEYS) {
    const oldest = recentFailures.keys().next().value;
    if (oldest !== undefined) recentFailures.delete(oldest);
  }
}

function load<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds: number): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const promise = (async () => {
    try {
      const data = await fetchFn();
      recentFailures.delete(key);
      // Awaited inside the flight (bounded by commandTimeout) so a request arriving right after
      // the load finds the value in Redis instead of starting a second load.
      await cacheSet(key, data, ttlSeconds);
      return data;
    } catch (error) {
      rememberFailure(key);
      console.error(`[Cache] ${key}: upstream failed, not cached: ${(error as Error).message}`);
      throw error;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

export interface CacheGetOrSetOptions<T> {
  /**
   * Value to render when `fetchFn` throws (or failed less than FAILURE_MEMO_MS ago). It is
   * never written to the cache. Without it the error propagates to the caller.
   */
  onError?: () => T;
}

export async function cacheGetOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  options: CacheGetOrSetOptions<T> = {},
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached.hit) return cached.value;

  const { onError } = options;
  const failedAt = recentFailures.get(key);
  if (onError && failedAt !== undefined) {
    if (Date.now() - failedAt < FAILURE_MEMO_MS) return onError(); // open
    return waitForProbe(load(key, fetchFn, ttlSeconds), onError); // half-open
  }

  try {
    return await load(key, fetchFn, ttlSeconds);
  } catch (error) {
    if (!onError) throw error;
    return onError();
  }
}

/** The probe's value if it succeeds within HALF_OPEN_WAIT_MS, the fallback otherwise (the probe runs on). */
async function waitForProbe<T>(probe: Promise<T>, onError: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), HALF_OPEN_WAIT_MS);
  });
  try {
    const settled = await Promise.race([probe.then((value) => ({ value }), () => null), timeout]);
    return settled ? settled.value : onError();
  } finally {
    clearTimeout(timer);
  }
}

/** Tests only: forget in-flight loads and remembered failures. */
export function __resetCacheGetOrSetState(): void {
  inflight.clear();
  recentFailures.clear();
}

/** Tests only: sizes of the in-process maps. */
export function __cacheGetOrSetStateSize(): { inflight: number; recentFailures: number } {
  return { inflight: inflight.size, recentFailures: recentFailures.size };
}

export async function cacheStats(): Promise<{
  available: boolean;
  keyCount: number;
  keys: string[];
}> {
  try {
    const keys = await scanKeys('*');
    return {
      available: keys !== null,
      keyCount: keys.length,
      keys: keys.map((k) => k.replace(CACHE_PREFIX, '')),
    };
  } catch (error) {
    console.error('[Cache] Error getting stats:', error);
    return { available: false, keyCount: 0, keys: [] };
  }
}
