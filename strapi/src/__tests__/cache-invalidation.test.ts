import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

// Strapi → web cache invalidation (Phase 1): U2 (map completeness), U9 (no draft & publish),
// U5a–e (the bump transport and the document middleware), V2, V12, V13, V36.

/** A fake ioredis client: records every MULTI; `exec` can be held or made to fail. */
class FakeRedis extends EventEmitter {
  static instances: FakeRedis[] = [];
  status = 'ready';
  multis: string[][] = []; // tags of each executed MULTI
  hsets: Record<string, string>[] = [];
  hold: { promise: Promise<void>; release: () => void } | null = null;
  failNext = 0;

  constructor(readonly url = '', readonly options: Record<string, unknown> = {}) {
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
  async hset(_key: string, ...pairs: string[]) {
    const fields: Record<string, string> = {};
    for (let i = 0; i < pairs.length; i += 2) fields[pairs[i]] = pairs[i + 1];
    this.hsets.push(fields);
    return 1;
  }
  multi() {
    const tags: string[] = [];
    const chain = {
      hincrby: (_k: string, tag: string) => (tags.push(tag), chain),
      hset: () => chain,
      xadd: () => chain,
      exec: async () => {
        if (this.hold) await this.hold.promise;
        if (this.failNext > 0) {
          this.failNext--;
          throw new Error('Connection is closed.');
        }
        this.multis.push(tags.sort());
        return tags.map(() => [null, 1]);
      },
    };
    return chain;
  }
  holdExec() {
    let release!: () => void;
    this.hold = { promise: new Promise<void>((r) => (release = r)), release: () => { this.hold = null; release(); } };
  }
}

vi.mock('ioredis', () => ({ default: FakeRedis }));

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
let mod: typeof import('../cache-invalidation');

beforeEach(async () => {
  FakeRedis.instances = [];
  vi.clearAllMocks();
  vi.useFakeTimers();
  process.env.REDIS_URL = 'redis://redis:6379';
  vi.resetModules();
  mod = await import('../cache-invalidation');
});

afterEach(() => {
  delete process.env.REDIS_URL;
  vi.useRealTimers();
});

const STRAPI_SRC = path.resolve(__dirname, '..');

function apiContentTypes(): { name: string; schema: { options?: { draftAndPublish?: boolean } } }[] {
  const out: { name: string; schema: { options?: { draftAndPublish?: boolean } } }[] = [];
  for (const dir of readdirSync(path.join(STRAPI_SRC, 'api'))) {
    const ctDir = path.join(STRAPI_SRC, 'api', dir, 'content-types');
    if (!existsSync(ctDir)) continue;
    for (const ct of readdirSync(ctDir)) {
      out.push({ name: ct, schema: JSON.parse(readFileSync(path.join(ctDir, ct, 'schema.json'), 'utf8')) });
    }
  }
  return out;
}

describe('U2: every content type is mapped', () => {
  const map = JSON.parse(readFileSync(path.join(STRAPI_SRC, 'cache-tags.json'), 'utf8'));

  it.each(apiContentTypes().map((c) => c.name))('api::%s is in typeTags or ignored', (name) => {
    expect(name in map.typeTags || map.ignored.includes(name)).toBe(true);
  });

  it('tagsForUid', () => {
    expect(mod.tagsForUid('api::match.match')).toEqual(['match']);
    expect(mod.tagsForUid('api::category-code.category-code')).toEqual(['match', 'standing']);
    expect(mod.tagsForUid('api::social-export-state.social-export-state')).toEqual([]);
    expect(mod.tagsForUid('api::brand-new.brand-new')).toEqual(['all']);
    expect(mod.tagsForUid('plugin::upload.file')).toEqual([]);
    expect(mod.tagsForUid('plugin::users-permissions.user')).toEqual([]);
  });
});

describe('U9: no content type uses draft & publish', () => {
  // Publish/unpublish/discardDraft would need their own invalidation and status-aware reads.
  it.each(apiContentTypes().map((c) => [c.name, c.schema] as const))('%s', (_name, schema) => {
    expect(schema.options?.draftAndPublish ?? false).toBe(false);
  });
});

describe('transport', () => {
  function setup() {
    const redis = new FakeRedis();
    const transport = mod.createTransport(() => redis as never, log as never);
    return { redis, transport };
  }

  it('U5a: a burst of writes is one MULTI per flush (debounced, ≥1 s quiet)', async () => {
    const { redis, transport } = setup();
    for (let i = 0; i < 50; i++) transport.enqueue(['match'], 'update api::match.match');
    transport.enqueue(['standing'], 'update api::standing.standing');

    await vi.advanceTimersByTimeAsync(999);
    expect(redis.multis).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(redis.multis).toEqual([['match', 'standing']]);
    expect(log.info).toHaveBeenCalledWith(expect.stringMatching(/\[Cache\] bumped tags=match,standing lag_ms=\d+/));
  });

  it('U5b: a continuous write stream is flushed at most 5 s after its first write', async () => {
    const { redis, transport } = setup();
    for (let t = 0; t < 8000; t += 500) {
      transport.enqueue(['match'], 'update');
      await vi.advanceTimersByTimeAsync(500);
      if (redis.multis.length > 0) {
        expect(t).toBeLessThanOrEqual(mod.MAX_LATENCY_MS);
        return;
      }
    }
    throw new Error('never flushed');
  });

  it('U5c: a failed flush keeps its tags and retries with backoff (1 s, 2 s, …)', async () => {
    const { redis, transport } = setup();
    redis.failNext = 2;
    transport.enqueue(['player'], 'update');

    await vi.advanceTimersByTimeAsync(1000); // flush 1 fails
    expect(transport.state()).toMatchObject({ pending: ['player'], failTotal: 1, retrying: true });
    await vi.advanceTimersByTimeAsync(1000); // retry after 1 s fails
    expect(transport.state().failTotal).toBe(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(redis.multis).toEqual([]);
    await vi.advanceTimersByTimeAsync(1); // retry after 2 s succeeds
    expect(redis.multis).toEqual([['player']]);
    expect(transport.state()).toMatchObject({ pending: [], retrying: false, backoff: 1000 });
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('[Cache] tag bump FAILED tags=player'));
  });

  it('V36: writes during a Redis outage do not grow the backoff; `ready` flushes at once', async () => {
    const { redis, transport } = setup();
    redis.status = 'reconnecting';
    transport.enqueue(['match'], 'update');
    await vi.advanceTimersByTimeAsync(1000); // fails: Redis reconnecting
    expect(transport.state().failTotal).toBe(1);

    for (let i = 0; i < 20; i++) {
      transport.enqueue(['match'], 'update'); // a sync keeps writing
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(transport.state().failTotal).toBe(2); // only the 1 s backoff timer retried, not every write
    expect(transport.state().backoff).toBe(4000);

    redis.status = 'ready';
    transport.onRedisReady();
    await vi.advanceTimersByTimeAsync(0);
    expect(redis.multis).toEqual([['match']]);
    expect(transport.state()).toMatchObject({ pending: [], backoff: 1000, retrying: false });
  });

  it('U5d / V2: a write committed during the EXEC gets its own later bump', async () => {
    const { redis, transport } = setup();
    transport.enqueue(['match'], 'W1');
    redis.holdExec();
    await vi.advanceTimersByTimeAsync(1000); // flush 1 in flight (EXEC held)
    transport.enqueue(['match'], 'W2'); // same tag, during the EXEC
    redis.hold!.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(redis.multis).toEqual([['match']]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(redis.multis).toEqual([['match'], ['match']]); // W2's bump was not lost
  });

  it('U5d / V2: also when the EXEC during which W2 committed fails', async () => {
    const { redis, transport } = setup();
    transport.enqueue(['match'], 'W1');
    redis.holdExec();
    redis.failNext = 1;
    await vi.advanceTimersByTimeAsync(1000);
    transport.enqueue(['standing'], 'W2');
    redis.hold!.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(transport.state().pending.sort()).toEqual(['match', 'standing']);

    await vi.advanceTimersByTimeAsync(1000);
    expect(redis.multis).toEqual([['match', 'standing']]);
  });

  it('V13: a media.delete is never bumped within 1 s of its event (emitted before the row is deleted)', async () => {
    const { redis, transport } = setup();
    for (let t = 0; t < 4500; t += 500) {
      transport.enqueue(['player'], 'update');
      await vi.advanceTimersByTimeAsync(500);
    }
    redis.multis = [];
    transport.enqueue(['player'], 'update');
    await vi.advanceTimersByTimeAsync(4100); // the stream's first write is now >4 s old
    transport.enqueue(['media'], 'media.delete');
    await vi.advanceTimersByTimeAsync(999);
    expect(redis.multis.flat()).not.toContain('media');
    await vi.advanceTimersByTimeAsync(1);
    expect(redis.multis.flat()).toContain('media');
  });

  it('heartbeat: writes the transport state; skipped (and so visibly stale) while Redis is down', async () => {
    const { redis, transport } = setup();
    redis.status = 'reconnecting';
    transport.enqueue(['match'], 'update');
    await transport.heartbeat();
    expect(redis.hsets).toEqual([]);

    redis.status = 'ready';
    await transport.heartbeat();
    expect(redis.hsets[0]).toMatchObject({ pending: '1', fail_total: '0' });
    expect(Number(redis.hsets[0].hb_at)).toBeGreaterThan(0);
    expect(Number(redis.hsets[0].oldest_pending_at)).toBeGreaterThan(0);
  });
});

type Middleware = (context: { action: string; uid: string }, next: () => Promise<unknown>) => Promise<unknown>;

function fakeStrapi(opts: { inTransaction?: boolean } = {}) {
  const middlewares: Middleware[] = [];
  const listeners = new Map<string, () => Promise<void>>();
  const commitCallbacks: (() => void)[] = [];
  return {
    middlewares,
    listeners,
    commitCallbacks,
    documents: { use: (mw: Middleware) => middlewares.push(mw) },
    db: {
      inTransaction: () => opts.inTransaction ?? false,
      transaction: vi.fn(async (cb: (p: { onCommit: (f: () => void) => void }) => Promise<void>) =>
        cb({ onCommit: (f) => commitCallbacks.push(f) }),
      ),
    },
    eventHub: { on: (event: string, listener: () => Promise<void>) => listeners.set(event, listener) },
    log,
  };
}

describe('U5e: document middleware and wiring', () => {
  async function boot(opts: { inTransaction?: boolean } = {}) {
    const strapi = fakeStrapi(opts);
    mod.registerCacheMiddleware(strapi as never);
    mod.connectCacheRedis(strapi as never);
    await vi.advanceTimersByTimeAsync(1000); // flush the boot `all`
    const redis = FakeRedis.instances[0];
    redis.multis = [];
    return { strapi, redis };
  }

  it('bootstrap bumps `all` (crash recovery, bootstrap/SQL writes)', async () => {
    const strapi = fakeStrapi();
    mod.registerCacheMiddleware(strapi as never);
    mod.connectCacheRedis(strapi as never);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeRedis.instances[0].multis).toEqual([['all']]);
  });

  it.each(['create', 'update', 'delete', 'clone', 'publish', 'unpublish', 'discardDraft'])('%s enqueues the type\'s tags', async (action) => {
    const { strapi, redis } = await boot();
    const next = vi.fn(async () => ({ documentId: 'd1' }));

    expect(await strapi.middlewares[0]({ action, uid: 'api::page.page' }, next)).toEqual({ documentId: 'd1' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(redis.multis).toEqual([['page']]);
  });

  it.each(['findMany', 'findFirst', 'findOne', 'count'])('%s does not', async (action) => {
    const { strapi, redis } = await boot();
    await strapi.middlewares[0]({ action, uid: 'api::page.page' }, async () => []);
    await vi.advanceTimersByTimeAsync(5000);
    expect(redis.multis).toEqual([]);
  });

  it('writes to ignored and plugin types bump nothing', async () => {
    const { strapi, redis } = await boot();
    await strapi.middlewares[0]({ action: 'create', uid: 'api::social-export-state.social-export-state' }, async () => ({}));
    await strapi.middlewares[0]({ action: 'update', uid: 'plugin::users-permissions.user' }, async () => ({}));
    await vi.advanceTimersByTimeAsync(5000);
    expect(redis.multis).toEqual([]);
  });

  it('V12: inside an outer transaction the bump waits for the OUTER commit', async () => {
    const { strapi, redis } = await boot({ inTransaction: true });
    await strapi.middlewares[0]({ action: 'delete', uid: 'api::match.match' }, async () => ({}));
    await vi.advanceTimersByTimeAsync(5000);
    expect(redis.multis).toEqual([]); // not committed yet
    expect(strapi.db.transaction).toHaveBeenCalledTimes(1);

    strapi.commitCallbacks.forEach((f) => f()); // the outer transaction commits
    await vi.advanceTimersByTimeAsync(1000);
    expect(redis.multis).toEqual([['match']]);
  });

  it.each(['media.create', 'media.update', 'media.delete'])('%s bumps media', async (event) => {
    const { strapi, redis } = await boot();
    await strapi.listeners.get(event)!();
    await vi.advanceTimersByTimeAsync(1000);
    expect(redis.multis).toEqual([['media']]);
  });

  it('after `end`, a fresh client is created and the next bump goes through it', async () => {
    const { strapi } = await boot();
    FakeRedis.instances[0].disconnect();
    expect(FakeRedis.instances).toHaveLength(2);

    await strapi.middlewares[0]({ action: 'update', uid: 'api::player.player' }, async () => ({}));
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeRedis.instances[1].multis).toEqual([['player']]);
  });

  it('the Redis `ready` event flushes what queued while Redis was away', async () => {
    const { strapi, redis } = await boot();
    redis.status = 'reconnecting';
    await strapi.middlewares[0]({ action: 'update', uid: 'api::team.team' }, async () => ({}));
    await vi.advanceTimersByTimeAsync(1000); // fails
    redis.status = 'ready';
    redis.emit('ready');
    await vi.advanceTimersByTimeAsync(0);
    expect(redis.multis).toEqual([['team']]);
  });

  it('shutdown flushes what is pending and does not recreate the client', async () => {
    const strapi = fakeStrapi();
    mod.registerCacheMiddleware(strapi as never);
    const cleanup = mod.connectCacheRedis(strapi as never)!;
    await cleanup();
    expect(FakeRedis.instances[0].multis).toEqual([['all']]);
    expect(FakeRedis.instances).toHaveLength(1);
  });
});

describe('Redis client options', () => {
  it('match the web client (packages/cache)', async () => {
    const web = await import('../../../packages/cache/src/redis');
    const { retryStrategy: strapiRetry, ...strapiRest } = mod.REDIS_CLIENT_OPTIONS;
    const { retryStrategy: webRetry, ...webRest } = web.REDIS_CLIENT_OPTIONS;
    expect(strapiRest).toEqual(webRest);
    for (const attempt of [1, 3, 4, 50, 10_000]) expect(strapiRetry(attempt)).toBe(webRetry(attempt));
  });
});
