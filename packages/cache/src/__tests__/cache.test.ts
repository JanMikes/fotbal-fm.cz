import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// U10: cacheGetOrSet — single-flight, failures never cached, in-process failure memo (V41).

const store = new Map<string, string>();
const fakeRedis = {
  get: vi.fn(async (key: string) => store.get(key) ?? null),
  setex: vi.fn(async (key: string, _ttl: number, value: string) => {
    store.set(key, value);
    return 'OK';
  }),
};

vi.mock('../redis', () => ({
  getRedisClient: vi.fn(async () => fakeRedis),
}));

const {
  cacheGetOrSet,
  FAILURE_MEMO_MS,
  FAILURE_MEMO_MAX_KEYS,
  HALF_OPEN_WAIT_MS,
  __resetCacheGetOrSetState,
  __cacheGetOrSetStateSize,
} = await import('../cache');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('cacheGetOrSet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    __resetCacheGetOrSetState();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T15:30:00Z'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns a cached value without calling the loader', async () => {
    store.set('fotbalfm:k', JSON.stringify(['cached']));
    const fn = vi.fn(async () => ['fresh']);

    expect(await cacheGetOrSet('k', fn)).toEqual(['cached']);
    expect(fn).not.toHaveBeenCalled();
  });

  it('stores a loaded value with the given TTL', async () => {
    const result = await cacheGetOrSet('k', async () => ['fresh'], 3600);

    expect(result).toEqual(['fresh']);
    expect(fakeRedis.setex).toHaveBeenCalledWith('fotbalfm:k', 3600, JSON.stringify(['fresh']));
  });

  it('50 concurrent misses call the loader once (single-flight)', async () => {
    const gate = deferred<string[]>();
    const fn = vi.fn(() => gate.promise);

    const calls = Array.from({ length: 50 }, () => cacheGetOrSet('k', fn));
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    gate.resolve(['fresh']);
    const results = await Promise.all(calls);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r[0] === 'fresh')).toBe(true);
    expect(fakeRedis.setex).toHaveBeenCalledTimes(1);
    expect(__cacheGetOrSetStateSize().inflight).toBe(0);
  });

  it('single-flight is per key', async () => {
    const fn = vi.fn(async () => 'v');
    await Promise.all([cacheGetOrSet('a', fn), cacheGetOrSet('b', fn), cacheGetOrSet('a', fn)]);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('a failed load returns the onError value and writes nothing to Redis', async () => {
    const fn = vi.fn(async (): Promise<string[]> => {
      throw new Error('Strapi categories: HTTP 500');
    });

    const result = await cacheGetOrSet('k', fn, 60, { onError: () => [] });

    expect(result).toEqual([]);
    expect(fakeRedis.setex).not.toHaveBeenCalled();
    expect(store.size).toBe(0);
  });

  it('without onError the failure propagates and nothing is stored', async () => {
    const error = new Error('boom');

    await expect(cacheGetOrSet('k', async () => { throw error; })).rejects.toBe(error);
    expect(fakeRedis.setex).not.toHaveBeenCalled();
  });

  it('concurrent callers of a failing load each get their own fallback', async () => {
    const gate = deferred<string>();
    const fn = vi.fn(() => gate.promise);

    const a = cacheGetOrSet('k', fn, 60, { onError: () => 'fallback-a' });
    const b = cacheGetOrSet('k', fn, 60, { onError: () => 'fallback-b' });
    await vi.waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    gate.reject(new Error('timeout'));

    expect(await a).toBe('fallback-a');
    expect(await b).toBe('fallback-b');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  describe('failure memo (V41)', () => {
    const failing = () => vi.fn(async (): Promise<string> => { throw new Error('Strapi pages: timeout'); });

    it('within the window a failed key returns onError immediately, without a new load', async () => {
      const fn = failing();
      await cacheGetOrSet('k', fn, 60, { onError: () => 'empty' });

      vi.setSystemTime(Date.now() + FAILURE_MEMO_MS - 1);
      expect(await cacheGetOrSet('k', fn, 60, { onError: () => 'empty' })).toBe('empty');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('after the window the next call retries the loader, and a success is cached', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Strapi pages: HTTP 503'))
        .mockResolvedValueOnce('fresh');
      await cacheGetOrSet('k', fn, 60, { onError: () => 'empty' });

      vi.setSystemTime(Date.now() + FAILURE_MEMO_MS);
      expect(await cacheGetOrSet('k', fn, 60, { onError: () => 'empty' })).toBe('fresh');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fakeRedis.setex).toHaveBeenCalledTimes(1);
      expect(__cacheGetOrSetStateSize().recentFailures).toBe(0);
    });

    it('half-open: another caller gets the probe\'s value when it comes back quickly', async () => {
      await cacheGetOrSet('k', failing(), 60, { onError: () => 'empty' });
      vi.setSystemTime(Date.now() + FAILURE_MEMO_MS);

      const gate = deferred<string>();
      const probe = vi.fn(() => gate.promise);
      const first = cacheGetOrSet('k', probe, 60, { onError: () => 'empty' });
      await vi.waitFor(() => expect(probe).toHaveBeenCalledTimes(1));
      // e.g. the root layout and the page of one render reading the same key
      const second = cacheGetOrSet('k', probe, 60, { onError: () => 'empty' });
      gate.resolve('fresh');

      expect(await first).toBe('fresh');
      expect(await second).toBe('fresh');
      expect(probe).toHaveBeenCalledTimes(1);
    });

    it(`half-open: nobody waits more than ${HALF_OPEN_WAIT_MS} ms for a hung probe, which runs on in the background`, async () => {
      await cacheGetOrSet('k', failing(), 60, { onError: () => 'empty' });
      vi.setSystemTime(Date.now() + FAILURE_MEMO_MS);

      const gate = deferred<string>();
      const probe = vi.fn(() => gate.promise);
      const started = performance.now();
      const [prober, other] = await Promise.all([
        cacheGetOrSet('k', probe, 60, { onError: () => 'empty' }),
        cacheGetOrSet('k', probe, 60, { onError: () => 'empty' }),
      ]);
      const waited = performance.now() - started;

      expect([prober, other]).toEqual(['empty', 'empty']);
      expect(waited).toBeGreaterThanOrEqual(HALF_OPEN_WAIT_MS - 50);
      expect(waited).toBeLessThan(HALF_OPEN_WAIT_MS + 1000);
      expect(probe).toHaveBeenCalledTimes(1);
      expect(__cacheGetOrSetStateSize().inflight).toBe(1); // still probing

      // Strapi answers late: the background probe stores the value and forgets the failure.
      gate.resolve('fresh');
      await vi.waitFor(() => expect(fakeRedis.setex).toHaveBeenCalledWith('fotbalfm:k', 60, JSON.stringify('fresh')));
      expect(__cacheGetOrSetStateSize()).toEqual({ inflight: 0, recentFailures: 0 });
      expect(await cacheGetOrSet('k', failing(), 60, { onError: () => 'empty' })).toBe('fresh');
    });

    it('half-open: a failing probe re-opens the memo and its waiters fall back', async () => {
      await cacheGetOrSet('k', failing(), 60, { onError: () => 'empty' });
      vi.setSystemTime(Date.now() + FAILURE_MEMO_MS);

      const gate = deferred<string>();
      const probe = vi.fn(() => gate.promise);
      const first = cacheGetOrSet('k', probe, 60, { onError: () => 'empty' });
      await vi.waitFor(() => expect(probe).toHaveBeenCalledTimes(1));
      const second = cacheGetOrSet('k', probe, 60, { onError: () => 'empty' });
      gate.reject(new Error('HTTP 503'));

      expect(await first).toBe('empty');
      expect(await second).toBe('empty');
      const next = vi.fn(async () => 'fresh');
      expect(await cacheGetOrSet('k', next, 60, { onError: () => 'empty' })).toBe('empty'); // open again
      expect(next).not.toHaveBeenCalled();
    });

    it('is per key: another key still loads', async () => {
      await cacheGetOrSet('a', failing(), 60, { onError: () => 'empty' });
      const fn = vi.fn(async () => 'b-value');

      expect(await cacheGetOrSet('b', fn, 60, { onError: () => 'empty' })).toBe('b-value');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('a cached value wins over a remembered failure', async () => {
      await cacheGetOrSet('k', failing(), 60, { onError: () => 'empty' });
      store.set('fotbalfm:k', JSON.stringify('cached-by-the-other-replica'));

      expect(await cacheGetOrSet('k', failing(), 60, { onError: () => 'empty' })).toBe('cached-by-the-other-replica');
    });

    it('callers without onError are not short-circuited', async () => {
      await cacheGetOrSet('k', failing(), 60, { onError: () => 'empty' });
      const fn = vi.fn(async () => 'fresh');

      expect(await cacheGetOrSet('k', fn)).toBe('fresh');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it(`remembers at most ${FAILURE_MEMO_MAX_KEYS} keys, dropping the oldest`, async () => {
      for (let i = 0; i < FAILURE_MEMO_MAX_KEYS + 25; i++) {
        await cacheGetOrSet(`k${i}`, failing(), 60, { onError: () => 'empty' });
      }
      expect(__cacheGetOrSetStateSize().recentFailures).toBe(FAILURE_MEMO_MAX_KEYS);

      // k0 was evicted (loads again), the newest key is still remembered (short-circuits)
      const oldest = vi.fn(async () => 'v');
      const newest = vi.fn(async () => 'v');
      await cacheGetOrSet('k0', oldest, 60, { onError: () => 'empty' });
      await cacheGetOrSet(`k${FAILURE_MEMO_MAX_KEYS + 24}`, newest, 60, { onError: () => 'empty' });
      expect(oldest).toHaveBeenCalledTimes(1);
      expect(newest).not.toHaveBeenCalled();
    });
  });
});
