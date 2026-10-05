import type { Core } from '@strapi/strapi';
import Redis from 'ioredis';

const CACHE_PREFIX = 'fotbalfm:';

// Patterns per model (the web's `fotbalfm:` keys, web/src/lib/strapi/data.ts). A model missing
// from this map clears the WHOLE cache, so models the web never reads map to nothing.
export const MODEL_CACHE_PATTERNS: Record<string, {
  collection: string[];
  cascading: string[];
}> = {
  'category': {
    collection: ['categories:*', 'category:*', 'category-slugs:*', 'category-groups:*', 'category-hero:*'],
    cascading: ['news:cat:*', 'matches:*', 'match:*', 'players:*', 'standings:*', 'player-highlights:*'],
  },
  'category-code': {
    collection: [],
    cascading: ['matches:*', 'match:*', 'standings:*'],
  },
  'category-group': {
    collection: ['category-groups:*'],
    cascading: [],
  },
  'comment': {
    collection: [],
    cascading: [],
  },
  'event': {
    collection: [],
    cascading: [],
  },
  'news-article': {
    collection: ['news:*', 'news-article:*'],
    cascading: ['category-hero:*'],             // hero slide 3 shows an article
  },
  'news-article-type': {
    collection: ['news-article-types:*'],
    cascading: ['news:*'],
  },
  'match': {
    collection: ['matches:*', 'match:*'],
    cascading: [],
  },
  'player': {
    collection: ['players:*'],
    cascading: [],
  },
  'standing': {
    collection: ['standings:*'],
    cascading: [],
  },
  'navigation': {
    collection: ['navigation:*'],
    cascading: [],
  },
  'footer': {
    collection: ['footer:*'],
    cascading: [],
  },
  'page': {
    collection: ['page:*', 'page-slugs:*', 'navigation-pages:*'],
    cascading: ['navigation:*', 'footer:*', 'partner:*'], // they link to pages (title/slug)
  },
  'partner': {
    collection: ['partners:*', 'partner:*'],
    cascading: [],
  },
  'player-highlight': {
    collection: ['player-highlights:*'],
    cascading: [],
  },
  'tournament': {
    collection: [],
    cascading: ['matches:*', 'match:*'],
  },
  'team': {
    collection: [],
    cascading: ['matches:*', 'match:*', 'standings:*'],
  },
  // Deep links + audience categories: only the landing page caches them. Claims are
  // written on every app registration through a link and must never flush the site.
  'audience-category': {
    collection: ['audience-categories:*'],
    cascading: ['deep-link:*'],
  },
  'deep-link': {
    collection: ['deep-link:*'],
    cascading: [],
  },
  'deep-link-claim': {
    collection: [],
    cascading: [],
  },
  // Backoffice social-media export history: not read by the web. Unmapped, it caused a full
  // cache clear on every export (35 in one day).
  'social-export-state': {
    collection: [],
    cascading: [],
  },
};

export const DOCUMENT_ACTIONS = new Set([
  'create',
  'update',
  'delete',
  'clone',        // Strapi admin "duplicate" — creates an entry (emits entry.create)
  'publish',
  'unpublish',
]);

export function normalizeModelUid(uid: string): string | null {
  if (!uid.startsWith('api::')) return null;
  return uid.split('::')[1].split('.')[0];
}

async function scanAndDelete(redis: Redis, pattern: string): Promise<number> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', CACHE_PREFIX + pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');

  if (keys.length === 0) return 0;

  let deleted = 0;
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500);
    deleted += await redis.del(...chunk);
  }
  return deleted;
}

async function clearAllCache(redis: Redis): Promise<number> {
  return scanAndDelete(redis, '*');
}

export async function invalidateModel(redis: Redis, modelName: string): Promise<number> {
  const mapping = MODEL_CACHE_PATTERNS[modelName];

  if (!mapping) {
    console.log(`[Cache] Unknown model "${modelName}", clearing all cache`);
    return clearAllCache(redis);
  }

  let totalDeleted = 0;
  const allPatterns = [...mapping.collection, ...mapping.cascading];
  for (const pattern of allPatterns) {
    totalDeleted += await scanAndDelete(redis, pattern);
  }

  return totalDeleted;
}

