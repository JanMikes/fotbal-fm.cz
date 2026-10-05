import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Phase 0 stopgaps in the Strapi → Redis invalidation (P0-3, P0-6). Phase 1 replaces the module.

/** Records SCAN patterns; every pattern matches one key, which DEL "deletes". */
class FakeRedis extends EventEmitter {
  static instances: FakeRedis[] = [];
  status = 'ready';
  scanned: string[] = [];
  deleted: string[] = [];
  failCommands = false;

  constructor(readonly url: string, readonly options: Record<string, unknown>) {
    super();
    FakeRedis.instances.push(this);
  }

  async connect() {}
  async quit() {
    this.status = 'end';
    this.emit('end');
    return 'OK';
  }
  disconnect() {
    this.status = 'end';
    this.emit('end');
  }

  async scan(_cursor: string, _match: string, pattern: string) {
    if (this.failCommands) throw new Error("Stream isn't writeable and enableOfflineQueue options is false");
    this.scanned.push(pattern);
    return ['0', [pattern.replace('*', 'x')]];
  }

  async del(...keys: string[]) {
    this.deleted.push(...keys);
    return keys.length;
  }
}

vi.mock('ioredis', () => ({ default: FakeRedis }));

type Middleware = (context: { action: string; uid: string }, next: () => Promise<unknown>) => Promise<unknown>;

