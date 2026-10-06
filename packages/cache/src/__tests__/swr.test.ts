import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// U3 / U3h / U3i: the v2 data cache (`cached()`), plus the Phase 0 failure semantics it keeps
// (onError only for upstream failures, the failure memo, auth errors never empty).

class FakeRedis {
  strings = new Map<string, { value: string; ex?: number }>();
  hashes = new Map<string, Map<string, string>>();
  async get(key: string) {
    return this.strings.get(key)?.value ?? null;
  }
  async set(key: string, value: string, _ex?: string, ttl?: number) {
    this.strings.set(key, { value, ex: ttl });
    return 'OK';
  }
  async exists(key: string) {
    return this.strings.has(key) ? 1 : 0;
  }
  async hgetall(key: string) {
    return Object.fromEntries(this.hashes.get(key) ?? []);
  }
  hincrbySync(key: string, field: string, by = 1) {
    const h = this.hashes.get(key) ?? new Map<string, string>();
    h.set(field, String(Number(h.get(field) ?? 0) + by));
    this.hashes.set(key, h);
  }
  hsetSync(key: string, field: string, value: string) {
    const h = this.hashes.get(key) ?? new Map<string, string>();
    h.set(field, value);
    this.hashes.set(key, h);
  }
  multi() {
    const ops: (() => void)[] = [];
    const chain = {
      hincrby: (k: string, f: string, by: number) => (ops.push(() => this.hincrbySync(k, f, by)), chain),
      hset: (k: string, f: string, v: string) => (ops.push(() => this.hsetSync(k, f, v)), chain),
      exec: async () => ops.map((op) => (op(), [null, 'OK'])),
    };
    return chain;
  }
}

let fake = new FakeRedis();
let redisUp = true;
vi.mock('../redis', () => ({ getRedisClient: vi.fn(async () => (redisUp ? fake : null)) }));

const swr = await import('../swr');
const { cached, hasEntry, bumpTags, entryKey, TAGVER, FOREGROUND_BUDGET_MS, FAILURE_MEMO_MS, NO_REDIS_MEMO_MS, __resetSwrState, __swrStateSize } = swr;
const { UpstreamError, UpstreamAuthError } = await import('../errors');
const { setMetricsSink } = await import('../metrics');

const results: string[] = [];
setMetricsSink({ cacheRequest: (_fn, result) => results.push(result), strapiRequest: () => {} });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const URL_ = '/api/matches?filters[categories][slug][$eq]=muzi-a';
const read = (load: () => Promise<string>, extra: Partial<import('../swr').CachedOptions<string>> = {}) =>
  cached<string>({ fn: 'getMatches', url: URL_, tags: ['match', 'category'], load, ...extra });
const bump = (tag: string) => {
  fake.hincrbySync(TAGVER, tag);
  vi.setSystemTime(Date.now() + 300); // past the 250 ms tag memo
};
const stored = async () => JSON.parse(fake.strings.get(await entryKey('getMatches', URL_))!.value);

