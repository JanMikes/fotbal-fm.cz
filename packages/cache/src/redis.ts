type RedisClient = import('ioredis').default;

/**
 * Client options for every reader/writer of the page cache (web, the api sync CLIs).
 * strapi/src/cache-invalidation.ts carries a copy (Strapi is not an npm workspace).
 *
 * - `retryStrategy` never returns null: ioredis keeps reconnecting (backoff capped at 5 s).
 *   It used to give up after 3 attempts, which left a client in status `end` that rejected
 *   every command until the process restarted — a ~0.6 s Redis restart was enough.
 * - `enableOfflineQueue: false` + `maxRetriesPerRequest: 1`: while disconnected a command fails
 *   at once (callers treat that as a cache miss) instead of queueing behind the reconnect.
 * - `connectTimeout` / `commandTimeout`: a black-holed or stalled Redis costs at most 2 s to
 *   connect and 500 ms per command — never a hung page render.
 */
export const REDIS_CLIENT_OPTIONS = {
  lazyConnect: true,
  retryStrategy: (times: number) => Math.min(times * 200, 5000),
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
  commandTimeout: 500,
} satisfies import('ioredis').RedisOptions;

/** Minimum gap between two client creations (only matters if clients keep ending). */
const RECREATE_AFTER_MS = 1000;

let redisClient: RedisClient | null = null;
let creating: Promise<void> | null = null;
let nextCreateAt = 0;

function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Close the shared client so short-lived processes (CLI sync scripts)
 * can exit instead of hanging on the open connection.
 */
export async function closeRedisClient(): Promise<void> {
  if (creating) await creating;
  if (!redisClient) return;
  const client = redisClient;
  redisClient = null;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}

/** Wire up a new client and make its first connection attempt. */
async function connectClient(client: RedisClient): Promise<void> {
  client.on('error', (err: Error) => {
    console.error('[Redis] Connection error:', err.message);
  });

  client.on('ready', () => {
    console.log('[Redis] Connected successfully');
  });

  // With a retryStrategy that never gives up, `end` only follows an explicit quit/disconnect
  // or a connector failure ioredis cannot retry. Forget the client: the next caller builds a
  // fresh one instead of reusing a dead one forever.
  client.on('end', () => {
    if (redisClient !== client) return; // closed on purpose by closeRedisClient()
    redisClient = null;
    console.warn('[Redis] Connection ended, a new client will be created on next use');
  });

  // A failed first attempt (Redis down at boot) is fine: ioredis keeps retrying in the
  // background and the client turns `ready` by itself once Redis is back.
  await client.connect().catch(() => {});
  if (client.status !== 'end') redisClient = client;
}

/**
 * The shared client while it is connected, `null` otherwise (no REDIS_URL, browser, or Redis
 * currently unreachable). Callers treat `null` as "no cache" and go to the source; the client
 * reconnects on its own, so the cache comes back without restarting the process.
 */
export async function getRedisClient(): Promise<RedisClient | null> {
  if (!isServer()) return null;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  if (!redisClient) {
    if (!creating) {
      if (Date.now() < nextCreateAt) return null;
      nextCreateAt = Date.now() + RECREATE_AFTER_MS;
      // Keep the dynamic import here, after the REDIS_URL check: in browser bundles that check
      // is compile-time false, so the bundler drops the import and ioredis (net, tls, dns)
      // never enters the client graph (data.ts is reachable from a client component).
      creating = import('ioredis')
        .then(({ Redis }) => connectClient(new Redis(redisUrl, REDIS_CLIENT_OPTIONS)))
        .catch((error: Error) => {
          console.error('[Redis] Failed to create client:', error.message);
        })
        .finally(() => {
          creating = null;
        });
    }
    await creating;
  }

  return redisClient?.status === 'ready' ? redisClient : null;
}
