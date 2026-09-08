import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/strapi.js', () => ({
  strapiGet: vi.fn(),
  strapiGetWithPagination: vi.fn(),
  strapiGetSingleEntry: vi.fn(),
  strapiPost: vi.fn(),
  strapiGetSingle: vi.fn(),
  strapiPut: vi.fn(),
  strapiDelete: vi.fn(),
}));

const { strapiGet, strapiGetSingle, strapiPost, strapiPut } = await import('../../lib/strapi.js');
const { app } = await import('../../app.js');
const { resetDeepLinkLimiters } = await import('../../lib/deep-link-limits.js');

const rodice = { id: 1, documentId: 'ac-1', name: 'Rodiče U12', slug: 'rodice-u12', description: null, sortOrder: 1, selectable: true };
const fanousci = { id: 2, documentId: 'ac-2', name: 'Fanoušci', slug: 'fanousci', description: null, sortOrder: 2, selectable: true };
const partneri = { id: 3, documentId: 'ac-3', name: 'Partneři', slug: 'partneri', description: null, sortOrder: 3, selectable: false };
const allCategories = [rodice, fanousci, partneri];

const link = {
  id: 7,
  documentId: 'dl-7',
  name: 'Rodiče U12 podzim',
  code: '7K3M9PQ2',
  url: 'https://fotbal-fm.cz/a/7K3M9PQ2',
  active: true,
  expiresAt: null,
  claimsCount: 4,
  audienceCategories: [rodice, partneri],
};
const me = { id: 40, username: 'jan', email: 'jan@test.cz' };
const auth = { Authorization: 'Bearer jwt-40' };

type StrapiGetMock = (path: string, options?: { filters?: Record<string, unknown> }) => Promise<unknown>;

function mockUser(categories: typeof allCategories) {
  vi.mocked(strapiGetSingle).mockImplementation(async (path: string) => {
    if (path === '/users/me') return me as never;
    if (path.startsWith('/users/40')) return { ...me, audienceCategories: categories } as never;
    throw new Error(`unexpected path ${path}`);
  });
}

/** Routes Strapi collection reads by path; `claims` = existing claim rows for the user. */
function mockStrapiGet({ links = [link], claims = [] as unknown[], ownLinks = [] as unknown[] } = {}) {
  vi.mocked(strapiGet).mockImplementation((async (path, options) => {
    if (path === '/deep-links' && options?.filters && 'code' in options.filters) {
      const wanted = (options.filters.code as { $eq: string }).$eq;
      return { data: links.filter((l) => (l as { code: string }).code === wanted), meta: {} };
    }
    if (path === '/deep-links') return { data: ownLinks, meta: {} };
    if (path === '/deep-link-claims') return { data: claims, meta: {} };
    if (path === '/audience-categories') return { data: allCategories, meta: {} };
    throw new Error(`unexpected path ${path}`);
  }) as StrapiGetMock as never);
}

