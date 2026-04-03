import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/strapi.js', () => ({
  strapiGet: vi.fn(),
  strapiPost: vi.fn(),
  strapiGetSingle: vi.fn(),
  strapiPut: vi.fn(),
  strapiDelete: vi.fn(),
}));

const { strapiGet } = await import('../../lib/strapi.js');
const { app } = await import('../../app.js');

describe('GET /api/v1/navigation-pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns pages with title and slug only', async () => {
    const mockPages = {
      data: [
        { id: 1, documentId: 'page-1', title: 'O klubu', slug: 'o-klubu' },
        { id: 2, documentId: 'page-2', title: 'Kontakt', slug: 'kontakt' },
      ],
      meta: { pagination: { total: 2 } },
    };

    vi.mocked(strapiGet).mockResolvedValueOnce(mockPages);

    const res = await app.request('/api/v1/navigation-pages');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toEqual({ title: 'O klubu', slug: 'o-klubu' });
    expect(json.data[1]).toEqual({ title: 'Kontakt', slug: 'kontakt' });
  });

  it('calls strapiGet with correct filters and fields', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: [], meta: {} });

    await app.request('/api/v1/navigation-pages');

    expect(strapiGet).toHaveBeenCalledWith('/pages', {
      filters: { show_in_categories_nav: { $eq: true } },
      fields: ['title', 'slug'],
      pagination: { pageSize: 100 },
    });
  });

  it('returns empty array when no pages match', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: [], meta: {} });

    const res = await app.request('/api/v1/navigation-pages');
    const json = await res.json();
    expect(json.data).toEqual([]);
  });
});