beforeEach(() => {
  fake = new FakeRedis();
  redisUp = true;
  results.length = 0;
  __resetSwrState();
  delete process.env.DATA_CACHE_MODE;
  delete process.env.DATA_CACHE_SOFT_TTL_MS;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-06T10:00:00Z'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('cached() — v2 tag generations', () => {
  it('a miss loads once, stores the raw value stamped with the generations at load start, EX 7 d', async () => {
    fake.hincrbySync(TAGVER, 'match', 3);
    const load = vi.fn(async () => 'v1');

    expect(await read(load)).toBe('v1');
    const entry = await stored();
    expect(entry.v).toBe('v1');
    expect(entry.tv).toEqual({ match: 3, category: 0, all: 0 });
    expect(fake.strings.get(await entryKey('getMatches', URL_))!.ex).toBe(7 * 24 * 3600);
    expect(results).toEqual(['miss']);
  });

  it('the key is fotbalfm:v2:d:<fn>:<sha1 of the URL>', async () => {
    expect(await entryKey('getMatches', 'abc')).toBe('fotbalfm:v2:d:getMatches:a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('a fresh entry of the current generation is a hit (no load)', async () => {
    await read(async () => 'v1');
    const load = vi.fn(async () => 'v2');

    expect(await read(load)).toBe('v1');
    expect(load).not.toHaveBeenCalled();
    expect(results.at(-1)).toBe('hit');
  });

  it('50 concurrent misses share one load', async () => {
    const gate = deferred<string>();
    const load = vi.fn(() => gate.promise);
    const reads = Array.from({ length: 50 }, () => read(load));
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    gate.resolve('v1');

    expect(new Set(await Promise.all(reads))).toEqual(new Set(['v1']));
    expect(load).toHaveBeenCalledTimes(1);
    expect(__swrStateSize().flights).toBe(0);
  });

  it('a bump of any of its tags invalidates: the next read refreshes in the foreground', async () => {
    await read(async () => 'v1');
    bump('category');

    expect(await read(async () => 'v2')).toBe('v2');
    expect(results.at(-1)).toBe('invalidated');
    expect((await stored()).v).toBe('v2');
  });

  it('a bump of an unrelated tag does not', async () => {
    await read(async () => 'v1');
    bump('player');
    const load = vi.fn(async () => 'v2');

    expect(await read(load)).toBe('v1');
    expect(load).not.toHaveBeenCalled();
  });

  it('`all` is always implied', async () => {
    await read(async () => 'v1');
    bump('all');
    expect(await read(async () => 'v2')).toBe('v2');
  });

  it('`!==`, not `>`: a reset counter (Redis restart, deleted hash) also invalidates (V11)', async () => {
    fake.hincrbySync(TAGVER, 'match', 5);
    await read(async () => 'v1');
    fake.hashes.delete(TAGVER);
    vi.setSystemTime(Date.now() + 300);

    expect(await read(async () => 'v2')).toBe('v2');
  });

  it('soft TTL: an old entry is served once more while ONE background load refreshes it', async () => {
    process.env.DATA_CACHE_SOFT_TTL_MS = '300000';
    await read(async () => 'v1');
    vi.setSystemTime(Date.now() + 300_001);
    const gate = deferred<string>();
    const load = vi.fn(() => gate.promise);

    expect(await read(load)).toBe('v1');
    expect(await read(load)).toBe('v1');
    expect(load).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r === 'soft_stale')).toHaveLength(2);
    gate.resolve('v2');
    await vi.waitFor(async () => expect((await stored()).v).toBe('v2'));
  });

  it('stale-write race: a write during the load leaves an older stamp, so the next read reloads', async () => {
    const gate = deferred<string>();
    const first = read(() => gate.promise); // starts at match=0
    await vi.waitFor(() => expect(__swrStateSize().flights).toBe(1));
    bump('match'); // Strapi committed a write while Strapi was answering the old data
    gate.resolve('pre-write data');
    expect(await first).toBe('pre-write data');
    expect((await stored()).tv.match).toBe(0); // stamped with the generation it was loaded at

    expect(await read(async () => 'post-write data')).toBe('post-write data');
  });

  it('U3h: a reader at a newer generation does not join a load that started before the bump (V9)', async () => {
    const gateA = deferred<string>();
    const loadA = vi.fn(() => gateA.promise);
    const readerA = read(loadA); // gen 0, miss
    await vi.waitFor(() => expect(loadA).toHaveBeenCalledTimes(1));
    bump('match');
    const loadB = vi.fn(async () => 'gen-1 data');

    expect(await read(loadB)).toBe('gen-1 data'); // its own load, not A's
    expect(loadB).toHaveBeenCalledTimes(1);
    gateA.resolve('gen-0 data');
    expect(await readerA).toBe('gen-0 data');
  });

  it(`U3i: an invalidated read with a slow refresh returns the stale value after ${FOREGROUND_BUDGET_MS} ms; the entry is updated when it finishes (V10)`, async () => {
    await read(async () => 'v1');
    bump('match');
    const gate = deferred<string>();

    const started = performance.now();
    expect(await read(() => gate.promise)).toBe('v1');
    const waited = performance.now() - started;
    expect(waited).toBeGreaterThanOrEqual(FOREGROUND_BUDGET_MS - 50);
    expect(waited).toBeLessThan(FOREGROUND_BUDGET_MS + 1000);
    expect(results).toContain('budget_exceeded');

    gate.resolve('v2');
    await vi.waitFor(async () => expect((await stored()).v).toBe('v2'));
  });
});

