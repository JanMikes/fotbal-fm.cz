import type { Core } from '@strapi/strapi';
import Redis from 'ioredis';

const CACHE_PREFIX = 'fotbalfm:';

const MODEL_CACHE_PATTERNS: Record<string, {
  collection: string[];
  cascading: string[];
}> = {
  'category': {
    collection: ['categories:*', 'category:*', 'category-groups:*', 'category-hero:*'],
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
    cascading: [],
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
    collection: ['page:*'],
    cascading: [],
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
};

const LIFECYCLE_EVENTS = [
  'afterCreate',
  'afterUpdate',
  'afterDelete',
  'afterDeleteMany',
  'afterUpdateMany',
] as const;

function normalizeModelUid(uid: string): string | null {
  // Only handle api:: models, ignore plugin:: models
  if (!uid.startsWith('api::')) return null;
  // "api::news-article.news-article" → "news-article"
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

async function invalidateModel(redis: Redis, modelName: string): Promise<number> {
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

export function registerCacheInvalidation(strapi: Core.Strapi): (() => Promise<void>) | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    strapi.log.warn('[Cache] REDIS_URL not set, cache invalidation disabled');
    return null;
  }

  let redis: Redis;
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true,
    });
  } catch (error) {
    strapi.log.error(`[Cache] Failed to create Redis client: ${(error as Error).message}`);
    return null;
  }

  let connected = false;
  const pendingTimers = new Map<string, NodeJS.Timeout>();

  redis.on('error', (err) => {
    strapi.log.error(`[Cache] Redis error: ${err.message}`);
  });

  redis.on('connect', () => {
    connected = true;
  });

  redis.on('close', () => {
    connected = false;
  });

  redis.connect()
    .then(() => strapi.log.info('[Cache] Redis connected'))
    .catch((err) => strapi.log.error(`[Cache] Redis connection failed: ${err.message}`));

  function scheduleInvalidation(modelName: string) {
    const existing = pendingTimers.get(modelName);
    if (existing) clearTimeout(existing);

    pendingTimers.set(modelName, setTimeout(async () => {
      pendingTimers.delete(modelName);
      try {
        const deleted = await invalidateModel(redis, modelName);
        strapi.log.info(`[Cache] Invalidated ${modelName}: deleted ${deleted} keys`);
      } catch (error) {
        strapi.log.error(`[Cache] Failed to invalidate ${modelName}: ${(error as Error).message}`);
      }
    }, DEBOUNCE_MS));
  }

  // Get all api:: content type UIDs
  const contentTypes = Object.keys(strapi.contentTypes).filter((uid) => uid.startsWith('api::'));

  for (const uid of contentTypes) {
    strapi.db.lifecycles.subscribe({
      models: [uid],
      ...Object.fromEntries(
        LIFECYCLE_EVENTS.map((event) => [
          event,
          () => {
            if (!connected) return;

            const modelName = normalizeModelUid(uid);
            if (!modelName) return;

            scheduleInvalidation(modelName);
          },
        ]),
      ),
    });
  }

  strapi.log.info(`[Cache] Lifecycle-based cache invalidation registered for ${contentTypes.length} content types`);

  return async () => {
    for (const timer of pendingTimers.values()) {
      clearTimeout(timer);
    }
    pendingTimers.clear();
    await redis.quit();
  };
}
