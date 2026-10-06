import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// src/proxy.ts: a record route whose record is unavailable answers the 503 page; everything else
// passes through to Next.js untouched.

const gate = vi.fn();
vi.mock('@/lib/record-gate', () => ({ gate: (pathname: string) => gate(pathname) }));

const { proxy, config } = await import('@/proxy');

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

  it('matches only the record routes (never /api, /_next or the latch)', () => {
    expect(config.matcher).toEqual(['/:slug', '/kategorie/:category/:path*', '/novinky/clanek/:slug', '/partner/:slug']);
  });
});
