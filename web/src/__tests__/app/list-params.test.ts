import { describe, it, expect, vi, beforeEach } from 'vitest';

// U13: list pages pass only known filter values and a bounded page number to the data layer.

const data = vi.hoisted(() => ({
  getNewsArticleTypes: vi.fn(async () => [
    { documentId: 't1', name: 'Reporty', slug: 'reporty' },
    { documentId: 't2', name: 'Rozhovory', slug: 'rozhovory' },
  ]),
  getCategories: vi.fn(async () => [
    { documentId: 'c1', name: 'Muži A', slug: 'muzi-a', sortOrder: 1 },
    { documentId: 'c2', name: 'Dorost', slug: 'dorost', sortOrder: 2 },
  ]),
  getCategorySlugIndex: vi.fn(async () => ['muzi-a', 'dorost']),
  getCategoryBySlug: vi.fn(async (slug: string) => ({ documentId: 'c', name: slug, slug, sortOrder: 0 })),
  getAllNewsArticles: vi.fn(async () => ({ articles: [], total: 0 })),
  getNewsArticlesByCategory: vi.fn(async () => ({ articles: [], total: 0 })),
  getAvailableSeasons: vi.fn(async () => [2026, 2025]),
  getClubMatches: vi.fn(async () => ({ matches: [], total: 0, pageCount: 1 })),
}));
vi.mock('@/lib/strapi/data', () => data);
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_HTTP_ERROR_FALLBACK;404'); } }));
vi.mock('@/components/ui', () => ({ Breadcrumb: () => null, NewsCard: () => null }));
vi.mock('@/components/ui/NewsArticleTypeFilter', () => ({ default: () => null }));
vi.mock('@/components/ui/Pagination', () => ({ default: () => null }));
vi.mock('@/components/sections/KdyHrajemeContent', () => ({ default: () => null }));

const NovinkyPage = (await import('@/app/novinky/page')).default;
const CategoryNovinkyPage = (await import('@/app/kategorie/[category]/novinky/page')).default;
const KdyHrajemePage = (await import('@/app/kdy-hrajeme/page')).default;

const search = <T,>(value: T) => Promise.resolve(value);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/novinky', () => {
  it('drops unknown typ/kategorie values, sorts and dedupes the rest', async () => {
    await NovinkyPage({ searchParams: search({ typ: 'rozhovory,xss<>,reporty,rozhovory', kategorie: 'dorost,fake,muzi-a' }) });

    expect(data.getAllNewsArticles).toHaveBeenCalledWith(1, 12, ['reporty', 'rozhovory'], ['dorost', 'muzi-a']);
  });

  it('only unknown values → no filter at all (one shared cache key)', async () => {
    await NovinkyPage({ searchParams: search({ typ: 'a'.repeat(500), kategorie: 'x,y,z' }) });

    expect(data.getAllNewsArticles).toHaveBeenCalledWith(1, 12, undefined, undefined);
  });

  it('stranka=99999 is clamped to 200', async () => {
    await NovinkyPage({ searchParams: search({ stranka: '99999' }) });

    expect(data.getAllNewsArticles).toHaveBeenCalledWith(200, 12, undefined, undefined);
  });
});

describe('/kategorie/[category]/novinky', () => {
  it('drops unknown typ values and clamps stranka', async () => {
    await CategoryNovinkyPage({
      params: Promise.resolve({ category: 'muzi-a' }),
      searchParams: search({ typ: 'reporty,unknown', stranka: '5000' }),
    });

    expect(data.getNewsArticlesByCategory).toHaveBeenCalledWith('muzi-a', 200, 12, ['reporty']);
  });
});

describe('/kdy-hrajeme', () => {
  it('strana=-5 → page 1', async () => {
    await KdyHrajemePage({ searchParams: search({ strana: '-5', rocnik: '2026' }) });

    expect(data.getClubMatches).toHaveBeenCalledWith(expect.objectContaining({ page: 1, season: 2026 }));
  });

  it('strana=1e6 → bounded', async () => {
    await KdyHrajemePage({ searchParams: search({ strana: '1000000', rocnik: '2026' }) });

    expect(data.getClubMatches).toHaveBeenCalledWith(expect.objectContaining({ page: 200 }));
  });

  it('an unknown kategorie is ignored (already validated against the category list)', async () => {
    await KdyHrajemePage({ searchParams: search({ kategorie: 'nope', rocnik: '2026' }) });

    expect(data.getClubMatches).toHaveBeenCalledWith(expect.objectContaining({ categorySlug: undefined }));
  });
});
