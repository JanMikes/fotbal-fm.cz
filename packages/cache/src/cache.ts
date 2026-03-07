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

export async function cacheGetOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached.hit) return cached.value;

  const data = await fetchFn();

  cacheSet(key, data, ttlSeconds).catch(() => {});

  return data;
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
