import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';

// U12: the `[slug]` catch-all and the /kategorie/[category] routes 404 unknown slugs before any
// per-slug data call. The data layer is mocked; the guards and pages are the real modules.

const data = vi.hoisted(() => ({
  getPageSlugIndex: vi.fn(async (): Promise<string[] | null> => ['o-klubu', 'kontakty']),
  getCategorySlugIndex: vi.fn(async (): Promise<string[] | null> => ['muzi-a', 'skryta']),
  getPageBySlug: vi.fn(async (slug: string) => ({
    title: slug, slug, metaDescription: null, breadcrumbs: [], content: [], sidebar: [],
  })),
  getCategoryBySlug: vi.fn(async (slug: string) => ({ documentId: 'c', name: slug, slug, sortOrder: 0 })),
  getNewsArticlesByCategory: vi.fn(async () => ({ articles: [], total: 0 })),
  getPlayersByCategory: vi.fn(async () => []),
  getUpcomingMatches: vi.fn(async () => []),
  getFinishedMatches: vi.fn(async () => []),
  getStandingsByCategory: vi.fn(async () => []),
  getCategoryWithHeroBySlug: vi.fn(async () => null),
  getUpcomingMatch: vi.fn(async () => null),
  getLastResult: vi.fn(async () => null),
  getAllMatchesByCategory: vi.fn(async () => []),
  getCategoryGroupByCategorySlug: vi.fn(async () => null),
  getPlayerHighlightsByCategory: vi.fn(async () => []),
  getPlayerByCategoryAndSlug: vi.fn(async () => null),
  getNewsArticleBySlug: vi.fn(async () => null),
  getSidebarArticles: vi.fn(async () => []),
  getPartnerBySlug: vi.fn(async () => null),
}));
vi.mock('@/lib/strapi/data', () => data);

const NOT_FOUND = 'NEXT_HTTP_ERROR_FALLBACK;404';
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
  redirect: vi.fn(),
}));

// Presentational components are irrelevant here (the pages are called, not rendered).
vi.mock('@/components/layout', () => ({ SidePanel: () => null }));
vi.mock('@/components/ui', () => ({ Breadcrumb: () => null }));
vi.mock('@/components/strapi/DynamicZone', () => ({ DynamicZone: () => null }));
vi.mock('@/components/sections', () => ({
  Hero: () => null, Matches: () => null, Statistics: () => null, CategorySwitcher: () => null,
  NewsList: () => null, TeamSection: () => null, ArticleDetail: () => null, PlayerDetail: () => null,
}));

const CmsPage = (await import('@/app/[slug]/page')).default;
const { generateMetadata: cmsMetadata } = await import('@/app/[slug]/page');
const CategoryLayout = (await import('@/app/kategorie/[category]/layout')).default;
const CategoryPage = (await import('@/app/kategorie/[category]/page')).default;
const ArticlePage = (await import('@/app/kategorie/[category]/clanek/[slug]/page')).default;
const PlayerPage = (await import('@/app/kategorie/[category]/hrac/[slug]/page')).default;
const NewsArticlePage = (await import('@/app/novinky/clanek/[slug]/page')).default;
const PartnerPage = (await import('@/app/partner/[slug]/page')).default;
const robots = (await import('@/app/robots')).default;

