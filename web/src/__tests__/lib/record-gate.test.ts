import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// The record gate (src/proxy.ts): a record route whose own record cannot be loaded (Strapi failing
// or too slow, no cached copy) answers 503, never a false 404 or an empty page. Runs through the
// real data layer and data cache (no Redis: the in-process path); the Strapi client is mocked.

vi.mock('@/lib/config', () => ({
  config: {
    strapi: { url: 'http://strapi:1337', apiToken: 'test-token' },
    publicUploadsUrl: 'http://uploads.test',
    internalUploadsUrl: 'http://uploads.test',
  },
}));

const findMany = vi.fn();
const findAll = vi.fn();
vi.mock('@/lib/strapi/client', () => ({ getStrapiClient: () => ({ findMany, findAll, findSingle: vi.fn() }) }));

const present = new Set<string>(); // cache entries that "exist" (by fn:url)
let redisAnswer: boolean | null = true; // redisResponds(): true ok, false stalled, null no client
vi.mock('@fotbal-fm/cache', async (importActual) => ({
  ...(await importActual<typeof import('@fotbal-fm/cache')>()),
  hasEntry: vi.fn(async (fn: string, url: string) => present.has(`${fn}:${url}`)),
  redisResponds: vi.fn(async () => redisAnswer),
}));

const { __resetSwrState } = await import('@fotbal-fm/cache');
const { StrapiError, StrapiAuthError } = await vi.importActual<typeof import('@/lib/strapi/client')>('@/lib/strapi/client');
const { gate, routeOf, STATIC_TOP_LEVEL, __resetGateState } = await import('@/lib/record-gate');
const { RECORDS } = await import('@/lib/strapi/data');

const PAGES = [{ slug: 'kontakty' }, { slug: 'o-klubu' }];
const CATEGORIES = [{ slug: 'muzi-a' }];
const down = () => new StrapiError('pages', 503);
const hang = () => new Promise<never>(() => {});

/** findMany by content type; findAll answers the two membership indexes. */
function strapi(answers: Partial<Record<string, () => Promise<unknown>>>) {
  findMany.mockImplementation((type: string) => (answers[type] ?? (async () => ({ data: [], total: 0 })))());
  findAll.mockImplementation(async (type: string) => (type === 'pages' ? PAGES : CATEGORIES));
}

beforeEach(() => {
  __resetSwrState();
  __resetGateState();
  redisAnswer = true;
  present.clear();
  findMany.mockReset();
  findAll.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  strapi({});
});

