import { cacheClearAll, closeRedisClient } from '@fotbal-fm/cache';

/**
 * Flush the whole web page cache once after a sync run, then close the
 * Redis connection so the CLI process can exit. No-op without REDIS_URL.
 */
export async function flushWebCache(): Promise<void> {
  if (!process.env.REDIS_URL) {
    console.log('Cache flush skipped (REDIS_URL not set)');
    return;
  }
  console.log('Flushing web cache...');
  await cacheClearAll();
  await closeRedisClient();
}

/**
 * Flush only when the sync run wrote something (`changes` = creates +
 * updates + deletes); a run that changed nothing leaves the cache warm.
 */
export async function flushWebCacheIfChanged(changes: number): Promise<void> {
  if (changes === 0) {
    console.log('Nothing changed, web cache kept');
    return;
  }
  await flushWebCache();
}
