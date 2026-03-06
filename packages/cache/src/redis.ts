type RedisClient = import('ioredis').default;

let redisClient: RedisClient | null = null;
let redisAvailable = true;
let redisChecked = false;

function isServer(): boolean {
  return typeof window === 'undefined';
}

export async function getRedisClient(): Promise<RedisClient | null> {
  if (!isServer()) {
    return null;
  }

  if (!redisAvailable) {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (!redisChecked) {
      console.warn('[Redis] REDIS_URL not configured, caching disabled');
      redisChecked = true;
    }
    redisAvailable = false;
    return null;
  }

  try {
    const Redis = (await import('ioredis')).default;

    redisClient = new Redis(redisUrl, {
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

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    await redisClient.connect().catch((err) => {
      console.error('[Redis] Initial connection failed:', err.message);
      redisAvailable = false;
      redisClient = null;
    });

    return redisClient;
  } catch (error) {
    console.error('[Redis] Failed to create client:', error);
    redisAvailable = false;
    return null;
  }
}
