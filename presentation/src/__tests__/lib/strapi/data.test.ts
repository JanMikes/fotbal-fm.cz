import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    strapi: { url: 'http://strapi:1337', apiToken: 'test-token' },
    publicUploadsUrl: 'http://uploads.test',
  },
}));

const mockFindMany = vi.fn();
vi.mock('../../../lib/strapi/client', () => ({
  getStrapiClient: () => ({
    findMany: mockFindMany,
  }),
}));

const {
  getCategories,
  getCategoryBySlug,
  getNewsArticlesByCategory,
  getNewsArticleBySlug,
  getMatchesByCategory,
  getPlayersByCategory,
  getPlayerBySlug,
} = await import('../../../lib/strapi/data');

describe('data layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCategories', () => {
    it('returns mapped categories', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          { id: 1, documentId: 'cat-1', name: 'Muži', slug: 'muzi', sortOrder: 1 },
        ],
        total: 1,
      });

      const result = await getCategories();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Muži');
      expect(result[0].documentId).toBe('cat-1');
    });

    it('passes correct query options', async () => {
      mockFindMany.mockResolvedValueOnce({ data: [], total: 0 });

      await getCategories();

      expect(mockFindMany).toHaveBeenCalledWith('categories', {
        filters: { hidden: { $ne: true } },
        sort: 'sortOrder:asc',
        pagination: { pageSize: 100 },
      });
    });
  });

  describe('getCategoryBySlug', () => {
    it('returns category when found', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [{ id: 1, documentId: 'cat-1', name: 'Muži', slug: 'muzi', sortOrder: 1 }],
        total: 1,
      });

      const result = await getCategoryBySlug('muzi');
      expect(result?.name).toBe('Muži');
    });

    it('returns null when not found', async () => {
      mockFindMany.mockResolvedValueOnce({ data: [], total: 0 });

      const result = await getCategoryBySlug('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getNewsArticlesByCategory', () => {
    it('returns articles and total', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          {
            id: 1, documentId: 'art-1', title: 'Test', slug: 'test',
            description: null, video: null, mainPhoto: null, gallery: null,
            categories: [], newsArticleType: null, relatedNews: null,
            createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
        total: 1,
      });

      const result = await getNewsArticlesByCategory('muzi');
      expect(result.articles).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('passes pagination params', async () => {
      mockFindMany.mockResolvedValueOnce({ data: [], total: 0 });

      await getNewsArticlesByCategory('muzi', 2, 10);

      expect(mockFindMany).toHaveBeenCalledWith('news-articles', expect.objectContaining({
        pagination: { page: 2, pageSize: 10 },
      }));
    });
  });

  describe('getNewsArticleBySlug', () => {
    it('returns article when found', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          {
            id: 1, documentId: 'art-1', title: 'Test', slug: 'test',
            description: null, video: null, mainPhoto: null, gallery: null,
            categories: [], newsArticleType: null, relatedNews: [],
            createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
        total: 1,
      });

      const result = await getNewsArticleBySlug('test');
      expect(result?.title).toBe('Test');
    });

    it('returns null when not found', async () => {
      mockFindMany.mockResolvedValueOnce({ data: [], total: 0 });

      const result = await getNewsArticleBySlug('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getMatchesByCategory', () => {
    it('returns mapped matches', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          {
            id: 1, documentId: 'match-1', homeTeam: 'A', awayTeam: 'B',
            homeScore: 1, awayScore: 0, matchDate: '2025-03-15',
            matchTime: '17:00', venue: 'Stadion', round: 1,
            competitionName: 'Liga', competitionCode: null,
            season: null, period: null, organizingBody: null, facrId: null,
            categories: null, createdAt: '2025-01-01', updatedAt: '2025-01-01',
          },
        ],
        total: 1,
      });

      const result = await getMatchesByCategory('muzi');
      expect(result).toHaveLength(1);
      expect(result[0].homeTeam).toBe('A');
      expect(result[0].status).toBe('finished');
    });
  });

  describe('getPlayersByCategory', () => {
    it('returns mapped players', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          {
            id: 1, documentId: 'player-1', name: 'Jan', slug: 'jan',
            type: 'hráč', number: 10, sortOrder: 1, position: 'záložník',
            positionText: null, bio: null, photo: null, instagram: null,
            twitter: null, facebook: null, categories: [],
            facrId: null, dateOfBirth: null, nationality: null,
            facrUuid: null, isActive: true,
            createdAt: '2024-01-01', updatedAt: '2024-01-01',
          },
        ],
        total: 1,
      });

      const result = await getPlayersByCategory('muzi');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Jan');
    });
  });

  describe('getPlayerBySlug', () => {
    it('returns player when found', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          {
            id: 1, documentId: 'player-1', name: 'Jan', slug: 'jan',
            type: 'hráč', number: 10, sortOrder: 1, position: 'záložník',
            positionText: null, bio: null, photo: null, instagram: null,
            twitter: null, facebook: null, categories: [],
            facrId: null, dateOfBirth: null, nationality: null,
            facrUuid: null, isActive: true,
            createdAt: '2024-01-01', updatedAt: '2024-01-01',
          },
        ],
        total: 1,
      });

      const result = await getPlayerBySlug('jan');
      expect(result?.name).toBe('Jan');
    });

    it('returns null when not found', async () => {
      mockFindMany.mockResolvedValueOnce({ data: [], total: 0 });

      const result = await getPlayerBySlug('nonexistent');
      expect(result).toBeNull();
    });
  });
});