const params = <T,>(value: T) => ({ params: Promise.resolve(value) });
const dataCalls = () => Object.values(data).reduce((n, fn) => n + fn.mock.calls.length, 0);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/[slug] catch-all', () => {
  it.each(['.env', 'config.json', 'wp-login.php', 'robots.txt', 'xmlrpc.php'])(
    '%s → 404 after one cached index lookup, no page query',
    async (slug) => {
      await expect(CmsPage(params({ slug }))).rejects.toThrow(NOT_FOUND);
      expect(data.getPageSlugIndex).toHaveBeenCalledTimes(1);
      expect(data.getPageBySlug).not.toHaveBeenCalled();
    },
  );

  it.each(['..%2f..%2fetc%2fpasswd', '../etc', 'a'.repeat(121), 'muži', ''])(
    '%s → 404 with zero data calls (pre-filter)',
    async (slug) => {
      await expect(CmsPage(params({ slug }))).rejects.toThrow(NOT_FOUND);
      expect(dataCalls()).toBe(0);
    },
  );

  it('a known slug → one index lookup + one page load', async () => {
    await CmsPage(params({ slug: 'o-klubu' }));

    expect(data.getPageSlugIndex).toHaveBeenCalledTimes(1);
    expect(data.getPageBySlug).toHaveBeenCalledTimes(1);
    expect(data.getPageBySlug).toHaveBeenCalledWith('o-klubu');
  });

  it('index unavailable (Strapi failing) → falls through to the page lookup instead of 404ing', async () => {
    data.getPageSlugIndex.mockResolvedValueOnce(null);

    await CmsPage(params({ slug: 'kontakty' }));
    expect(data.getPageBySlug).toHaveBeenCalledWith('kontakty');
  });

  it('generateMetadata of an unknown slug makes no page query', async () => {
    const metadata = await cmsMetadata(params({ slug: '.env' }));

    expect(metadata.robots).toMatchObject({ index: false });
    expect(data.getPageBySlug).not.toHaveBeenCalled();
  });
});

describe('/kategorie/[category]', () => {
  it('an unknown category 404s in the layout and in the page, without its 11 data calls', async () => {
    await expect(CategoryLayout({ children: null, ...params({ category: 'nonexistent' }) })).rejects.toThrow(NOT_FOUND);
    await expect(CategoryPage(params({ category: 'nonexistent' }))).rejects.toThrow(NOT_FOUND);

    expect(data.getCategorySlugIndex).toHaveBeenCalled();
    expect(dataCalls()).toBe(data.getCategorySlugIndex.mock.calls.length);
  });

  it('an implausible category makes no data call at all', async () => {
    await expect(CategoryPage(params({ category: '%2e%2e' }))).rejects.toThrow(NOT_FOUND);
    expect(dataCalls()).toBe(0);
  });

  it('a hidden category (in the index, not in the visible list) still renders', async () => {
    await CategoryLayout({ children: null, ...params({ category: 'skryta' }) });
    expect(data.getCategoryBySlug).toHaveBeenCalledWith('skryta');
  });

  it('a known category renders its sections', async () => {
    await CategoryPage(params({ category: 'muzi-a' }));
    expect(data.getPlayersByCategory).toHaveBeenCalledWith('muzi-a');
  });

  it('article and player routes 404 an unknown category or an implausible slug without data calls', async () => {
    await expect(ArticlePage(params({ category: 'nope', slug: 'clanek-1' }))).rejects.toThrow(NOT_FOUND);
    await expect(PlayerPage(params({ category: 'nope', slug: 'jan-novak' }))).rejects.toThrow(NOT_FOUND);
    await expect(ArticlePage(params({ category: 'muzi-a', slug: '../x' }))).rejects.toThrow(NOT_FOUND);
    await expect(PlayerPage(params({ category: 'muzi-a', slug: 'a'.repeat(121) }))).rejects.toThrow(NOT_FOUND);

    expect(data.getNewsArticleBySlug).not.toHaveBeenCalled();
    expect(data.getPlayerByCategoryAndSlug).not.toHaveBeenCalled();
    expect(data.getCategoryBySlug).not.toHaveBeenCalled();
  });
});

describe('other slug routes (pre-filter)', () => {
  it('/novinky/clanek and /partner 404 an implausible slug without a data call', async () => {
    await expect(NewsArticlePage(params({ slug: '..%2fetc' }))).rejects.toThrow(NOT_FOUND);
    await expect(PartnerPage(params({ slug: 'a b' }))).rejects.toThrow(NOT_FOUND);
    expect(dataCalls()).toBe(0);
  });
});

describe('scanner favourites have real routes (not the [slug] catch-all)', () => {
  it('/robots.txt allows everything', () => {
    expect(robots()).toEqual({ rules: { userAgent: '*', allow: '/' } });
  });

  it.each(['apple-touch-icon.png', 'apple-touch-icon-precomposed.png'])('/%s is a static file', (file) => {
    expect(existsSync(path.join(__dirname, '../../../public', file))).toBe(true);
  });
});