describe('which paths are record routes', () => {
  it.each([
    ['/kdy-hrajeme'], ['/partneri'], ['/komponenty'], ['/favicon.ico'], ['/robots.txt'], ['/manifest.webmanifest'],
    ['/logo.svg'], ['/icon-192.png'], ['/player-placeholder.png'], ['/wp-login.php'], ['/.env'],
    ['/a/7K3M9PQ2'], ['/api/health'], ['/%E2%9C%93'], ['/'], ['/novinky'], ['/kategorie'],
    ['/novinky/clanek/x.php'], ['/kategorie/muzi-a/clanek/a.b'], ['/partner/x.html'], ['/kategorie/muzi.a'],
  ])('%s is no record route (never gated: no lookup, never 503)', async (pathname) => {
    expect(routeOf(pathname)).toBeNull();
    expect(await gate(pathname)).toEqual({ status: 'pass' });
    expect(findAll).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('the static top-level list equals the app directory (a new route must not be mistaken for a CMS page)', () => {
    const app = path.resolve(__dirname, '../../app');
    const dirs = readdirSync(app).filter((e) => statSync(path.join(app, e)).isDirectory() && !/^[[(.]/.test(e));
    expect(new Set(dirs)).toEqual(STATIC_TOP_LEVEL);
  });

  it('maps every record route to the records its page reads (same fn and cache URL) and its index', () => {
    const fns = (p: string) => routeOf(p)!.records.map((r) => r.fn);
    expect(routeOf('/kontakty')!.records.map((r) => [r.fn, r.url])).toEqual([[RECORDS.page('kontakty').fn, RECORDS.page('kontakty').url]]);
    expect(routeOf('/kontakty')!.index!.name).toBe('getPageSlugIndex');
    expect(routeOf('/kategorie/muzi-a/zapasy')!.records.map((r) => [r.fn, r.url])).toEqual([[RECORDS.category('muzi-a').fn, RECORDS.category('muzi-a').url]]);
    expect(routeOf('/kategorie/muzi-a/zapasy')!.index!.name).toBe('getCategorySlugIndex');
    expect(fns('/kategorie/muzi-a/clanek/x')).toEqual(['getCategoryBySlug', 'getNewsArticleBySlug']);
    expect(fns('/kategorie/muzi-a/hrac/jan-novak')).toEqual(['getCategoryBySlug', 'getPlayersByCategory']);
    expect(fns('/novinky/clanek/x')).toEqual(['getNewsArticleBySlug']);
    expect(routeOf('/novinky/clanek/x')!.index).toBeNull();
    expect(fns('/partner/x')).toEqual(['getPartnerBySlug']);
  });

  it('unknown CMS slugs and categories (the index says so) pass: the page 404s, no record load', async () => {
    expect(await gate('/neexistuje')).toEqual({ status: 'pass' });
    expect(await gate('/kategorie/neni-to')).toEqual({ status: 'pass' });
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('gate()', () => {
  it('a cached copy of the record (any freshness): pass, without asking Strapi', async () => {
    const page = RECORDS.page('kontakty');
    present.add(`${page.fn}:${page.url}`);
    strapi({ pages: async () => { throw down(); } });
    expect(await gate('/kontakty')).toEqual({ status: 'pass' });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('a cold record Strapi answers: pass (loaded through the entry the page reads)', async () => {
    strapi({ pages: async () => ({ data: [{ slug: 'kontakty', content: [], sidebar: [] }], total: 1 }) });
    expect(await gate('/kontakty')).toEqual({ status: 'pass' });
    expect(findMany).toHaveBeenCalled();
  });

  it('a cold record Strapi fails on: 503 (never the 404 the empty answer used to give)', async () => {
    strapi({ pages: async () => { throw down(); } });
    expect(await gate('/kontakty')).toEqual({ status: 'unavailable', fn: 'getPageBySlug', reason: 'failed' });
  });

  it('a cold record Strapi does not answer in time: 503 after the wait', async () => {
    strapi({ pages: hang });
    const started = performance.now();
    expect(await gate('/kontakty', 50)).toEqual({ status: 'unavailable', fn: 'getPageBySlug', reason: 'timeout' });
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('during the failure memo the next request is 503 at once, with no new Strapi call', async () => {
    strapi({ pages: async () => { throw down(); } });
    await gate('/kontakty');
    const calls = findMany.mock.calls.length;
    expect(await gate('/kontakty')).toEqual({ status: 'unavailable', fn: 'getPageBySlug', reason: 'failed' });
    expect(findMany.mock.calls.length).toBe(calls);
  });

  it('a record that genuinely does not exist: pass — the page answers 404 as before', async () => {
    strapi({ pages: async () => ({ data: [], total: 0 }) });
    expect(await gate('/kontakty')).toEqual({ status: 'pass' });
  });

  it('the membership index unavailable and the record failing: 503 — it may exist, so never 404', async () => {
    findAll.mockRejectedValue(down());
    findMany.mockRejectedValue(down());
    // the index answers null (Strapi failed: unknown), so the record is tried — and fails
    expect(await gate('/whatever-plausible')).toEqual({ status: 'unavailable', fn: 'getPageBySlug', reason: 'failed' });
  });

  it('a public file always passes — even with the index unavailable and Strapi failing (review BF-V1)', async () => {
    findAll.mockRejectedValue(down());
    findMany.mockRejectedValue(down());
    for (const file of ['/logo.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/news-placeholder.jpg', '/player-placeholder.png']) {
      expect(await gate(file)).toEqual({ status: 'pass' });
    }
    expect(findAll).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('the deadline includes the index lookup: a hung index + a cold record → 503 by the deadline, not after 15 s (BF-V2)', async () => {
    findAll.mockImplementation(hang);
    findMany.mockImplementation(hang);
    const started = performance.now();
    expect(await gate('/kontakty', 50)).toEqual({ status: 'unavailable', fn: 'getPageSlugIndex', reason: 'timeout' });
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('every record cached: pass without reading the index (nothing else to wait for)', async () => {
    const page = RECORDS.page('kontakty');
    present.add(`${page.fn}:${page.url}`);
    findAll.mockImplementation(hang);
    expect(await gate('/kontakty', 50)).toEqual({ status: 'pass' });
    expect(findAll).not.toHaveBeenCalled();
  });

  it('a stalled Redis (no PING answer in time): pass at once, no further Redis or Strapi reads (BF-V4)', async () => {
    redisAnswer = false;
    const { hasEntry } = await import('@fotbal-fm/cache');
    vi.mocked(hasEntry).mockClear();
    const started = performance.now();
    expect(await gate('/kontakty')).toEqual({ status: 'pass' });
    expect(performance.now() - started).toBeLessThan(100);
    expect(hasEntry).not.toHaveBeenCalled();
    expect(findAll).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('no Redis client at all (down): the gate still works on the no-Redis path — Strapi failing → 503', async () => {
    redisAnswer = null;
    strapi({ pages: async () => { throw down(); } });
    expect(await gate('/kontakty')).toEqual({ status: 'unavailable', fn: 'getPageBySlug', reason: 'failed' });
  });

  it('an auth failure (401) is not "unavailable": pass, the page handles it (latch, 500, alert)', async () => {
    strapi({ pages: async () => { throw new StrapiAuthError('pages', 401); } });
    expect(await gate('/kontakty')).toEqual({ status: 'pass' });
  });

  it('category routes gate the category, and the article / roster under it', async () => {
    strapi({ categories: async () => { throw down(); } });
    expect(await gate('/kategorie/muzi-a/zapasy')).toEqual({ status: 'unavailable', fn: 'getCategoryBySlug', reason: 'failed' });

    __resetSwrState();
    const category = RECORDS.category('muzi-a');
    present.add(`${category.fn}:${category.url}`);
    strapi({ 'news-articles': async () => { throw down(); }, players: async () => { throw down(); } });
    expect(await gate('/kategorie/muzi-a/clanek/x')).toEqual({ status: 'unavailable', fn: 'getNewsArticleBySlug', reason: 'failed' });
    expect(await gate('/kategorie/muzi-a/hrac/jan-novak')).toEqual({ status: 'unavailable', fn: 'getPlayersByCategory', reason: 'failed' });
  });

  it('articles and partners are gated on their own routes', async () => {
    strapi({ 'news-articles': async () => { throw down(); }, partners: async () => { throw down(); } });
    expect(await gate('/novinky/clanek/x')).toEqual({ status: 'unavailable', fn: 'getNewsArticleBySlug', reason: 'failed' });
    expect(await gate('/partner/x')).toEqual({ status: 'unavailable', fn: 'getPartnerBySlug', reason: 'failed' });
  });
});
