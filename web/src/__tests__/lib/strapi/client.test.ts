import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    strapi: { url: 'http://strapi:1337', apiToken: 'test-token' },
    publicUploadsUrl: 'http://uploads.test',
    internalUploadsUrl: 'http://uploads.test',
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Reset module to get fresh client instance
beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
});

let StrapiError: typeof import('../../../lib/strapi/client').StrapiError;

describe('StrapiClient', () => {
  async function getClient() {
    const mod = await import('../../../lib/strapi/client');
    StrapiError = mod.StrapiError;
    return mod.getStrapiClient();
  }

  describe('findMany', () => {
    it('returns data and total', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 1, name: 'Test' }],
          meta: { pagination: { total: 1 } },
        }),
      });

      const client = await getClient();
      const result = await client.findMany('categories');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('constructs URL with query string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], meta: {} }),
      });

      const client = await getClient();
      await client.findMany('categories', {
        sort: 'sortOrder:asc',
        pagination: { pageSize: 100 },
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('http://strapi:1337/api/categories');
      expect(url).toContain('sort=');
      expect(url).toContain('pagination');
    });

    it('includes auth header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], meta: {} }),
      });

      const client = await getClient();
      await client.findMany('categories');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer test-token');
    });

    // Failures throw (P0-1): the cache layer must never store them as empty data.
    it('throws StrapiError with the status on a non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const client = await getClient();
      const error = await client.findMany('categories').catch((e) => e);

      expect(error).toBeInstanceOf(StrapiError);
      expect(error.status).toBe(500);
      expect(error.message).toBe('Strapi categories: HTTP 500');
    });

    it('throws StrapiError on a 404 (a missing collection route is a failure, not "no data")', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const client = await getClient();
      await expect(client.findMany('categories')).rejects.toMatchObject({ status: 404 });
    });

    it('throws StrapiError(network) on a network error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const client = await getClient();
      await expect(client.findMany('categories')).rejects.toMatchObject({ name: 'StrapiError', status: 'network' });
    });

    it('throws StrapiError(timeout) when the request times out', async () => {
      mockFetch.mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));

      const client = await getClient();
      await expect(client.findMany('categories')).rejects.toMatchObject({ status: 'timeout' });
    });

    it("rethrows Next.js's dynamic-usage signal untouched instead of wrapping it (P0-V2)", async () => {
      const { DynamicServerError } = await import('next/dist/client/components/hooks-server-context');
      const signal = new DynamicServerError('Route / couldn\'t be rendered statically because it used no-store fetch');
      mockFetch.mockRejectedValueOnce(signal);

      const client = await getClient();
      const error = await client.findMany('category-groups').catch((e) => e);

      expect(error).toBe(signal);
      expect(error).not.toBeInstanceOf(StrapiError);
    });

    it("rethrows Next.js's notFound()/redirect() signals too (unstable_rethrow)", async () => {
      const { notFound } = await import('next/navigation');
      let signal: unknown;
      try { notFound(); } catch (e) { signal = e; }
      mockFetch.mockRejectedValueOnce(signal);

      const client = await getClient();
      await expect(client.findMany('pages')).rejects.toBe(signal);
    });

    it('StrapiError is an upstream error (the only kind the cache turns into a fallback)', async () => {
      const { isUpstreamError } = await import('@fotbal-fm/cache');
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const client = await getClient();
      expect(isUpstreamError(await client.findMany('pages').catch((e) => e))).toBe(true);
    });

    it('throws StrapiError(network) on an unparsable body', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('Unexpected token <')) });

      const client = await getClient();
      await expect(client.findMany('categories')).rejects.toMatchObject({ status: 'network' });
    });

    it('sends a 10 s timeout signal', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) });

      const client = await getClient();
      await client.findMany('categories');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(options.cache).toBe('no-store');
    });

    it('falls back to data.length when pagination total is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 1 }, { id: 2 }] }),
      });

      const client = await getClient();
      const result = await client.findMany('items');

      expect(result.total).toBe(2);
    });
  });

  describe('findOne', () => {
    it('returns data for existing resource', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: 1, name: 'Test' } }),
      });

      const client = await getClient();
      const result = await client.findOne('categories', 'doc-1');

      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('constructs URL with documentId', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      });

      const client = await getClient();
      await client.findOne('categories', 'doc-123');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://strapi:1337/api/categories/doc-123');
    });

    it('returns null on 404 (no such document)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const client = await getClient();
      const result = await client.findOne('categories', 'nonexistent');

      expect(result).toBeNull();
    });

    it('throws StrapiError on any other non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const client = await getClient();
      await expect(client.findOne('categories', 'doc-1')).rejects.toMatchObject({ status: 503 });
    });

    it('throws StrapiError on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = await getClient();
      await expect(client.findOne('categories', 'doc-1')).rejects.toBeInstanceOf(StrapiError);
    });

    it('returns null when data is null in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      });

      const client = await getClient();
      const result = await client.findOne('categories', 'doc-1');

      expect(result).toBeNull();
    });
  });

  describe('findSingle', () => {
    it('returns the entry', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: { id: 1, text: 'Footer' } }) });

      const client = await getClient();
      expect(await client.findSingle('footer')).toEqual({ id: 1, text: 'Footer' });
    });

    it('returns null on 404 (single type without an entry)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const client = await getClient();
      expect(await client.findSingle('footer')).toBeNull();
    });

    it('throws StrapiError on a 5xx', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 502 });

      const client = await getClient();
      await expect(client.findSingle('footer')).rejects.toMatchObject({ status: 502 });
    });
  });

  describe('findAll', () => {
    it('loads every page', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [{ id: 1 }], meta: { pagination: { total: 150 } } }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [{ id: 2 }], meta: { pagination: { total: 150 } } }) });

      const client = await getClient();
      expect(await client.findAll('pages', { fields: ['slug'] })).toEqual([{ id: 1 }, { id: 2 }]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws when a later page fails, never returning a partial list', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [{ id: 1 }], meta: { pagination: { total: 150 } } }) })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      const client = await getClient();
      await expect(client.findAll('pages')).rejects.toBeInstanceOf(StrapiError);
    });
  });
});
