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

describe('GET /api/v1/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped categories', async () => {
    const mockCategories = {
      data: [
        { id: 1, documentId: 'cat-1', name: 'Muži', slug: 'muzi', sortOrder: 1, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
        { id: 2, documentId: 'cat-2', name: 'Ženy', slug: 'zeny', sortOrder: 2, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      ],
      meta: { pagination: { total: 2 } },
    };

    vi.mocked(strapiGet).mockResolvedValueOnce(mockCategories);

    const res = await app.request('/api/v1/categories');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toEqual({
      id: 1,
      documentId: 'cat-1',
      name: 'Muži',
      slug: 'muzi',
      sortOrder: 1,
    });
    expect(json.data[1]).toEqual({
      id: 2,
      documentId: 'cat-2',
      name: 'Ženy',
      slug: 'zeny',
      sortOrder: 2,
    });
  });

  it('calls strapiGet with correct parameters', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: [], meta: {} });

    await app.request('/api/v1/categories');

    expect(strapiGet).toHaveBeenCalledWith('/categories', {
      sort: 'sortOrder:asc',
      pagination: { pageSize: 100 },
    });
  });

  it('returns empty array when no categories', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: [], meta: {} });

    const res = await app.request('/api/v1/categories');
    const json = await res.json();
    expect(json.data).toEqual([]);
  });
});
