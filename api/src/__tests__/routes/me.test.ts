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

const { strapiGet, strapiGetSingle, strapiPut } = await import('../../lib/strapi.js');
const { app } = await import('../../app.js');

const rodice = { id: 1, documentId: 'ac-1', name: 'Rodiče U12', slug: 'rodice-u12', description: null, sortOrder: 1, selectable: true };
const fanousci = { id: 2, documentId: 'ac-2', name: 'Fanoušci', slug: 'fanousci', description: null, sortOrder: 2, selectable: true };
const partneri = { id: 3, documentId: 'ac-3', name: 'Partneři', slug: 'partneri', description: null, sortOrder: 3, selectable: false };
const allCategories = [rodice, fanousci, partneri];
const me = { id: 40, username: 'jan', email: 'jan@test.cz' };
const auth = { Authorization: 'Bearer jwt-40' };

function mockUser(categories: typeof allCategories) {
  // 1st call: /users/me with the JWT; 2nd: /users/40?populate=... with the service token
  vi.mocked(strapiGetSingle).mockImplementation(async (path: string) => {
    if (path === '/users/me') return me as never;
    if (path.startsWith('/users/40')) return { ...me, audienceCategories: categories } as never;
    throw new Error(`unexpected path ${path}`);
  });
}

describe('/api/v1/me/audience-categories', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('GET requires a bearer token', async () => {
    const res = await app.request('/api/v1/me/audience-categories');
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Chybí autorizační hlavička');
  });

  it('GET returns 401 for an invalid token', async () => {
    vi.mocked(strapiGetSingle).mockRejectedValueOnce(new Error('401'));
    const res = await app.request('/api/v1/me/audience-categories', { headers: auth });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Neplatný nebo expirovaný token');
    expect(vi.mocked(strapiGetSingle)).toHaveBeenCalledWith('/users/me', 'jwt-40');
  });

  it('GET returns my categories including non-selectable ones', async () => {
    mockUser([partneri, rodice]);
    const res = await app.request('/api/v1/me/audience-categories', { headers: auth });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.map((c: { slug: string; selectable: boolean }) => [c.slug, c.selectable])).toEqual([
      ['rodice-u12', true],
      ['partneri', false],
    ]);
  });

  async function put(body: unknown, headers: Record<string, string> = auth) {
    return app.request('/api/v1/me/audience-categories', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  it('PUT replaces the list and writes numeric ids to Strapi', async () => {
    mockUser([rodice]);
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: allCategories, meta: {} } as never);
    vi.mocked(strapiPut).mockResolvedValueOnce({} as never);

    const res = await put({ audienceCategories: ['fanousci', 'rodice-u12', 'fanousci'] });
    expect(res.status).toBe(200);
    expect((await res.json()).data.map((c: { slug: string }) => c.slug)).toEqual(['rodice-u12', 'fanousci']);
    expect(vi.mocked(strapiPut)).toHaveBeenCalledWith('/users/40', { audienceCategories: [2, 1] });
  });

  it('PUT lets the user keep or drop a non-selectable category they already have', async () => {
    mockUser([partneri, rodice]);
    vi.mocked(strapiGet).mockResolvedValue({ data: allCategories, meta: {} } as never);
    vi.mocked(strapiPut).mockResolvedValue({} as never);

    const keep = await put({ audienceCategories: ['partneri'] });
    expect(keep.status).toBe(200);
    expect(vi.mocked(strapiPut)).toHaveBeenLastCalledWith('/users/40', { audienceCategories: [3] });

    const drop = await put({ audienceCategories: [] });
    expect(drop.status).toBe(200);
    expect((await drop.json()).data).toEqual([]);
    expect(vi.mocked(strapiPut)).toHaveBeenLastCalledWith('/users/40', { audienceCategories: [] });
  });

  it('PUT rejects a non-selectable category the user does not have', async () => {
    mockUser([rodice]);
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: allCategories, meta: {} } as never);

    const res = await put({ audienceCategories: ['partneri'] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Skupinu nelze zvolit: partneri');
    expect(vi.mocked(strapiPut)).not.toHaveBeenCalled();
  });

  it('PUT rejects an unknown slug', async () => {
    mockUser([]);
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: allCategories, meta: {} } as never);

    const res = await put({ audienceCategories: ['neexistuje'] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Neznámá skupina: neexistuje');
  });

  it('PUT validates the body shape', async () => {
    mockUser([]);
    const res = await put({ audienceCategories: 'rodice-u12' });
    expect(res.status).toBe(400);
  });
});
