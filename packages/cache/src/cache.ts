import { getRedisClient } from './redis';

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const CACHE_PREFIX = 'fotbalfm:';

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const data = await client.get(CACHE_PREFIX + key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error(`[Cache] Error getting key ${key}:`, error);
    return null;
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
    await client.setex(CACHE_PREFIX + key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[Cache] Error setting key ${key}:`, error);
    return false;
  }
}

export async function cacheDelete(key: string): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    await client.del(CACHE_PREFIX + key);
    return true;
  } catch (error) {
    console.error(`[Cache] Error deleting key ${key}:`, error);
    return false;
  }
}

export async function cacheDeletePattern(pattern: string): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;

  try {
    const keys = await client.keys(CACHE_PREFIX + pattern);
    if (keys.length === 0) return 0;
    const deleted = await client.del(...keys);
    console.log(`[Cache] Deleted ${deleted} keys matching: ${pattern}`);
    return deleted;
  } catch (error) {
    console.error(`[Cache] Error deleting pattern ${pattern}:`, error);
    return 0;
  }
}

export async function cacheClearAll(): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    const keys = await client.keys(CACHE_PREFIX + '*');
    if (keys.length > 0) {
      await client.del(...keys);
      console.log(`[Cache] Cleared ${keys.length} cache entries`);
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
  if (cached !== null) return cached;

  const data = await fetchFn();

  cacheSet(key, data, ttlSeconds).catch(() => {});

  return data;
}

export async function cacheStats(): Promise<{
  available: boolean;
  keyCount: number;
  keys: string[];
}> {
  const client = await getRedisClient();
  if (!client) return { available: false, keyCount: 0, keys: [] };

  try {
    const keys = await client.keys(CACHE_PREFIX + '*');
    return {
      available: true,
      keyCount: keys.length,
      keys: keys.map((k) => k.replace(CACHE_PREFIX, '')),
    };
  } catch (error) {
    console.error('[Cache] Error getting stats:', error);
    return { available: false, keyCount: 0, keys: [] };
  }
}
