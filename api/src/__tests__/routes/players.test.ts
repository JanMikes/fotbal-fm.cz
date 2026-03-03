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

const mockPlayers = {
  data: [
    {
      id: 1,
      documentId: 'player-1',
      name: 'Jan Novák',
      slug: 'jan-novak',
      type: 'hráč',
      number: 9,
      sortOrder: 1,
      position: 'útočník',
      positionText: 'Střední útočník',
      bio: 'Odchovanec klubu, hráč A-týmu od roku 2020.',
      photo: {
        id: 30,
        url: '/uploads/novak_jan_portrait.jpg',
        alternativeText: 'Jan Novák',
        width: 400,
        height: 500,
      },
      instagram: 'https://instagram.com/jannovak',
      twitter: null,
      facebook: null,
      dateOfBirth: '1998-05-12',
      nationality: 'CZE',
      isActive: true,
      categories: [
        { id: 1, documentId: 'cat-1', name: 'A-tým', slug: 'a-tym', sortOrder: 1 },
      ],
    },
    {
      id: 2,
      documentId: 'player-2',
      name: 'Petr Svoboda',
      slug: 'petr-svoboda',
      type: 'realizační tým',
      number: null,
      sortOrder: 2,
      position: null,
      positionText: 'Hlavní trenér',
      bio: null,
      photo: null,
      instagram: null,
      twitter: null,
      facebook: null,
      dateOfBirth: '1975-01-20',
      nationality: 'CZE',
      isActive: true,
      categories: [
        { id: 1, documentId: 'cat-1', name: 'A-tým', slug: 'a-tym', sortOrder: 1 },
      ],
    },
  ],
  meta: { pagination: { page: 1, pageSize: 200, pageCount: 1, total: 2 } },
};

describe('GET /api/v1/players', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped players with photos', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce(mockPlayers);

    const res = await app.request('/api/v1/players?category=a-tym');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toEqual({
      documentId: 'player-1',
      name: 'Jan Novák',
      slug: 'jan-novak',
      type: 'hráč',
      number: 9,
      position: 'útočník',
      positionText: 'Střední útočník',
      bio: '<p>Odchovanec klubu, hráč A-týmu od roku 2020.</p>\n',
      photo: {
        url: 'http://localhost:8080/uploads/novak_jan_portrait.jpg',
        alternativeText: 'Jan Novák',
        width: 400,
        height: 500,
      },
      instagram: 'https://instagram.com/jannovak',
      twitter: null,
      facebook: null,
      dateOfBirth: '1998-05-12',
      nationality: 'CZE',
      isActive: true,
      categories: [{ documentId: 'cat-1', name: 'A-tým', slug: 'a-tym' }],
    });
  });

  it('handles staff member with null fields', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce(mockPlayers);

    const res = await app.request('/api/v1/players');
    const json = await res.json();

    const staff = json.data[1];
    expect(staff.type).toBe('realizační tým');
    expect(staff.number).toBeNull();
    expect(staff.position).toBeNull();
    expect(staff.photo).toBeNull();
    expect(staff.bio).toBeNull();
  });

  it('passes category filter to Strapi', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: [], meta: {} });

    await app.request('/api/v1/players?category=a-tym');

    expect(strapiGet).toHaveBeenCalledWith('/players', expect.objectContaining({
      sort: 'sortOrder:asc',
      filters: { categories: { slug: { $eq: 'a-tym' } } },
    }));
  });

  it('works without category filter', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: [], meta: {} });

    await app.request('/api/v1/players');

    expect(strapiGet).toHaveBeenCalledWith('/players', expect.objectContaining({
      filters: {},
    }));
  });
});
