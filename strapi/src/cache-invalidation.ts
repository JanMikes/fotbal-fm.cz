import type { Core } from '@strapi/strapi';
import Redis from 'ioredis';
import TAG_MAP from './cache-tags.json';

/*
 * Strapi → web data cache invalidation (fotbal-fm web-cache plan Phase 1, lily D75).
 *
 * The web caches every Strapi response under tag generations (packages/cache/src/swr.ts). This
 * module bumps the generations of the tags of every content type Strapi writes, AFTER the write
 * committed, through a small transport:
 * - every non-read Document Service action (create/update/delete/clone/publish/…) and every
 *   upload event (media.create/update/delete) enqueues tags; reads never do;
 * - writes are debounced (≥1 s quiet, ≤5 s from the first queued write), so a sync run of 500
 *   PUTs is one bump per tag; one MULTI per flush: HINCRBY tagver, HSET tagts, an audit stream
 *   entry and the transport's own status;
 * - a failed flush re-queues its tags and retries with backoff (1 s → 60 s); the client's `ready`
 *   event retries at once, so a Redis outage delays bumps by ~the reconnect, not by the backoff;
 * - Strapi's boot bumps `all` (anything written by SQL/bootstrap, or queued by a Strapi that
 *   crashed before flushing);
 * - a heartbeat (30 s) writes the transport state to fotbalfm:v2:transport, which web exports
 *   as metrics (Strapi has no metrics endpoint).
 * A lost bump (Redis down for good, hook-less SQL) is bounded by the web's 5-min soft TTL.
 */

export const TAGVER = 'fotbalfm:v2:tagver';
export const TAGTS = 'fotbalfm:v2:tagts';
export const TRANSPORT = 'fotbalfm:v2:transport';
export const INVLOG = 'fotbalfm:v2:invlog';

/** Document Service actions that never write. Everything else is a write (an unknown future action too). */
const READ_ACTIONS = new Set(['findMany', 'findFirst', 'findOne', 'count']);

export const QUIET_MS = 1000;
export const MAX_LATENCY_MS = 5000;
const MAX_BACKOFF_MS = 60_000;
const HEARTBEAT_MS = 30_000;
const PENDING_WARN_MS = 120_000;

/**
 * Tags to bump for a write to `uid` — the same map the web reads by (cache-tags.json is a
 * byte-identical copy of packages/cache/src/type-tags.json, test U2b). Types the web never reads
 * bump nothing; an api:: type missing from the map bumps `all`; plugin/admin types bump nothing.
 */
export function tagsForUid(uid: string): string[] {
  if (!uid.startsWith('api::')) return [];
  const name = uid.slice('api::'.length).split('.')[0];
  if (TAG_MAP.ignored.includes(name)) return [];
  return (TAG_MAP.typeTags as Record<string, string[]>)[name] ?? ['all'];
}

/**
 * Same options as the web's client (packages/cache/src/redis.ts; Strapi is not an npm workspace,
 * hence the copy — a test keeps them equal). Reconnects forever, fails commands fast while
 * disconnected, 500 ms per command.
 */
export const REDIS_CLIENT_OPTIONS = {
  lazyConnect: true,
  retryStrategy: (times: number) => Math.min(times * 200, 5000),
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 2000,
  commandTimeout: 500,
};

type Logger = Pick<Core.Strapi['log'], 'info' | 'warn' | 'error' | 'debug'>;

export interface Transport {
  enqueue(tags: string[], source: string): void;
  /** The Redis client became ready: retry anything pending now, with a fresh backoff (V36). */
  onRedisReady(): void;
  heartbeat(): Promise<void>;
  /** Final flush attempt on shutdown. */
  stop(): Promise<void>;
  state(): { pending: string[]; failTotal: number; backoff: number; retrying: boolean; inFlight: boolean };
}