describe('Deep link routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetDeepLinkLimiters();
  });

  describe('GET /api/v1/deep-links/{code}', () => {
    it('resolves a valid link case-insensitively and ignores dashes', async () => {
      mockStrapiGet();
      const res = await app.request('/api/v1/deep-links/7k3m-9pq2');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual({
        code: '7K3M9PQ2',
        url: 'https://fotbal-fm.cz/a/7K3M9PQ2',
        name: 'Rodiče U12 podzim',
        active: true,
        expiresAt: null,
        audienceCategories: [
          { documentId: 'ac-1', slug: 'rodice-u12', name: 'Rodiče U12', description: null, sortOrder: 1, selectable: true },
          { documentId: 'ac-3', slug: 'partneri', name: 'Partneři', description: null, sortOrder: 3, selectable: false },
        ],
      });
    });

    it('falls back to the Crockford variant for a mistyped O/I/L', async () => {
      mockStrapiGet();
      const res = await app.request('/api/v1/deep-links/7K3M9PQ2'.replace('9PQ2', '9PQ2').replace('7K3M', '7K3M'));
      expect(res.status).toBe(200);
      const typo = await app.request('/api/v1/deep-links/7k3m9pqz'); // Z is valid, so still 404 — control case
      expect(typo.status).toBe(404);
      const oh = await app.request('/api/v1/deep-links/7K3M9PQ2'.replace('0', 'O'));
      expect(oh.status).toBe(200);
    });

    it('returns 404 with a reason for unknown, inactive and expired links', async () => {
      mockStrapiGet({ links: [link, { ...link, code: 'INACT123', active: false }, { ...link, code: 'EXPIRED1', expiresAt: '2020-01-01T00:00:00Z' }] });

      const unknown = await app.request('/api/v1/deep-links/NOPE1234');
      expect(unknown.status).toBe(404);
      expect(await unknown.json()).toEqual({ error: 'Odkaz neexistuje.', reason: 'not_found' });

      const inactive = await app.request('/api/v1/deep-links/INACT123');
      expect(inactive.status).toBe(404);
      expect((await inactive.json()).reason).toBe('inactive');

      const expired = await app.request('/api/v1/deep-links/EXPIRED1');
      expect(expired.status).toBe(404);
      expect((await expired.json()).reason).toBe('expired');
    });

    it('rate limits by client IP', async () => {
      mockStrapiGet();
      const headers = { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' };
      for (let i = 0; i < 60; i += 1) {
        expect((await app.request('/api/v1/deep-links/7K3M9PQ2', { headers })).status).toBe(200);
      }
      expect((await app.request('/api/v1/deep-links/7K3M9PQ2', { headers })).status).toBe(429);
      expect((await app.request('/api/v1/deep-links/7K3M9PQ2', { headers: { 'x-forwarded-for': '198.51.100.1' } })).status).toBe(200);
    });
  });

  describe('POST /api/v1/deep-links/{code}/claim', () => {
    const claim = (code: string, headers: Record<string, string> = auth) =>
      app.request(`/api/v1/deep-links/${code}/claim`, { method: 'POST', headers });

    it('requires a bearer token', async () => {
      expect((await claim('7K3M9PQ2', {})).status).toBe(401);
    });

    it('adds the missing categories, records the claim and bumps the counter', async () => {
      mockUser([fanousci]);
      mockStrapiGet();
      vi.mocked(strapiPut).mockResolvedValue({} as never);
      vi.mocked(strapiPost).mockResolvedValue({} as never);

      const res = await claim('7K3M9PQ2', { ...auth, 'X-App-Platform': 'ios' });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.claimed).toBe(true);
      expect(json.data.alreadyClaimed).toBe(false);
      expect(json.data.addedAudienceCategories.map((c: { slug: string }) => c.slug)).toEqual(['rodice-u12', 'partneri']);
      expect(json.data.audienceCategories.map((c: { slug: string }) => c.slug)).toEqual(['rodice-u12', 'fanousci', 'partneri']);

      expect(vi.mocked(strapiPut)).toHaveBeenCalledWith('/users/40', { audienceCategories: [2, 1, 3] });
      expect(vi.mocked(strapiPost)).toHaveBeenCalledWith('/deep-link-claims', {
        data: expect.objectContaining({ deepLink: 'dl-7', user: 40, source: 'claim', platform: 'ios', label: expect.stringContaining('jan · ') }),
      });
      expect(vi.mocked(strapiPut)).toHaveBeenCalledWith('/deep-links/dl-7', { data: { claimsCount: 5 } });
    });

    it('is a no-op for a user who already claimed the link', async () => {
      mockUser([fanousci]);
      mockStrapiGet({ claims: [{ id: 99 }] });

      const res = await claim('7K3M9PQ2');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.alreadyClaimed).toBe(true);
      expect(json.data.addedAudienceCategories).toEqual([]);
      expect(json.data.audienceCategories.map((c: { slug: string }) => c.slug)).toEqual(['fanousci']);
      expect(vi.mocked(strapiPut)).not.toHaveBeenCalled();
      expect(vi.mocked(strapiPost)).not.toHaveBeenCalled();
    });

    it('returns 404 for an inactive link without touching the user', async () => {
      mockUser([]);
      mockStrapiGet({ links: [{ ...link, active: false }] });
      const res = await claim('7K3M9PQ2');
      expect(res.status).toBe(404);
      expect((await res.json()).reason).toBe('inactive');
      expect(vi.mocked(strapiPut)).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/deep-links (invite a friend)', () => {
    const create = (body?: unknown, headers: Record<string, string> = auth) =>
      app.request('/api/v1/deep-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    const created = { ...link, id: 8, documentId: 'dl-8', code: 'NEWCODE1', url: 'https://fotbal-fm.cz/a/NEWCODE1', name: 'Pozvánka od jan', claimsCount: 0 };

    it('requires a bearer token', async () => {
      expect((await create({}, {})).status).toBe(401);
    });

    it('defaults to the inviter\'s selectable categories and names the link after them', async () => {
      mockUser([rodice, partneri]);
      mockStrapiGet();
      vi.mocked(strapiPost).mockResolvedValueOnce({ data: { ...created, audienceCategories: [rodice] } } as never);

      const res = await create();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.code).toBe('NEWCODE1');
      expect(json.data.audienceCategories.map((c: { slug: string }) => c.slug)).toEqual(['rodice-u12']);
      expect(vi.mocked(strapiPost)).toHaveBeenCalledWith(expect.stringMatching(/^\/deep-links\?populate/), {
        data: { name: 'Pozvánka od jan', audienceCategories: [1], createdByUser: 40, active: true },
      });
    });

    it('accepts an empty JSON body as "share my own categories"', async () => {
      mockUser([fanousci]);
      mockStrapiGet();
      vi.mocked(strapiPost).mockResolvedValueOnce({ data: { ...created, audienceCategories: [fanousci] } } as never);

      const res = await app.request('/api/v1/deep-links', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: '' });
      expect(res.status).toBe(200);
      expect(vi.mocked(strapiPost)).toHaveBeenCalledWith(expect.any(String), { data: expect.objectContaining({ audienceCategories: [2] }) });
    });

    it('treats null fields like omitted ones (.NET clients serialise unset properties as null)', async () => {
      mockUser([fanousci]);
      mockStrapiGet();
      vi.mocked(strapiPost).mockResolvedValueOnce({ data: { ...created, audienceCategories: [fanousci] } } as never);

      const res = await create({ audienceCategories: null, name: null });
      expect(res.status).toBe(200);
      expect(vi.mocked(strapiPost)).toHaveBeenCalledWith(expect.any(String), {
        data: { name: 'Pozvánka od jan', audienceCategories: [2], createdByUser: 40, active: true },
      });
    });

    it('honours an explicit category list and custom name', async () => {
      mockUser([]);
      mockStrapiGet();
      vi.mocked(strapiPost).mockResolvedValueOnce({ data: { ...created, name: 'Moje pozvánka', audienceCategories: [rodice, fanousci] } } as never);

      const res = await create({ audienceCategories: ['fanousci', 'rodice-u12'], name: '  Moje pozvánka ' });
      expect(res.status).toBe(200);
      expect(vi.mocked(strapiPost)).toHaveBeenCalledWith(expect.any(String), {
        data: { name: 'Moje pozvánka', audienceCategories: [2, 1], createdByUser: 40, active: true },
      });
    });

    it('rejects non-selectable and unknown categories', async () => {
      mockUser([]);
      mockStrapiGet();

      const nonSelectable = await create({ audienceCategories: ['partneri'] });
      expect(nonSelectable.status).toBe(400);
      expect((await nonSelectable.json()).error).toBe('Skupinu nelze sdílet pozvánkou: partneri');

      const unknown = await create({ audienceCategories: ['x'] });
      expect(unknown.status).toBe(400);
      expect((await unknown.json()).error).toBe('Neznámá skupina: x');
      expect(vi.mocked(strapiPost)).not.toHaveBeenCalled();
    });

    it('reuses an identical active link instead of minting a new code', async () => {
      mockUser([rodice]);
      const existing = { ...link, code: 'EXIST001', audienceCategories: [rodice] };
      mockStrapiGet({ ownLinks: [{ ...existing, active: false }, existing] });

      const res = await create();
      expect(res.status).toBe(200);
      expect((await res.json()).data.code).toBe('EXIST001');
      expect(vi.mocked(strapiPost)).not.toHaveBeenCalled();
      expect(vi.mocked(strapiGet)).toHaveBeenCalledWith('/deep-links', expect.objectContaining({
        filters: { createdByUser: { id: { $eq: 40 } }, active: { $eq: true } },
      }));
    });
  });
});
