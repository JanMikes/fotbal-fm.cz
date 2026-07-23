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
