import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { HttpClient, createAuthenticatedClient } = await import('../../core/http-client');
const { TimeoutError, NetworkError, AppError, ErrorCode } = await import('../../core/errors');

function createClient(overrides = {}) {
  return new HttpClient({
    baseUrl: 'http://api.test',
    timeout: 5000,
    ...overrides,
  });
}

function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('HttpClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('makes GET request and returns parsed JSON', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ data: 'test' }));

      const client = createClient();
      const result = await client.get('/items');

      expect(result).toEqual({ data: 'test' });
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://api.test/items');
      expect(options.method).toBe('GET');
    });
  });

  describe('POST', () => {
    it('sends JSON body', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: 1 }));

      const client = createClient();
      await client.post('/items', { name: 'test' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.body).toBe(JSON.stringify({ name: 'test' }));
    });
  });

  describe('PUT', () => {
    it('sends PUT request', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: 1, name: 'updated' }));

      const client = createClient();
      await client.put('/items/1', { name: 'updated' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('PUT');
    });
  });

  describe('DELETE', () => {
    it('sends DELETE request', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(null));

      const client = createClient();
      await client.delete('/items/1');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('DELETE');
    });
  });

  describe('PATCH', () => {
    it('sends PATCH request', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ id: 1 }));

      const client = createClient();
      await client.patch('/items/1', { name: 'patched' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('PATCH');
    });
  });

  describe('error handling', () => {
    it('throws TimeoutError on abort', async () => {
      mockFetch.mockRejectedValueOnce(Object.assign(new Error('Aborted'), { name: 'AbortError' }));

      const client = createClient();
      await expect(client.get('/slow')).rejects.toBeInstanceOf(TimeoutError);
    });

    it('throws NetworkError on fetch TypeError', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      const client = createClient();
      await expect(client.get('/down')).rejects.toBeInstanceOf(NetworkError);
    });

    it('throws AppError with UNAUTHORIZED for 401', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: { message: 'Invalid token' } }, 401));

      const client = createClient();
      try {
        await client.get('/protected');
        expect.unreachable('Should throw');
      } catch (e) {
        expect(e).toBeInstanceOf(AppError);
        expect((e as AppError).statusCode).toBe(401);
        expect((e as AppError).code).toBe(ErrorCode.UNAUTHORIZED);
      }
    });

    it('throws AppError with FORBIDDEN for 403', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ message: 'Forbidden' }, 403));

      const client = createClient();
      try {
        await client.get('/admin');
        expect.unreachable('Should throw');
      } catch (e) {
        expect((e as AppError).statusCode).toBe(403);
        expect((e as AppError).code).toBe(ErrorCode.FORBIDDEN);
      }
    });

    it('throws AppError with NOT_FOUND for 404', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ message: 'Not found' }, 404));

      const client = createClient();
      try {
        await client.get('/missing');
        expect.unreachable('Should throw');
      } catch (e) {
        expect((e as AppError).statusCode).toBe(404);
        expect((e as AppError).code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('throws AppError with VALIDATION_FAILED for 400', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: { message: 'Bad data' } }, 400));

      const client = createClient();
      try {
        await client.post('/items', {});
        expect.unreachable('Should throw');
      } catch (e) {
        expect((e as AppError).statusCode).toBe(400);
        expect((e as AppError).code).toBe(ErrorCode.VALIDATION_FAILED);
      }
    });

    it('throws AppError with STRAPI_ERROR for 500', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ message: 'Server error' }, 500));

      const client = createClient();
      try {
        await client.get('/error');
        expect.unreachable('Should throw');
      } catch (e) {
        expect((e as AppError).statusCode).toBe(500);
        expect((e as AppError).code).toBe(ErrorCode.STRAPI_ERROR);
      }
    });

    it('extracts error message from Strapi error format', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(
        { error: { message: 'Strapi specific error' } },
        400
      ));

      const client = createClient();
      try {
        await client.get('/bad');
        expect.unreachable('Should throw');
      } catch (e) {
        expect((e as AppError).message).toBe('Strapi specific error');
      }
    });

    it('throws AppError on non-JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('<html>Error</html>'),
      });

      const client = createClient();
      await expect(client.get('/html')).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('URL building', () => {
    it('removes trailing slash from baseUrl', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}));

      const client = new HttpClient({ baseUrl: 'http://api.test/' });
      await client.get('/items');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://api.test/items');
    });

    it('adds leading slash to endpoint', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}));

      const client = createClient();
      await client.get('items');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://api.test/items');
    });
  });

  describe('headers', () => {
    it('includes Content-Type by default', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}));

      const client = createClient();
      await client.get('/items');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('merges custom headers', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}));

      const client = createClient({
        defaultHeaders: { 'X-Custom': 'value' },
      });
      await client.get('/items');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['X-Custom']).toBe('value');
    });
  });
});

describe('createAuthenticatedClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds Bearer token to requests', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}));

    const client = createAuthenticatedClient(
      { baseUrl: 'http://api.test' },
      'my-token'
    );
    await client.get('/items');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer my-token');
  });
});