export function createTransport(redis: () => Redis | null, log: Logger): Transport {
  const pending = new Set<string>();
  let firstAt = 0; // when the oldest pending tag was queued
  let notBefore = 0; // a media.delete must not be bumped within QUIET_MS of its event
  let timer: NodeJS.Timeout | null = null;
  let inFlight = false;
  let retrying = false; // a failed flush armed a backoff timer: writes don't advance it (V36)
  let backoff = 1000;
  let failTotal = 0;

  function arm(wait: number): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, Math.max(0, wait));
  }

  /** ≥1 s of quiet, but at most MAX_LATENCY_MS after the oldest queued write. */
  function scheduleDebounced(): void {
    if (inFlight || retrying || pending.size === 0) return;
    const now = Date.now();
    const wait = now - firstAt >= MAX_LATENCY_MS - QUIET_MS ? 0 : QUIET_MS;
    arm(Math.max(wait, notBefore - now));
  }

  async function flush(): Promise<void> {
    if (inFlight || pending.size === 0) return;
    // V2: snapshot and clear BEFORE awaiting, so a write committed during the EXEC queues a new bump.
    const tags = [...pending];
    pending.clear();
    const queuedAt = firstAt;
    firstAt = 0;
    inFlight = true;
    let ok = false;
    try {
      const client = redis();
      if (!client || client.status !== 'ready') throw new Error(`Redis ${client?.status ?? 'unavailable'}`);
      const now = Date.now();
      const m = client.multi();
      for (const tag of tags) {
        m.hincrby(TAGVER, tag, 1);
        m.hset(TAGTS, tag, String(now));
      }
      m.xadd(INVLOG, 'MAXLEN', '~', '5000', '*', 'tags', tags.join(','), 'lag_ms', String(now - queuedAt));
      m.hset(TRANSPORT, 'ok_at', String(now), 'hb_at', String(now), 'pending', '0', 'oldest_pending_at', '0', 'fail_total', String(failTotal));
      const results = await m.exec();
      if (!results) throw new Error('MULTI aborted');
      const failed = results.find(([error]) => error);
      if (failed) throw failed[0];
      ok = true;
      retrying = false;
      backoff = 1000;
      log.info(`[Cache] bumped tags=${tags.join(',')} lag_ms=${now - queuedAt}`);
    } catch (error) {
      for (const tag of tags) pending.add(tag); // re-queue the snapshot (writes during the EXEC are already there)
      firstAt = firstAt === 0 ? queuedAt || Date.now() : Math.min(firstAt, queuedAt || firstAt);
      failTotal++;
      retrying = true;
      log.error(`[Cache] tag bump FAILED tags=${tags.join(',')} retry_in=${backoff}ms: ${(error as Error).message}`);
      arm(backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    } finally {
      inFlight = false;
    }
    if (ok) scheduleDebounced(); // writes that committed during the EXEC
  }

  return {
    enqueue(tags, source) {
      if (tags.length === 0) return;
      const now = Date.now();
      if (pending.size === 0) firstAt = now;
      if (source === 'media.delete') notBefore = Math.max(notBefore, now + QUIET_MS); // V13: emitted before the row is deleted
      for (const tag of tags) pending.add(tag);
      log.debug(`[Cache] queued ${tags.join(',')} (${source})`);
      scheduleDebounced();
    },
    onRedisReady() {
      if (pending.size === 0 || inFlight) return;
      retrying = false;
      backoff = 1000;
      arm(Math.max(0, notBefore - Date.now()));
    },
    async heartbeat() {
      const client = redis();
      const age = pending.size > 0 ? Date.now() - firstAt : 0;
      if (age > PENDING_WARN_MS) log.warn(`[Cache] tag bumps pending for ${Math.round(age / 1000)}s: ${[...pending].join(',')}`);
      if (!client || client.status !== 'ready') return; // a missing heartbeat IS the signal (FotbalFmCacheTransportStale)
      await client
        .hset(TRANSPORT, 'hb_at', String(Date.now()), 'pending', String(pending.size), 'oldest_pending_at', pending.size > 0 ? String(firstAt) : '0', 'fail_total', String(failTotal))
        .catch(() => {});
    },
    async stop() {
      if (timer) clearTimeout(timer);
      timer = null;
      retrying = false;
      await flush();
    },
    state() {
      return { pending: [...pending], failTotal, backoff, retrying, inFlight };
    },
  };
}

