import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';


// src/proxy.ts: a record route whose record is unavailable answers the 503 page; everything else
// passes through to Next.js untouched.

const gate = vi.fn();
vi.mock('@/lib/record-gate', () => ({ gate: (pathname: string) => gate(pathname) }));

const { proxy, config } = await import('@/proxy');
// The very function Next's build uses to compile `config.matcher` into the proxy's route regexps
// (exported at runtime, not in Next's type declarations).
const { getMiddlewareMatchers } = (await import('next/dist/build/analysis/get-page-static-info')) as unknown as {
  getMiddlewareMatchers: (matchers: unknown, nextConfig: unknown) => { regexp: string }[];
};

const request = (pathname: string, method = 'GET') => new NextRequest(new URL(pathname, 'https://fotbal-fm.cz'), { method });
const passedThrough = (res: Response) => res.headers.get('x-middleware-next') === '1';

beforeEach(() => {
  gate.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('proxy (record gate)', () => {
  it('passes through when the gate passes', async () => {
    gate.mockResolvedValue({ status: 'pass' });
    const res = await proxy(request('/kontakty'));
    expect(passedThrough(res)).toBe(true);
    expect(gate).toHaveBeenCalledWith('/kontakty');
  });

  it('answers 503 + Retry-After + no-store with the Czech "temporarily unavailable" page', async () => {
    gate.mockResolvedValue({ status: 'unavailable', fn: 'getPageBySlug', reason: 'failed' });
    const res = await proxy(request('/kontakty'));
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('30');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(passedThrough(res)).toBe(false);
    const html = await res.text();
    expect(html).toContain('<html lang="cs">');
    expect(html).toContain('Stránka je dočasně nedostupná');
    expect(html).toContain('Zkuste to prosím za chvíli znovu');
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).not.toMatch(/404|nenalezena/);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[Gate] 503 /kontakty: getPageBySlug'));
  });

  it('a HEAD request gets the 503 without a body', async () => {
    gate.mockResolvedValue({ status: 'unavailable', fn: 'getPageBySlug', reason: 'timeout' });
    const res = await proxy(request('/kontakty', 'HEAD'));
    expect(res.status).toBe(503);
    expect(await res.text()).toBe('');
  });

  it('other methods are never gated', async () => {
    const res = await proxy(request('/kontakty', 'POST'));
    expect(passedThrough(res)).toBe(true);
    expect(gate).not.toHaveBeenCalled();
  });

});

describe('proxy matcher (compiled as Next compiles it)', () => {
  const matchers = getMiddlewareMatchers(config.matcher, {}).map((m) => new RegExp(m.regexp));
  const proxied = (pathname: string) => matchers.some((re) => re.test(pathname));

  function publicFiles(dir: string, prefix = ''): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = path.join(dir, entry);
      return statSync(full).isDirectory() ? publicFiles(full, `${prefix}/${entry}`) : [`${prefix}/${entry}`];
    });
  }

  it('every file in web/public bypasses the proxy (logo, icons, placeholders — also via the image optimizer; review BF-V1)', () => {
    const files = publicFiles(path.resolve(__dirname, '../../public'));
    expect(files.length).toBeGreaterThan(10);
    expect(files.filter(proxied)).toEqual([]);
  });

  it('the app\'s file routes, /_next, /api, the latch and / bypass it too', () => {
    for (const p of ['/favicon.ico', '/robots.txt', '/manifest.webmanifest', '/apple-icon.png', '/_next/static/chunks/a.js', '/_next/image', '/api/health', '/', '/a/KUCIS', '/.well-known/assetlinks.json']) {
      expect([p, proxied(p)]).toEqual([p, false]);
    }
  });

  it('the record routes reach it', () => {
    for (const p of ['/kontakty', '/o-klubu', '/kategorie/muzi-a', '/kategorie/muzi-a/zapasy', '/kategorie/muzi-a/clanek/x', '/kategorie/muzi-a/hrac/y', '/novinky/clanek/x', '/partner/x']) {
      expect([p, proxied(p)]).toEqual([p, true]);
    }
  });
});
