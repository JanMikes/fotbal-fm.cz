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
vi.mock('@fotbal-fm/cache', async (importActual) => ({
  ...(await importActual<typeof import('@fotbal-fm/cache')>()),
  hasEntry: vi.fn(async (fn: string, url: string) => present.has(`${fn}:${url}`)),
}));

const { __resetSwrState } = await import('@fotbal-fm/cache');
const { StrapiError, StrapiAuthError } = await vi.importActual<typeof import('@/lib/strapi/client')>('@/lib/strapi/client');
const { gate, recordsFor, STATIC_TOP_LEVEL, FILE_ROUTES } = await import('@/lib/record-gate');
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
  present.clear();
  findMany.mockReset();
  findAll.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  strapi({});
});

describe('which paths are record routes', () => {
  it.each([
    ['/kdy-hrajeme'], ['/partneri'], ['/komponenty'], ['/favicon.ico'], ['/robots.txt'], ['/manifest.webmanifest'],
    ['/a/7K3M9PQ2'], ['/api/health'], ['/%E2%9C%93'], ['/'], ['/novinky'], ['/kategorie'],
  ])('%s is not gated (no lookup at all)', async (pathname) => {
    expect(await recordsFor(pathname)).toEqual([]);
    expect(findAll).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('the static top-level list equals the app directory (a new route must not be mistaken for a CMS page)', () => {
    const app = path.resolve(__dirname, '../../app');
    const dirs = readdirSync(app).filter((e) => statSync(path.join(app, e)).isDirectory() && !/^[[(.]/.test(e));
    expect(new Set(dirs)).toEqual(STATIC_TOP_LEVEL);
    expect(FILE_ROUTES).toEqual(new Set(['apple-icon.png', 'favicon.ico', 'manifest.webmanifest', 'robots.txt']));
  });

  it('an unknown CMS slug (the index says so) is not gated: the page 404s', async () => {
    expect(await recordsFor('/wp-login.php')).toEqual([]);
    expect(await recordsFor('/neexistuje')).toEqual([]);
  });

  it('maps every record route to the records its page reads (same fn and cache URL)', async () => {
    const fns = async (p: string) => (await recordsFor(p)).map((r) => [r.fn, r.url]);
    expect(await fns('/kontakty')).toEqual([[RECORDS.page('kontakty').fn, RECORDS.page('kontakty').url]]);
    expect(await fns('/kategorie/muzi-a/zapasy')).toEqual([[RECORDS.category('muzi-a').fn, RECORDS.category('muzi-a').url]]);
    expect((await fns('/kategorie/muzi-a/clanek/x')).map(([fn]) => fn)).toEqual(['getCategoryBySlug', 'getNewsArticleBySlug']);
    expect((await fns('/kategorie/muzi-a/hrac/jan-novak')).map(([fn]) => fn)).toEqual(['getCategoryBySlug', 'getPlayersByCategory']);
    expect((await fns('/novinky/clanek/x')).map(([fn]) => fn)).toEqual(['getNewsArticleBySlug']);
    expect((await fns('/partner/x')).map(([fn]) => fn)).toEqual(['getPartnerBySlug']);
    expect(await fns('/kategorie/neni-to')).toEqual([]); // unknown category: the layout 404s
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
    expect(await gate('/whatever-plausible')).toEqual({ status: 'unavailable', fn: 'getPageBySlug', reason: 'failed' });
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