function fakeStrapi() {
  const middlewares: Middleware[] = [];
  return {
    middlewares,
    documents: { use: (mw: Middleware) => middlewares.push(mw) },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
}

let mod: typeof import('../cache-invalidation');

beforeEach(async () => {
  FakeRedis.instances = [];
  process.env.REDIS_URL = 'redis://redis:6379';
  vi.resetModules();
  mod = await import('../cache-invalidation');
});

afterEach(() => {
  delete process.env.REDIS_URL;
  vi.useRealTimers();
});

describe('invalidateModel (P0-6 map)', () => {
  async function patternsFor(model: string): Promise<string[]> {
    const redis = new FakeRedis('', {});
    await mod.invalidateModel(redis as never, model);
    return redis.scanned;
  }

  it('page also clears navigation, footer, partner details, the nav page list and the slug index', async () => {
    expect(await patternsFor('page')).toEqual(expect.arrayContaining([
      'fotbalfm:page:*',
      'fotbalfm:page-slugs:*',
      'fotbalfm:navigation-pages:*',
      'fotbalfm:navigation:*',
      'fotbalfm:footer:*',
      'fotbalfm:partner:*',
    ]));
  });

  it('news-article also clears the category hero (slide 3 shows an article)', async () => {
    expect(await patternsFor('news-article')).toContain('fotbalfm:category-hero:*');
  });

  it('category also clears the category slug index', async () => {
    expect(await patternsFor('category')).toContain('fotbalfm:category-slugs:*');
  });

  it.each(['social-export-state', 'comment', 'event', 'deep-link-claim'])(
    '%s (not read by the web) clears nothing — no full flush',
    async (model) => {
      expect(await patternsFor(model)).toEqual([]);
    },
  );

  it('a model missing from the map still clears everything', async () => {
    expect(await patternsFor('something-new')).toEqual(['fotbalfm:*']);
  });

  it('every api:: content type the web reads is mapped (no accidental full clears)', () => {
    for (const model of ['category', 'category-group', 'news-article', 'news-article-type', 'match', 'player',
      'standing', 'navigation', 'footer', 'page', 'partner', 'player-highlight', 'tournament', 'team',
      'audience-category', 'deep-link']) {
      expect(mod.MODEL_CACHE_PATTERNS).toHaveProperty([model]);
    }
  });
});

describe('document middleware', () => {
  async function runWrite(action: string, uid: string) {
    vi.useFakeTimers();
    const strapi = fakeStrapi();
    mod.registerCacheMiddleware(strapi as never);
    mod.connectCacheRedis(strapi as never);
    const next = vi.fn(async () => ({ documentId: 'd1' }));

    const result = await strapi.middlewares[0]({ action, uid }, next);
    await vi.advanceTimersByTimeAsync(2000);
    return { strapi, result, next, redis: FakeRedis.instances[0] };
  }

  it('clone schedules an invalidation (it creates an entry)', async () => {
    const { redis, result, next } = await runWrite('clone', 'api::page.page');

    expect(next).toHaveBeenCalledOnce();
    expect(result).toEqual({ documentId: 'd1' });
    expect(redis.scanned).toContain('fotbalfm:page:*');
  });

  it.each(['create', 'update', 'delete'])('%s schedules an invalidation', async (action) => {
    const { redis } = await runWrite(action, 'api::match.match');
    expect(redis.scanned).toContain('fotbalfm:matches:*');
  });

  it('reads do not invalidate', async () => {
    const { redis } = await runWrite('findMany', 'api::match.match');
    expect(redis.scanned).toEqual([]);
  });

  it('plugin content types are ignored', async () => {
    const { redis } = await runWrite('update', 'plugin::users-permissions.user');
    expect(redis.scanned).toEqual([]);
  });

  it('a write while Redis is unreachable is attempted and the failure logged (no silent skip)', async () => {
    vi.useFakeTimers();
    const strapi = fakeStrapi();
    mod.registerCacheMiddleware(strapi as never);
    mod.connectCacheRedis(strapi as never);
    const redis = FakeRedis.instances[0];
    redis.status = 'reconnecting';
    redis.failCommands = true;

    await strapi.middlewares[0]({ action: 'update', uid: 'api::match.match' }, async () => null);
    await vi.advanceTimersByTimeAsync(2000);

    expect(strapi.log.error).toHaveBeenCalledWith(expect.stringContaining('[Cache] Failed to invalidate match'));
  });
});

describe('Redis client (P0-3)', () => {
  it('uses the same options as the web client (packages/cache)', async () => {
    const web = await import('../../../packages/cache/src/redis');
    const { retryStrategy: strapiRetry, ...strapiRest } = mod.REDIS_CLIENT_OPTIONS;
    const { retryStrategy: webRetry, ...webRest } = web.REDIS_CLIENT_OPTIONS;

    expect(strapiRest).toEqual(webRest);
    for (const attempt of [1, 3, 4, 50, 10_000]) {
      expect(strapiRetry(attempt)).toBe(webRetry(attempt));
    }
  });

  it('never gives up reconnecting and bounds command time', () => {
    const { retryStrategy } = mod.REDIS_CLIENT_OPTIONS;
    for (const attempt of [4, 100, 10_000]) expect(retryStrategy(attempt)).toBeLessThanOrEqual(5000);
    expect(mod.REDIS_CLIENT_OPTIONS).toMatchObject({ enableOfflineQueue: false, commandTimeout: 500, connectTimeout: 2000 });
  });

  it('after `end` the next invalidation creates a new client', async () => {
    vi.useFakeTimers();
    const strapi = fakeStrapi();
    mod.registerCacheMiddleware(strapi as never);
    mod.connectCacheRedis(strapi as never);
    const first = FakeRedis.instances[0];
    first.disconnect(); // simulated `end`

    await strapi.middlewares[0]({ action: 'update', uid: 'api::player.player' }, async () => null);
    await vi.advanceTimersByTimeAsync(2000);

    expect(FakeRedis.instances).toHaveLength(2);
    expect(FakeRedis.instances[1].scanned).toContain('fotbalfm:players:*');
  });

  it('shutdown closes the client and does not recreate it', async () => {
    const strapi = fakeStrapi();
    const cleanup = mod.connectCacheRedis(strapi as never);
    await cleanup!();

    expect(FakeRedis.instances[0].status).toBe('end');
    expect(FakeRedis.instances).toHaveLength(1);
  });
});
