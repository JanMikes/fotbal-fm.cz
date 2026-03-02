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

const mockStandings = {
  data: [
    {
      id: 1,
      documentId: 'std-1',
      position: 1,
      team: {
        id: 1,
        documentId: 'team-1',
        name: 'MFK Frýdek-Místek',
        logo: {
          id: 20,
          url: '/uploads/mfk_fm_logo.png',
          alternativeText: 'MFK FM',
          width: 200,
          height: 200,
        },
      },
      matchesPlayed: 20,
      wins: 15,
      draws: 3,
      losses: 2,
      goalsFor: 45,
      goalsAgainst: 12,
      points: 48,
      tournament: { id: 1, documentId: 'tourn-1', name: 'MSFL 2024/25' },
      categories: [{ id: 1, documentId: 'cat-1', name: 'A-tým', slug: 'a-tym', sortOrder: 1 }],
    },
    {
      id: 2,
      documentId: 'std-2',
      position: 2,
      team: {
        id: 2,
        documentId: 'team-2',
        name: 'FC Baník Ostrava B',
        logo: null,
      },
      matchesPlayed: 20,
      wins: 14,
      draws: 2,
      losses: 4,
      goalsFor: 38,
      goalsAgainst: 18,
      points: 44,
      tournament: { id: 1, documentId: 'tourn-1', name: 'MSFL 2024/25' },
      categories: [{ id: 1, documentId: 'cat-1', name: 'A-tým', slug: 'a-tym', sortOrder: 1 }],
    },
  ],
  meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 2 } },
};

describe('GET /api/v1/standings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped standings with team logos', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce(mockStandings);

    const res = await app.request('/api/v1/standings?category=a-tym');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toEqual({
      position: 1,
      team: {
        name: 'MFK Frýdek-Místek',
        logo: {
          url: 'http://localhost:8080/uploads/mfk_fm_logo.png',
          alternativeText: 'MFK FM',
          width: 200,
          height: 200,
        },
      },
      matchesPlayed: 20,
      wins: 15,
      draws: 3,
      losses: 2,
      goalsFor: 45,
      goalsAgainst: 12,
      points: 48,
      tournamentName: 'MSFL 2024/25',
    });
  });

  it('handles team with null logo', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce(mockStandings);

    const res = await app.request('/api/v1/standings?category=a-tym');
    const json = await res.json();

    expect(json.data[1].team).toEqual({
      name: 'FC Baník Ostrava B',
      logo: null,
    });
  });

  it('passes category filter to Strapi', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: [], meta: {} });

    await app.request('/api/v1/standings?category=a-tym');

    expect(strapiGet).toHaveBeenCalledWith('/standings', expect.objectContaining({
      sort: 'position:asc',
      filters: { categories: { slug: { $eq: 'a-tym' } } },
    }));
  });

  it('requires category parameter', async () => {
    const res = await app.request('/api/v1/standings');
    expect(res.status).toBe(400);
  });
});
