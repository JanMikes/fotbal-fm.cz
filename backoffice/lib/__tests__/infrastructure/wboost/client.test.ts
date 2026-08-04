import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Dynamic imports AFTER stubs
const { WboostClient } = await import('@/lib/infrastructure/wboost/client');
const { AppError } = await import('@/lib/core/errors');

// ---------- Helpers ----------------------------------------------------------

const CFG = {
  apiBase: 'http://wboost.test',
  clientId: 'cid',
  clientSecret: 'secret',
  projectId: 'proj1',
  thumbnailsEnabled: false,
};

function makeFakeTokenManager(token = 'Bearer-token') {
  return {
    getToken: vi.fn().mockResolvedValue(token),
    invalidate: vi.fn(),
  };
}

function mockJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode('PNG').buffer),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function mockBinaryResponse(bytes: Uint8Array, contentType = 'image/png', status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h === 'content-type' ? contentType : null) },
    arrayBuffer: () => Promise.resolve(bytes.buffer),
    json: () => Promise.reject(new Error('not JSON')),
    text: () => Promise.resolve(''),
  };
}

// ---------- Tests ------------------------------------------------------------

describe('WboostClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listTemplates', () => {
    it('returns parsed array and sends Authorization: Bearer header', async () => {
      const rawTemplates = [{ id: 't1', name: 'Template 1', position: 0, variants: [] }];
      mockFetch.mockResolvedValueOnce(mockJsonResponse(rawTemplates));

      const tm = makeFakeTokenManager('my-token');
      const client = new WboostClient(CFG, tm as never);

      const result = await client.listTemplates();

      expect(result).toEqual(rawTemplates);
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://wboost.test/api/projects/proj1/templates');
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer my-token');
    });
  });

  describe('renderVariant', () => {
    it('POSTs {inputs} JSON and returns Uint8Array from arrayBuffer', async () => {
      const pngBytes = new Uint8Array([137, 80, 78, 71]);
      mockFetch.mockResolvedValueOnce(mockBinaryResponse(pngBytes));

      const tm = makeFakeTokenManager();
      const client = new WboostClient(CFG, tm as never);

      const result = await client.renderVariant('v1', { inp1: 'hello' });

      expect(result).toBeInstanceOf(Uint8Array);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://wboost.test/api/template-variants/v1/export');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
      expect(JSON.parse(init.body as string)).toEqual({ inputs: { inp1: 'hello' } });
    });

    it('includes `images` in the body when provided', async () => {
      mockFetch.mockResolvedValueOnce(mockBinaryResponse(new Uint8Array([1])));
      const client = new WboostClient(CFG, makeFakeTokenManager() as never);

      await client.renderVariant('v1', { t: 'x' }, { s: 'img-1' });

      const [, init] = mockFetch.mock.calls[0];
      expect(JSON.parse(init.body as string)).toEqual({ inputs: { t: 'x' }, images: { s: 'img-1' } });
    });

    it('omits the `images` key when images is empty (backward-compatible)', async () => {
      mockFetch.mockResolvedValueOnce(mockBinaryResponse(new Uint8Array([1])));
      const client = new WboostClient(CFG, makeFakeTokenManager() as never);

      await client.renderVariant('v1', { t: 'x' }, {});

      const [, init] = mockFetch.mock.calls[0];
      expect(JSON.parse(init.body as string)).toEqual({ inputs: { t: 'x' } });
    });
  });

  describe('listPlaceholderImages', () => {
    it('GETs the slot images URL with Authorization and returns the parsed array', async () => {
      const images = [{ id: 'g1', url: 'u', directoryId: 'd', directoryName: 'D', uploadedAt: 't' }];
      mockFetch.mockResolvedValueOnce(mockJsonResponse(images));

      const client = new WboostClient(CFG, makeFakeTokenManager('tok') as never);
      const result = await client.listPlaceholderImages('v1', 'slot-1');

      expect(result).toEqual(images);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'http://wboost.test/api/template-variants/v1/placeholders/slot-1/images'
      );
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
    });
  });

  describe('uploadPlaceholderImage', () => {
    it('POSTs multipart form (file + directoryId), no Content-Type override', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ id: 'new', url: 'u', directoryId: 'd' }));

      const client = new WboostClient(CFG, makeFakeTokenManager() as never);
      const blob = new Blob([new Uint8Array([1, 2])], { type: 'image/png' });
      const result = await client.uploadPlaceholderImage('v1', 'slot-1', blob, 'p.png', 'dir-9');

      expect(result.id).toBe('new');

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'http://wboost.test/api/template-variants/v1/placeholders/slot-1/images'
      );
      expect(init.method).toBe('POST');
      expect(init.body).toBeInstanceOf(FormData);
      const form = init.body as FormData;
      expect(form.get('directoryId')).toBe('dir-9');
      expect(form.get('file')).toBeInstanceOf(Blob);
      // fetch must set the multipart boundary itself
      expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    });
  });

  describe('fetchThumbnail', () => {
    it('returns body and contentType', async () => {
      const pngBytes = new Uint8Array([1, 2, 3]);
      mockFetch.mockResolvedValueOnce(mockBinaryResponse(pngBytes, 'image/png'));

      const tm = makeFakeTokenManager();
      const client = new WboostClient(CFG, tm as never);

      const result = await client.fetchThumbnail('v2');

      expect(result.body).toBeInstanceOf(Uint8Array);
      expect(result.contentType).toBe('image/png');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://wboost.test/api/template-variants/v2/thumbnail');
    });
  });

  describe('401 retry logic', () => {
    it('invalidates token and retries on 401, succeeds on second call', async () => {
      const rawTemplates = [{ id: 't1', name: 'T1', position: 0, variants: [] }];

      // First call returns 401
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ error: 'unauthorized' }, 401));
      // Second call (after token refresh) returns 200
      mockFetch.mockResolvedValueOnce(mockJsonResponse(rawTemplates));

      const tm = makeFakeTokenManager();
      const client = new WboostClient(CFG, tm as never);

      const result = await client.listTemplates();

      expect(result).toEqual(rawTemplates);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(tm.invalidate).toHaveBeenCalledOnce();
      // getToken called twice (once for initial call, once after invalidate)
      expect(tm.getToken).toHaveBeenCalledTimes(2);
    });
  });

  describe('error status mapping', () => {
    it.each([
      [400, 'VALIDATION_FAILED', 400],
      [403, 'FORBIDDEN', 403],
      [404, 'NOT_FOUND', 404],
      [500, 'INTERNAL_ERROR', 500],
    ])('maps HTTP %i to AppError with code %s and statusCode %i', async (status, code, expectedStatus) => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({}, status));

      const tm = makeFakeTokenManager();
      const client = new WboostClient(CFG, tm as never);

      try {
        await client.listTemplates();
        expect.unreachable('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AppError);
        const ae = e as InstanceType<typeof AppError>;
        expect(ae.code).toBe(code);
        expect(ae.statusCode).toBe(expectedStatus);
      }
    });

    it('throws AppError with correct message for 400', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({}, 400));

      const tm = makeFakeTokenManager();
      const client = new WboostClient(CFG, tm as never);

      try {
        await client.listTemplates();
        expect.unreachable('should have thrown');
      } catch (e) {
        const ae = e as InstanceType<typeof AppError>;
        expect(ae.message).toContain('příliš dlouhá');
      }
    });

    it('carries the structured container_overflow body as AppError.details with a specific message', async () => {
      const body = {
        error: 'Container content overflows its max height. Shorten the texts of its inputs.',
        code: 'container_overflow',
        containerId: 'cont-1',
        overflowPx: 37.5,
      };
      mockFetch.mockResolvedValueOnce(mockJsonResponse(body, 400));

      const tm = makeFakeTokenManager();
      const client = new WboostClient(CFG, tm as never);

      try {
        await client.renderVariant('v1', { inp1: 'too long' });
        expect.unreachable('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AppError);
        const ae = e as InstanceType<typeof AppError>;
        expect(ae.statusCode).toBe(400);
        expect(ae.message).toContain('nevejdou do vymezené oblasti');
        expect(ae.details).toEqual(body);
      }
    });

    it('builds URLs from apiBase, not hardcoded hosts', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse([], 200));

      const customCfg = { ...CFG, apiBase: 'http://custom.host:9999' };
      const tm = makeFakeTokenManager();
      const client = new WboostClient(customCfg, tm as never);

      await client.listTemplates();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('http://custom.host:9999');
    });
  });
});