// --- wiring into Strapi --------------------------------------------------------------------

let client: Redis | null = null;
let shuttingDown = false;
let strapiLog: Logger | null = null;
const transport = createTransport(() => client, {
  info: (m: string) => strapiLog?.info(m),
  warn: (m: string) => strapiLog?.warn(m),
  error: (m: string) => strapiLog?.error(m),
  debug: (m: string) => strapiLog?.debug(m),
} as Logger);

function createClient(strapi: Core.Strapi, redisUrl: string): Redis | null {
  let redis: Redis;
  try {
    redis = new Redis(redisUrl, REDIS_CLIENT_OPTIONS);
  } catch (error) {
    strapi.log.error(`[Cache] Failed to create Redis client: ${(error as Error).message}`);
    return null;
  }
  redis.on('error', (err) => strapi.log.error(`[Cache] Redis error: ${err.message}`));
  redis.on('ready', () => {
    strapi.log.info('[Cache] Redis connected');
    transport.onRedisReady();
  });
  // `end` = never reconnects (explicit quit, or a failure ioredis cannot retry): use a fresh client.
  redis.on('end', () => {
    if (client !== redis) return;
    client = null;
    if (!shuttingDown) client = createClient(strapi, redisUrl);
  });
  redis.connect().catch(() => {
    // first attempt failed; ioredis keeps retrying in the background, `ready` flushes
  });
  return redis;
}

/** For tests: the module's transport. */
export function __transport(): Transport {
  return transport;
}

/**
 * Register the document service middleware — must be called in register(), before bootstrap
 * writes anything.
 */
export function registerCacheMiddleware(strapi: Core.Strapi): void {
  strapiLog = strapi.log;
  if (!process.env.REDIS_URL) {
    strapi.log.warn('[Cache] REDIS_URL not set, cache invalidation disabled');
    return;
  }

  strapi.documents.use(async (context, next) => {
    const result = await next();
    if (READ_ACTIONS.has(context.action)) return result;
    const tags = tagsForUid(context.uid);
    if (tags.length === 0) return result;

    const enqueue = () => transport.enqueue(tags, `${context.action} ${context.uid}`);
    if (strapi.db.inTransaction()) {
      // V12: inside an outer transaction (content-manager bulk actions) the write is not committed
      // yet: queue the bump for the OUTER commit. Re-entering transaction() reuses that same trx.
      await strapi.db.transaction(async ({ onCommit }) => {
        onCommit(enqueue);
      });
    } else {
      enqueue(); // the repository's own transaction has committed when next() resolves
    }
    return result;
  });

  strapi.log.info('[Cache] Document service middleware registered');
}

/**
 * Connect to Redis, subscribe to upload events, bump `all` for this boot and start the heartbeat
 * — called in bootstrap(). Returns the shutdown hook.
 */
export function connectCacheRedis(strapi: Core.Strapi): (() => Promise<void>) | null {
  strapiLog = strapi.log;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  shuttingDown = false;
  client = createClient(strapi, redisUrl);

  // Uploads write files with no Document Service call (upload-to-entity, replace, alt text).
  for (const event of ['media.create', 'media.update', 'media.delete'] as const) {
    strapi.eventHub.on(event, async () => transport.enqueue(['media'], event));
  }
  transport.enqueue(['all'], 'bootstrap'); // crash recovery + anything bootstrap or SQL wrote

  const heartbeat = setInterval(() => void transport.heartbeat(), HEARTBEAT_MS);
  heartbeat.unref();

  return async () => {
    clearInterval(heartbeat);
    shuttingDown = true;
    await transport.stop();
    const redis = client;
    client = null;
    if (!redis) return;
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  };
}