describe('cached() — failures', () => {
  const upstream = () => new UpstreamError('Strapi matches: HTTP 503');

  it('stale-if-error: an invalidated entry whose refresh fails upstream is served', async () => {
    await read(async () => 'v1');
    bump('match');

    expect(await read(async () => { throw upstream(); })).toBe('v1');
    expect(results.at(-1)).toBe('stale_if_error');
  });

  it('C-V3: Strapi hung — only the first reader of an invalidated entry waits the budget; the rest get the stale copy at once, also while the memo is open after the refresh failed', async () => {
    await read(async () => 'v1');
    bump('match');
    const hung = deferred<string>();
    const load = vi.fn(() => hung.promise);

    // the first reader waits the budget (nothing is known yet), then gets the stale copy
    let started = performance.now();
    expect(await read(load)).toBe('v1');
    expect(performance.now() - started).toBeGreaterThanOrEqual(FOREGROUND_BUDGET_MS - 50);

    // while that refresh is still running, nobody waits for it again and no second load starts
    started = performance.now();
    for (let i = 0; i < 20; i++) expect(await read(load)).toBe('v1');
    expect(performance.now() - started).toBeLessThan(200);
    expect(load).toHaveBeenCalledTimes(1);
    expect(__swrStateSize().slowRefreshes).toBe(1);

    // the Strapi client gives up (its 10 s timeout): the failure memo opens — still stale at once, no load
    hung.reject(upstream());
    await vi.waitFor(() => expect(__swrStateSize().slowRefreshes).toBe(0));
    results.length = 0;
    started = performance.now();
    for (let i = 0; i < 20; i++) expect(await read(load)).toBe('v1');
    expect(performance.now() - started).toBeLessThan(200);
    expect(load).toHaveBeenCalledTimes(1);
    expect(new Set(results)).toEqual(new Set(['invalidated', 'stale_if_error']));

    // the memo expires: the next read is the probe and refreshes in the foreground
    vi.setSystemTime(Date.now() + FAILURE_MEMO_MS);
    expect(await read(async () => 'v2')).toBe('v2');
    expect((await stored()).v).toBe('v2');
    expect(__swrStateSize().recentFailures).toBe(0);
  });

  it('C-V3: a slow refresh that finishes after the budget clears its mark and stores the fresh value (no memo)', async () => {
    await read(async () => 'v1');
    bump('match');
    const slow = deferred<string>();
    expect(await read(() => slow.promise)).toBe('v1');
    expect(await read(async () => 'never called')).toBe('v1'); // the slow refresh is still running

    slow.resolve('v2');
    await vi.waitFor(() => expect(__swrStateSize().slowRefreshes).toBe(0));
    results.length = 0;
    expect(await read(async () => 'never called')).toBe('v2');
    expect(results).toEqual(['hit']);
    expect(__swrStateSize().recentFailures).toBe(0);
  });

  it('a miss whose load fails upstream returns onError, writes nothing, and is memoized for 10 s (V31)', async () => {
    const load = vi.fn(async (): Promise<string> => { throw upstream(); });

    expect(await read(load, { onError: () => 'empty' })).toBe('empty');
    expect(await read(load, { onError: () => 'empty' })).toBe('empty');
    expect(load).toHaveBeenCalledTimes(1);
    expect(fake.strings.size).toBe(0);

    vi.setSystemTime(Date.now() + FAILURE_MEMO_MS);
    const recovered = vi.fn(async () => 'v1');
    expect(await read(recovered, { onError: () => 'empty' })).toBe('v1'); // half-open probe answered in time
    expect((await stored()).v).toBe('v1');
  });

  it('a cold key waits for a slow Strapi (no budget on a miss): the value, never the fallback', async () => {
    const slow = () => new Promise<string>((resolve) => setTimeout(() => resolve('v1'), FOREGROUND_BUDGET_MS + 300));
    expect(await read(slow, { onError: () => 'empty' })).toBe('v1');
    expect(results).not.toContain('fallback');
  });

  it('budget-fix: after a failure, the half-open probe of a cold key waits for a SLOW Strapi — readers get the value, not the fallback (a 404 for a page record)', async () => {
    const failing = vi.fn(async (): Promise<string> => { throw upstream(); });
    expect(await read(failing, { onError: () => 'empty' })).toBe('empty'); // a real failure: fallback, memo open
    expect(await read(failing, { onError: () => 'empty' })).toBe('empty'); // open: at once, no load
    expect(failing).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + FAILURE_MEMO_MS); // half-open
    results.length = 0;
    const slow = vi.fn(() => new Promise<string>((resolve) => setTimeout(() => resolve('v1'), FOREGROUND_BUDGET_MS + 300)));
    const readers = await Promise.all([read(slow, { onError: () => 'empty' }), read(slow, { onError: () => 'empty' })]);
    expect(readers).toEqual(['v1', 'v1']); // both waited for the one probe
    expect(slow).toHaveBeenCalledTimes(1);
    expect(results).not.toContain('fallback');
    expect((await stored()).v).toBe('v1');
    expect(__swrStateSize().recentFailures).toBe(0); // the success closed the memo
  });

  it('without onError an upstream failure on a miss propagates', async () => {
    await expect(read(async () => { throw upstream(); })).rejects.toBeInstanceOf(UpstreamError);
  });

  it('P0-V11: an auth failure on a miss propagates — never the empty fallback — and is not memoized', async () => {
    const auth = new UpstreamAuthError('Strapi pages: HTTP 401');
    const load = vi.fn(async (): Promise<string> => { throw auth; });

    await expect(read(load, { onError: () => 'empty' })).rejects.toBe(auth);
    await expect(read(load, { onError: () => 'empty' })).rejects.toBe(auth);
    expect(load).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('REJECTED the API token'));
  });

  it('P0-V11: an auth failure with a stale entry serves the stale value (not empty), loudly', async () => {
    await read(async () => 'v1');
    bump('match');

    expect(await read(async () => { throw new UpstreamAuthError('HTTP 403'); }, { onError: () => 'empty' })).toBe('v1');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('REJECTED the API token'));
  });

  it('a bug or framework signal propagates on every path, and is never memoized', async () => {
    const bug = new TypeError('boom');
    await expect(read(async () => { throw bug; }, { onError: () => 'empty' })).rejects.toBe(bug);
    expect(__swrStateSize().recentFailures).toBe(0);

    await read(async () => 'v1');
    bump('match');
    await expect(read(async () => { throw bug; }, { onError: () => 'empty' })).rejects.toBe(bug);
  });

  it('a corrupted entry or a Redis read error degrades to the no-Redis path', async () => {
    fake.strings.set(await entryKey('getMatches', URL_), { value: '{not json' });
    expect(await read(async () => 'v1')).toBe('v1');
    expect(results).toContain('redis_error');
  });
});

