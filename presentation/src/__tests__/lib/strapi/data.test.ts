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
  getUpcomingMatches,
  getFinishedMatches,
  getPlayersByCategory,
  getPlayerBySlug,
  getNavigation,
  getPageBySlug,
  getPartners,
  getPartnerBySlug,
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

  describe('getUpcomingMatches', () => {
    it('returns mapped upcoming matches', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          {
            id: 1, documentId: 'match-1',
            homeTeam: { id: 1, documentId: 'team-1', name: 'A' },
            awayTeam: { id: 2, documentId: 'team-2', name: 'B' },
            homeScore: null, awayScore: null, matchDate: '2026-06-15',
            matchTime: '17:00', venue: 'Stadion', round: 1,
            competitionName: 'Liga', competitionCode: null,
            season: null, period: null, organizingBody: null, facrId: null,
            categories: null, createdAt: '2025-01-01', updatedAt: '2025-01-01',
          },
        ],
        total: 1,
      });

      const result = await getUpcomingMatches('muzi');
      expect(result).toHaveLength(1);
      expect(result[0].homeTeam).toBe('A');
      expect(result[0].status).toBe('upcoming');
    });
  });

  describe('getFinishedMatches', () => {
    it('returns mapped finished matches', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          {
            id: 1, documentId: 'match-1',
            homeTeam: { id: 1, documentId: 'team-1', name: 'A' },
            awayTeam: { id: 2, documentId: 'team-2', name: 'B' },
            homeScore: 1, awayScore: 0, matchDate: '2025-03-15',
            matchTime: '17:00', venue: 'Stadion', round: 1,
            competitionName: 'Liga', competitionCode: null,
            season: null, period: null, organizingBody: null, facrId: null,
            categories: null, createdAt: '2025-01-01', updatedAt: '2025-01-01',
          },
        ],
        total: 1,
      });

      const result = await getFinishedMatches('muzi');
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

  describe('getNavigation', () => {
    it('returns mapped navigation items', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            documentId: 'nav-1',
            title: 'O klubu',
            link: { id: 10, page: { slug: 'o-klubu' }, anchor: null, url: null, file: null },
            sortOrder: 0,
          },
          {
            id: 2,
            documentId: 'nav-2',
            title: 'Kontakt',
            link: { id: 20, page: { slug: 'kontakt' }, anchor: null, url: null, file: null },
            sortOrder: 1,
          },
        ],
        total: 2,
      });

      const result = await getNavigation();
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('O klubu');
      expect(result[0].href).toBe('/o-klubu');
      expect(result[0].external).toBe(false);
    });

    it('filters out items with unresolvable links', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            documentId: 'nav-1',
            title: 'Good',
            link: { id: 10, page: { slug: 'good' }, anchor: null, url: null, file: null },
            sortOrder: 0,
          },
          {
            id: 2,
            documentId: 'nav-2',
            title: 'Broken',
            link: { id: 20, page: null, anchor: null, url: null, file: null },
            sortOrder: 1,
          },
        ],
        total: 2,
      });

      const result = await getNavigation();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Good');
    });

    it('passes correct query options', async () => {
      mockFindMany.mockResolvedValueOnce({ data: [], total: 0 });

      await getNavigation();

      expect(mockFindMany).toHaveBeenCalledWith('navigations', expect.objectContaining({
        sort: 'sortOrder:asc',
        pagination: { pageSize: 100 },
      }));
    });

    it('returns empty array when no data', async () => {
      mockFindMany.mockResolvedValueOnce({ data: [], total: 0 });

      const result = await getNavigation();
      expect(result).toEqual([]);
    });
  });

  describe('getPageBySlug', () => {
    it('returns mapped page when found', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            documentId: 'page-1',
            title: 'O klubu',
            slug: 'o-klubu',
            meta_description: 'Popis',
            content: [
              { id: 10, __component: 'components.text', text: '<p>Hello</p>' },
            ],
            sidebar: [],
          },
        ],
        total: 1,
      });

      const result = await getPageBySlug('o-klubu');
      expect(result).not.toBeNull();
      expect(result!.title).toBe('O klubu');
      expect(result!.slug).toBe('o-klubu');
      expect(result!.metaDescription).toBe('Popis');
      expect(result!.content).toHaveLength(1);
      expect(result!.content[0].__component).toBe('components.text');
    });

    it('returns null when not found', async () => {
      mockFindMany.mockResolvedValueOnce({ data: [], total: 0 });

      const result = await getPageBySlug('nonexistent');
      expect(result).toBeNull();
    });

    it('passes slug filter and populate', async () => {
      mockFindMany.mockResolvedValueOnce({ data: [], total: 0 });

      await getPageBySlug('test');

      expect(mockFindMany).toHaveBeenCalledWith('pages', expect.objectContaining({
        filters: { slug: { $eq: 'test' } },
        pagination: { pageSize: 1 },
      }));
      // Should include populate with content and sidebar
      const callArgs = mockFindMany.mock.calls[0][1];
      expect(callArgs.populate).toHaveProperty('content');
      expect(callArgs.populate).toHaveProperty('sidebar');
    });

    it('maps page with sidebar components', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            documentId: 'page-1',
            title: 'Test',
            slug: 'test',
            meta_description: null,
            content: [{ id: 10, __component: 'components.text', text: 'Main' }],
            sidebar: [{ id: 20, __component: 'components.heading', text: 'Side', type: 'h3', anchor: null }],
          },
        ],
        total: 1,
      });

      const result = await getPageBySlug('test');
      expect(result!.content).toHaveLength(1);
      expect(result!.sidebar).toHaveLength(1);
      expect(result!.sidebar[0].__component).toBe('components.heading');
    });
  });

  describe('getPartners', () => {
    it('returns mapped partners', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          {
            id: 1, documentId: 'partner-1', name: 'Partner A', slug: 'partner-a',
            logo: null, description: 'Desc', sortOrder: 1,
            content: [], panel: null,
            createdAt: '2025-01-01', updatedAt: '2025-01-01',
          },
        ],
        total: 1,
      });

      const result = await getPartners();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Partner A');
      expect(result[0].slug).toBe('partner-a');
    });

    it('passes correct sort and pagination', async () => {
      mockFindMany.mockResolvedValueOnce({ data: [], total: 0 });

      await getPartners();

      expect(mockFindMany).toHaveBeenCalledWith('partners', expect.objectContaining({
        sort: 'sortOrder:asc',
        pagination: { pageSize: 100 },
      }));
    });
  });

  describe('getPartnerBySlug', () => {
    it('returns partner when found', async () => {
      mockFindMany.mockResolvedValueOnce({
        data: [
          {
            id: 1, documentId: 'partner-1', name: 'Partner A', slug: 'partner-a',
            logo: null, description: 'Desc', sortOrder: 1,
            content: [{ id: 10, __component: 'components.text', text: 'Hello' }],
            panel: null,
            createdAt: '2025-01-01', updatedAt: '2025-01-01',
          },
        ],
        total: 1,
      });

      const result = await getPartnerBySlug('partner-a');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Partner A');
      expect(result!.content).toHaveLength(1);
    });

    it('returns null when not found', async () => {
      mockFindMany.mockResolvedValueOnce({ data: [], total: 0 });

      const result = await getPartnerBySlug('nonexistent');
      expect(result).toBeNull();
    });

    it('passes slug filter and populate', async () => {
      mockFindMany.mockResolvedValueOnce({ data: [], total: 0 });

      await getPartnerBySlug('test');

      expect(mockFindMany).toHaveBeenCalledWith('partners', expect.objectContaining({
        filters: { slug: { $eq: 'test' } },
        pagination: { pageSize: 1 },
      }));
      const callArgs = mockFindMany.mock.calls[0][1];
      expect(callArgs.populate).toHaveProperty('logo');
      expect(callArgs.populate).toHaveProperty('content');
      expect(callArgs.populate).toHaveProperty('panel');
    });
  });
});
