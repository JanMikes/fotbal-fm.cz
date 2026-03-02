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

const { strapiGetWithPagination } = await import('../../lib/strapi.js');
const { app } = await import('../../app.js');

const mockMatches = {
  data: [
    {
      id: 1,
      documentId: 'match-1',
      homeTeam: {
        id: 1,
        documentId: 'team-1',
        name: 'MFK Frýdek-Místek',
        logo: {
          id: 20,
          url: '/uploads/mfk_fm_logo_abc.png',
          alternativeText: 'MFK FM logo',
          width: 200,
          height: 200,
        },
      },
      awayTeam: {
        id: 2,
        documentId: 'team-2',
        name: 'FC Baník Ostrava B',
        logo: null,
      },
      homeScore: 3,
      awayScore: 1,
      matchDate: '2025-03-15',
      matchTime: '17:00',
      venue: 'Stadion Stovky',
      round: 20,
      competitionName: 'MSFL',
      tournament: { id: 1, documentId: 'tourn-1', name: 'MSFL 2024/25' },
      categories: [
        { id: 1, documentId: 'cat-1', name: 'A-tým', slug: 'a-tym', sortOrder: 1 },
      ],
    },
    {
      id: 2,
      documentId: 'match-2',
      homeTeam: {
        id: 3,
        documentId: 'team-3',
        name: 'SFC Opava',
        logo: {
          id: 21,
          url: '/uploads/opava_logo.png',
          alternativeText: null,
          width: 150,
          height: 150,
        },
      },
      awayTeam: {
        id: 1,
        documentId: 'team-1',
        name: 'MFK Frýdek-Místek',
        logo: {
          id: 20,
          url: '/uploads/mfk_fm_logo_abc.png',
          alternativeText: 'MFK FM logo',
          width: 200,
          height: 200,
        },
      },
      homeScore: null,
      awayScore: null,
      matchDate: '2025-04-05',
      matchTime: '15:00',
      venue: 'Městský stadion Opava',
      round: 25,
      competitionName: 'MSFL',
      tournament: { id: 1, documentId: 'tourn-1', name: 'MSFL 2024/25' },
      categories: [
        { id: 1, documentId: 'cat-1', name: 'A-tým', slug: 'a-tym', sortOrder: 1 },
      ],
    },
  ],
  pagination: { page: 1, pageSize: 20, pageCount: 1, total: 2 },
};

describe('GET /api/v1/matches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped matches with team logos and pagination', async () => {
    vi.mocked(strapiGetWithPagination).mockResolvedValueOnce(mockMatches);

    const res = await app.request('/api/v1/matches');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.pagination).toEqual({ page: 1, pageSize: 20, pageCount: 1, total: 2 });

    // Finished match
    expect(json.data[0]).toEqual({
      documentId: 'match-1',
      homeTeam: {
        name: 'MFK Frýdek-Místek',
        logo: {
          url: 'http://localhost:8080/uploads/mfk_fm_logo_abc.png',
          alternativeText: 'MFK FM logo',
          width: 200,
          height: 200,
        },
      },
      awayTeam: {
        name: 'FC Baník Ostrava B',
        logo: null,
      },
      homeScore: 3,
      awayScore: 1,
      matchDate: '2025-03-15',
      matchTime: '17:00',
      venue: 'Stadion Stovky',
      round: 20,
      competitionName: 'MSFL',
      tournamentName: 'MSFL 2024/25',
      status: 'finished',
      categories: [{ documentId: 'cat-1', name: 'A-tým', slug: 'a-tym' }],
    });
  });

  it('determines status based on homeScore', async () => {
    vi.mocked(strapiGetWithPagination).mockResolvedValueOnce(mockMatches);

    const res = await app.request('/api/v1/matches');
    const json = await res.json();

    expect(json.data[0].status).toBe('finished');
    expect(json.data[1].status).toBe('upcoming');
  });

  it('filters by status=upcoming', async () => {
    vi.mocked(strapiGetWithPagination).mockResolvedValueOnce({ data: [], pagination: { page: 1, pageSize: 20, pageCount: 0, total: 0 } });

    await app.request('/api/v1/matches?status=upcoming');

    expect(strapiGetWithPagination).toHaveBeenCalledWith('/matches', expect.objectContaining({
      sort: 'matchDate:asc',
      filters: { homeScore: { $null: true } },
    }));
  });

  it('filters by status=finished', async () => {
    vi.mocked(strapiGetWithPagination).mockResolvedValueOnce({ data: [], pagination: { page: 1, pageSize: 20, pageCount: 0, total: 0 } });

    await app.request('/api/v1/matches?status=finished');

    expect(strapiGetWithPagination).toHaveBeenCalledWith('/matches', expect.objectContaining({
      sort: 'matchDate:desc',
      filters: { homeScore: { $notNull: true } },
    }));
  });

  it('passes category and pagination params', async () => {
    vi.mocked(strapiGetWithPagination).mockResolvedValueOnce({ data: [], pagination: { page: 2, pageSize: 10, pageCount: 3, total: 25 } });

    await app.request('/api/v1/matches?category=a-tym&page=2&pageSize=10');

    expect(strapiGetWithPagination).toHaveBeenCalledWith('/matches', expect.objectContaining({
      pagination: { page: 2, pageSize: 10 },
      filters: { categories: { slug: { $eq: 'a-tym' } } },
    }));
  });
});