const DEBOUNCE_MS = 2000;

/**
 * Same options as the web's client (packages/cache/src/redis.ts — Strapi is not an npm
 * workspace, hence the copy). retryStrategy never returns null, so the client reconnects
 * forever instead of ending after 3 attempts; while disconnected a command fails at once
 * (offline queue off) and a stalled Redis costs at most 500 ms per command.
 */
export const REDIS_CLIENT_OPTIONS = {
  lazyConnect: true,
  retryStrategy: (times: number) => Math.min(times * 200, 5000),
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
  commandTimeout: 500,
};

let redis: Redis | null = null;
let shuttingDown = false;
const pendingTimers = new Map<string, NodeJS.Timeout>();

function createRedis(strapi: Core.Strapi, redisUrl: string): Redis | null {
  let client: Redis;
  try {
    client = new Redis(redisUrl, REDIS_CLIENT_OPTIONS);
  } catch (error) {
    strapi.log.error(`[Cache] Failed to create Redis client: ${(error as Error).message}`);
    return null;
  }

  client.on('error', (err) => {
    strapi.log.error(`[Cache] Redis error: ${err.message}`);
  });

  client.on('ready', () => {
    strapi.log.info('[Cache] Redis connected');
  });

  // `end` = the client will never reconnect (explicit quit, or a failure ioredis cannot retry).
  // Drop it so the next invalidation creates a fresh one.
  client.on('end', () => {
    if (redis === client) redis = null;
  });

  client.connect().catch(() => {
    // first attempt failed; ioredis keeps retrying in the background
  });
  return client;
}

/** The shared client, recreated after `end`. Null without REDIS_URL or while shutting down. */
function getRedis(strapi: Core.Strapi): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || shuttingDown) return null;
  if (!redis) redis = createRedis(strapi, redisUrl);
  return redis;
}

function scheduleInvalidation(strapi: Core.Strapi, modelName: string) {
  const existing = pendingTimers.get(modelName);
  if (existing) clearTimeout(existing);

  pendingTimers.set(modelName, setTimeout(async () => {
    pendingTimers.delete(modelName);
    const client = getRedis(strapi);
    if (!client) return;
    try {
      const deleted = await invalidateModel(client, modelName);
      strapi.log.info(`[Cache] Invalidated ${modelName}: deleted ${deleted} keys`);
    } catch (error) {
      // Redis unreachable (commands fail fast while reconnecting) or slow: logged, not retried.
      // The "Clear cache" webhook still flushes the web cache on every entry write.
      strapi.log.error(`[Cache] Failed to invalidate ${modelName}: ${(error as Error).message}`);
    }
  }, DEBOUNCE_MS));
}

/**
 * Register document service middleware — must be called in register().
 */
export function registerCacheMiddleware(strapi: Core.Strapi): void {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    strapi.log.warn('[Cache] REDIS_URL not set, cache invalidation disabled');
    return;
  }

  strapi.documents.use(async (context, next) => {
    const result = await next();

    // No "connected" gate: a write during a Redis blip is scheduled like any other, and the
    // delete is attempted (and logged if it fails) after the debounce.
    if (!DOCUMENT_ACTIONS.has(context.action)) return result;

    const modelName = normalizeModelUid(context.uid);
    if (!modelName) return result;

    strapi.log.debug(`[Cache] ${context.action} on ${modelName}, scheduling invalidation`);
    scheduleInvalidation(strapi, modelName);

    return result;
  });

  strapi.log.info('[Cache] Document service middleware registered');
}

/**
 * Connect to Redis — called in bootstrap() after Strapi is fully initialized.
 */
export function connectCacheRedis(strapi: Core.Strapi): (() => Promise<void>) | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  shuttingDown = false;
  if (!getRedis(strapi)) return null;

  return async () => {
    shuttingDown = true;
    for (const timer of pendingTimers.values()) {
      clearTimeout(timer);
    }
    pendingTimers.clear();
    const client = redis;
    redis = null;
    if (!client) return;
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  };
}
