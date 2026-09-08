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

const { strapiGet } = await import('../../lib/strapi.js');
const { app } = await import('../../app.js');

const categories = [
  { id: 2, documentId: 'ac-2', name: 'Fanoušci', slug: 'fanousci', description: null, sortOrder: 2, selectable: true },
  { id: 1, documentId: 'ac-1', name: 'Rodiče U12', slug: 'rodice-u12', description: 'Rodiče hráčů U12', sortOrder: 1, selectable: true },
  { id: 3, documentId: 'ac-3', name: 'Partneři', slug: 'partneri', description: null, sortOrder: 3, selectable: false },
];

describe('GET /api/v1/audience-categories', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns only selectable categories, sorted by sortOrder', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: categories, meta: {} } as never);

    const res = await app.request('/api/v1/audience-categories');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.map((c: { slug: string }) => c.slug)).toEqual(['rodice-u12', 'fanousci']);
    expect(json.data[0]).toEqual({
      documentId: 'ac-1',
      slug: 'rodice-u12',
      name: 'Rodiče U12',
      description: 'Rodiče hráčů U12',
      sortOrder: 1,
      selectable: true,
    });
    expect(vi.mocked(strapiGet)).toHaveBeenCalledWith('/audience-categories', expect.objectContaining({ sort: 'sortOrder:asc' }));
  });
});
