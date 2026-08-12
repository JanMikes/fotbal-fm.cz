import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Must import after stubbing fetch
const { strapiGet, strapiGetSingle, strapiPost, strapiPut, strapiDelete } = await import('../../lib/strapi.js');

function mockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(data === undefined ? '' : JSON.stringify(data)),
  };
}

describe('strapi client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('strapiGet', () => {
    it('fetches collection with query options', async () => {
      const responseData = { data: [{ id: 1, name: 'Test' }], meta: { pagination: { total: 1 } } };
      mockFetch.mockResolvedValueOnce(mockResponse(responseData));

      const result = await strapiGet('/categories', {
        sort: 'sortOrder:asc',
        pagination: { pageSize: 100 },
      });

      expect(result).toEqual(responseData);
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/categories');
      expect(url).toContain('sort=');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('fetches without query options', async () => {
      const responseData = { data: [], meta: {} };
      mockFetch.mockResolvedValueOnce(mockResponse(responseData));

      const result = await strapiGet('/categories');

      expect(result).toEqual(responseData);
      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain('?');
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(null, false, 500));

      await expect(strapiGet('/categories')).rejects.toThrow('Strapi request failed: 500');
    });
  });

  describe('strapiGetSingle', () => {
    it('fetches single resource', async () => {
      const user = { id: 1, email: 'test@test.com' };
      mockFetch.mockResolvedValueOnce(mockResponse(user));

      const result = await strapiGetSingle('/users/me', 'user-jwt');

      expect(result).toEqual(user);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer user-jwt');
    });

    it('throws JSON-stringified error on failure', async () => {
      const errorData = { error: { message: 'Not found' } };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve(errorData),
      });

      await expect(strapiGetSingle('/users/999')).rejects.toThrow(
        JSON.stringify(errorData)
      );
    });
  });

  describe('strapiPost', () => {
    it('posts data with auth token', async () => {
      const responseData = { jwt: 'new-token', user: { id: 1 } };
      mockFetch.mockResolvedValueOnce(mockResponse(responseData));

      const result = await strapiPost('/auth/local', { identifier: 'test', password: 'pass' }, 'jwt');

      expect(result).toEqual(responseData);
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer jwt');
      expect(JSON.parse(options.body)).toEqual({ identifier: 'test', password: 'pass' });
    });

    it('throws on error', async () => {
      const errorData = { error: { message: 'Invalid credentials' } };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve(errorData),
      });

      await expect(strapiPost('/auth/local', {})).rejects.toThrow();
    });
  });

  describe('strapiPut', () => {
    it('sends PUT request', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, name: 'Updated' }));

      await strapiPut('/users/1', { name: 'Updated' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('PUT');
    });
  });

  describe('strapiDelete', () => {
    it('sends DELETE request with auth token', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: 1 }));

      await strapiDelete('/users/1', 'admin-jwt');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('DELETE');
      expect(options.headers['Authorization']).toBe('Bearer admin-jwt');
    });

    it('handles 204 No Content, which is what Strapi 5 actually returns', async () => {
      // Regression: parsing an empty body as JSON threw "Unexpected end of
      // JSON input" and aborted the whole sync on the first successful delete.
      mockFetch.mockResolvedValueOnce(mockResponse(undefined, true, 204));

      await expect(strapiDelete('/matches/abc')).resolves.toBeUndefined();
    });

    it('throws on error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: { message: 'Delete failed' } }),
      });

      await expect(strapiDelete('/users/1')).rejects.toThrow();
    });
  });
});