describe('cached() — Redis unavailable', () => {
  it('an in-process memo keeps Strapi at one load per key per 30 s', async () => {
    redisUp = false;
    const load = vi.fn(async () => 'v1');

    expect(await read(load)).toBe('v1');
    expect(await read(load)).toBe('v1');
    expect(load).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['redis_unavailable', 'redis_unavailable', 'memo_hit']);

    vi.setSystemTime(Date.now() + NO_REDIS_MEMO_MS);
    await read(load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('and still falls back on an upstream failure', async () => {
    redisUp = false;
    expect(await read(async () => { throw new UpstreamError('x'); }, { onError: () => 'empty' })).toBe('empty');
  });
});

describe('hasEntry (the web record gate)', () => {
  it('true for any stored entry — also an invalidated one — false when absent; never loads', async () => {
    expect(await hasEntry('getMatches', URL_)).toBe(false);
    await read(async () => 'v1');
    expect(await hasEntry('getMatches', URL_)).toBe(true);
    bump('match');
    expect(await hasEntry('getMatches', URL_)).toBe(true); // stale but servable
  });

  it('null when it cannot tell: Redis unavailable, or the cache is off', async () => {
    redisUp = false;
    expect(await hasEntry('getMatches', URL_)).toBeNull();
    redisUp = true;
    process.env.DATA_CACHE_MODE = 'off';
    expect(await hasEntry('getMatches', URL_)).toBeNull();
  });
});

describe('DATA_CACHE_MODE', () => {
  it('off: bypasses Redis (single-flighted), nothing stored', async () => {
    process.env.DATA_CACHE_MODE = 'off';
    const load = vi.fn(async () => 'v1');

    expect(await read(load)).toBe('v1');
    expect(await read(load)).toBe('v1');
    expect(load).toHaveBeenCalledTimes(2);
    expect(fake.strings.size).toBe(0);
    expect(results).toEqual(['bypass', 'bypass']);
  });

  it('unset means on (the image is safe before the infra sets it)', async () => {
    expect(swr.cacheMode()).toBe('on');
    process.env.DATA_CACHE_MODE = 'anything';
    expect(swr.cacheMode()).toBe('on');
  });
});

describe('bumpTags', () => {
  it('bumpTags increments generations and this process sees it at once', async () => {
    await read(async () => 'v1');
    await bumpTags(['match']);
    expect(await read(async () => 'v2')).toBe('v2');
    expect(fake.hashes.get(TAGVER)!.get('match')).toBe('1');
    expect(fake.hashes.get('fotbalfm:v2:tagts')!.get('match')).toBe(String(Date.now()));
  });
});
