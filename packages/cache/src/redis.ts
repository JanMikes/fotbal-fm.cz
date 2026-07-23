type RedisClient = import('ioredis').default;

let redisClient: RedisClient | null = null;
let lastFailedAt = 0;
const RETRY_AFTER_MS = 10_000; // Retry connection after 10s on failure

function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Close the shared client so short-lived processes (CLI sync scripts)
 * can exit instead of hanging on the open connection.
 */
export async function closeRedisClient(): Promise<void> {
  if (!redisClient) return;
  const client = redisClient;
  redisClient = null;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}

export async function getRedisClient(): Promise<RedisClient | null> {
  if (!isServer()) return null;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  if (redisClient) return redisClient;

  // Backoff: don't retry too often after a failure
  if (lastFailedAt && Date.now() - lastFailedAt < RETRY_AFTER_MS) {
    return null;
  }

  try {
    const Redis = (await import('ioredis')).default;

    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          console.error('[Redis] Max retries reached, giving up');
          return null;
        }
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true,
    });

    client.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    client.on('connect', () => {
      lastFailedAt = 0;
      console.log('[Redis] Connected successfully');
    });

    await client.connect();
    redisClient = client;
    lastFailedAt = 0;
    return redisClient;
  } catch (error) {
    console.error('[Redis] Failed to connect:', (error as Error).message);
    lastFailedAt = Date.now();
    redisClient = null;
    return null;
  }
}
