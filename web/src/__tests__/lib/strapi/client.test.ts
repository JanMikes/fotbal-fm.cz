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

describe('StrapiClient', () => {
  async function getClient() {
    const { getStrapiClient } = await import('../../../lib/strapi/client');
    return getStrapiClient();
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

    it('returns empty data on non-ok response (graceful degradation)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const client = await getClient();
      const result = await client.findMany('categories');

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns empty data on network error (graceful degradation)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = await getClient();
      const result = await client.findMany('categories');

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
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

    it('returns null on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const client = await getClient();
      const result = await client.findOne('categories', 'nonexistent');

      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = await getClient();
      const result = await client.findOne('categories', 'doc-1');

      expect(result).toBeNull();
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
});
