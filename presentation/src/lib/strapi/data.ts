import type {
  Category,
  CategoryGroup,
  CategoryHeroData,
  Footer,
  Match,
  NavigationItem,
  NewsArticle,
  NewsArticleSummary,
  NewsArticleType,
  Page,
  Partner,
  PartnerDetail,
  Player,
  PlayerHighlight,
  Standing,
} from '@/lib/types';
import type {
  StrapiRawCategory,
  StrapiRawCategoryGroup,
  StrapiRawCategoryWithHero,
  StrapiRawFooter,
  StrapiRawMatch,
  StrapiRawNavigation,
  StrapiRawNewsArticle,
  StrapiRawNewsArticleType,
  StrapiRawPage,
  StrapiRawPartner,
  StrapiRawPlayer,
  StrapiRawPlayerHighlight,
  StrapiRawStanding,
} from './types';
import { getStrapiClient } from './client';
import { mapCategory } from './mappers/category';
import { mapCategoryGroup } from './mappers/category-group';
import { mapFooter } from './mappers/footer';
import { mapMatch } from './mappers/match';
import { mapNavigation } from './mappers/navigation';
import { mapNewsArticle, mapNewsArticleSummary } from './mappers/news-article';

import { mapPage } from './mappers/page';
import { mapPartner, mapPartnerDetail } from './mappers/partner';
import { mapPlayer } from './mappers/player';
import { mapPlayerHighlight } from './mappers/player-highlight';
import { mapStanding } from './mappers/standing';
import { mapMedia } from './mappers/shared';
import { buildNavigationPopulate, buildFooterPopulate, buildPagePopulate, buildPartnerPopulate } from './populates';

export async function getCategories(): Promise<Category[]> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawCategory>('categories', {
    filters: { $or: [{ hidden: { $eq: false } }, { hidden: { $null: true } }] },
    sort: 'sortOrder:asc',
    pagination: { pageSize: 100 },
  });
  return data.map(mapCategory);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawCategory>('categories', {
    filters: { slug: { $eq: slug } },
    pagination: { pageSize: 1 },
  });
  return data.length > 0 ? mapCategory(data[0]) : null;
}

export async function getCategoryGroups(): Promise<CategoryGroup[]> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawCategoryGroup>('category-groups', {
    filters: { $or: [{ hidden: { $eq: false } }, { hidden: { $null: true } }] },
    sort: 'sortOrder:asc',
    populate: {
      categories: {
        fields: ['documentId', 'name', 'slug', 'sortOrder', 'hidden', 'sortOrderInGroup'],
      },
    },
    pagination: { pageSize: 100 },
  });
  return data
    .map(mapCategoryGroup)
    .filter((g) => g.categories.length > 0);
}

export async function getCategoryGroupByCategorySlug(slug: string): Promise<CategoryGroup | null> {
  const groups = await getCategoryGroups();
  return groups.find((g) => g.categories.some((c) => c.slug === slug)) ?? null;
}

export async function getNewsArticlesByCategory(
  categorySlug?: string,
  page = 1,
  pageSize = 6,
  newsArticleTypeSlugs?: string | string[],
): Promise<{ articles: NewsArticleSummary[]; total: number }> {
  const client = getStrapiClient();
  const filters: Record<string, unknown> = {};
  if (categorySlug) {
    filters.categories = { slug: { $eq: categorySlug } };
  }
  const typesArr = Array.isArray(newsArticleTypeSlugs) ? newsArticleTypeSlugs : newsArticleTypeSlugs ? [newsArticleTypeSlugs] : [];
  if (typesArr.length === 1) {
    filters.newsArticleTypes = { slug: { $eq: typesArr[0] } };
  } else if (typesArr.length > 1) {
    filters.newsArticleTypes = { slug: { $in: typesArr } };
  }
  const { data, total } = await client.findMany<StrapiRawNewsArticle>('news-articles', {
    filters,
    populate: {
      mainPhoto: { fields: ['url', 'alternativeText', 'width', 'height'] },
      categories: { fields: ['name', 'slug'] },
      newsArticleTypes: { fields: ['name', 'slug'] },
    },
    sort: 'date:desc',
    pagination: { page, pageSize },
  });
  return {
    articles: data.map(mapNewsArticleSummary),
    total,
  };
}

export async function getAllNewsArticles(
  page = 1,
  pageSize = 12,
  newsArticleTypeSlugs?: string | string[],
  categorySlugs?: string | string[],
): Promise<{ articles: NewsArticleSummary[]; total: number }> {
  const client = getStrapiClient();
  const filters: Record<string, unknown> = {};
  const typesArr = Array.isArray(newsArticleTypeSlugs) ? newsArticleTypeSlugs : newsArticleTypeSlugs ? [newsArticleTypeSlugs] : [];
  const catsArr = Array.isArray(categorySlugs) ? categorySlugs : categorySlugs ? [categorySlugs] : [];
  if (typesArr.length === 1) {
    filters.newsArticleTypes = { slug: { $eq: typesArr[0] } };
  } else if (typesArr.length > 1) {
    filters.newsArticleTypes = { slug: { $in: typesArr } };
  }
  if (catsArr.length === 1) {
    filters.categories = { slug: { $eq: catsArr[0] } };
  } else if (catsArr.length > 1) {
    filters.categories = { slug: { $in: catsArr } };
  }
  const { data, total } = await client.findMany<StrapiRawNewsArticle>('news-articles', {
    filters,
    populate: {
      mainPhoto: { fields: ['url', 'alternativeText', 'width', 'height'] },
      categories: { fields: ['name', 'slug'] },
      newsArticleTypes: { fields: ['name', 'slug'] },
    },
    sort: 'date:desc',
    pagination: { page, pageSize },
  });
  return {
    articles: data.map(mapNewsArticleSummary),
    total,
  };
}

export async function getNewsArticleTypes(): Promise<NewsArticleType[]> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawNewsArticleType>('news-article-types', {
    sort: 'name:asc',
    pagination: { pageSize: 100 },
  });
  return data.map((t) => ({ documentId: t.documentId, name: t.name, slug: t.slug }));
}

export async function getNewsArticleBySlug(slug: string): Promise<NewsArticle | null> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawNewsArticle>('news-articles', {
    filters: { slug: { $eq: slug } },
    populate: {
      mainPhoto: { fields: ['url', 'alternativeText', 'width', 'height'] },
      gallery: { fields: ['url', 'alternativeText', 'width', 'height'] },
      files: { fields: ['url', 'name'] },
      categories: { fields: ['name', 'slug'] },
      newsArticleTypes: { fields: ['name', 'slug'] },
      relatedNews: {
        populate: {
          mainPhoto: { fields: ['url', 'alternativeText', 'width', 'height'] },
          categories: { fields: ['name', 'slug'] },
          newsArticleTypes: { fields: ['name', 'slug'] },
        },
      },
    },
    pagination: { pageSize: 1 },
  });
  return data.length > 0 ? mapNewsArticle(data[0]) : null;
}

export async function getSidebarArticles(
  article: NewsArticle,
  categorySlug?: string,
): Promise<NewsArticleSummary[]> {
  const isNew = (a: NewsArticleSummary, existing: NewsArticleSummary[]) =>
    a.slug !== article.slug && !existing.some((s) => s.slug === a.slug);

  // 1. Try related news
  let sidebar = article.relatedNews.slice(0, 2);
  if (sidebar.length >= 2) return sidebar;

  // 2. Try same category
  if (categorySlug) {
    const { articles } = await getNewsArticlesByCategory(categorySlug, 1, 4);
    sidebar = [...sidebar, ...articles.filter((a) => isNew(a, sidebar))].slice(0, 2);
    if (sidebar.length >= 2) return sidebar;
  }

  // 3. Fallback to any recent articles
  const { articles } = await getAllNewsArticles(1, 4);
  return [...sidebar, ...articles.filter((a) => isNew(a, sidebar))].slice(0, 2);
}

export async function getUpcomingMatches(categorySlug: string, limit = 3): Promise<Match[]> {
  const today = new Date().toISOString().split('T')[0];
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawMatch>('matches', {
    filters: {
      categories: { slug: { $eq: categorySlug } },
      matchDate: { $gte: today },
      homeScore: { $null: true },
    },
    populate: {
      tournament: { fields: ['name'] },
      homeTeam: { fields: ['name'], populate: { logo: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
      awayTeam: { fields: ['name'], populate: { logo: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
    },
    sort: 'matchDate:asc',
    pagination: { pageSize: limit },
  });
  return data.map(mapMatch);
}

export async function getFinishedMatches(categorySlug: string, limit = 3): Promise<Match[]> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawMatch>('matches', {
    filters: {
      categories: { slug: { $eq: categorySlug } },
      homeScore: { $notNull: true },
    },
    populate: {
      tournament: { fields: ['name'] },
      homeTeam: { fields: ['name'], populate: { logo: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
      awayTeam: { fields: ['name'], populate: { logo: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
    },
    sort: 'matchDate:desc',
    pagination: { pageSize: limit },
  });
  return data.map(mapMatch);
}

export async function getAllMatchesByCategory(categorySlug: string): Promise<Match[]> {
  const client = getStrapiClient();
  const data = await client.findAll<StrapiRawMatch>('matches', {
    filters: {
      categories: { slug: { $eq: categorySlug } },
    },
    populate: {
      tournament: { fields: ['name'] },
      homeTeam: { fields: ['name'], populate: { logo: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
      awayTeam: { fields: ['name'], populate: { logo: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
    },
    sort: 'matchDate:desc',
  });
  return data.map(mapMatch);
}

export async function getPlayersByCategory(categorySlug: string): Promise<Player[]> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawPlayer>('players', {
    filters: {
      categories: { slug: { $eq: categorySlug } },
    },
    populate: {
      photo: { fields: ['url', 'alternativeText', 'width', 'height'] },
      categories: { fields: ['name', 'slug'] },
    },
    sort: 'sortOrder:asc',
    pagination: { pageSize: 100 },
  });
  const players = data.map(mapPlayer);
  const slugCounts = new Map<string, number>();
  for (const player of players) {
    const baseSlug = player.slug;
    const count = (slugCounts.get(baseSlug) ?? 0) + 1;
    slugCounts.set(baseSlug, count);
    if (count > 1) {
      player.slug = `${baseSlug}-${count}`;
    }
  }
  return players;
}

export async function getPlayerByCategoryAndSlug(categorySlug: string, playerSlug: string): Promise<Player | null> {
  const players = await getPlayersByCategory(categorySlug);
  return players.find((p) => p.slug === playerSlug) ?? null;
}

export async function getNavigation(): Promise<NavigationItem[]> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawNavigation>('navigations', {
    sort: 'sortOrder:asc',
    populate: buildNavigationPopulate(),
    pagination: { pageSize: 100 },
  });
  return data.map(mapNavigation).filter((item): item is NavigationItem => item !== null);
}

export async function getFooter(): Promise<Footer | null> {
  const client = getStrapiClient();
  const raw = await client.findSingle<StrapiRawFooter>('footer', {
    populate: buildFooterPopulate(),
  });
  return raw ? mapFooter(raw) : null;
}

export async function getPageBySlug(slug: string): Promise<Page | null> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawPage>('pages', {
    filters: { slug: { $eq: slug } },
    populate: buildPagePopulate(),
    pagination: { pageSize: 1 },
  });
  return data.length > 0 ? mapPage(data[0]) : null;
}

export async function getStandingsByCategory(categorySlug: string): Promise<Standing[]> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawStanding>('standings', {
    filters: {
      categories: { slug: { $eq: categorySlug } },
    },
    populate: {
      tournament: { fields: ['name'] },
      team: { fields: ['name'], populate: { logo: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
    },
    sort: 'position:asc',
    pagination: { pageSize: 100 },
  });
  return data.map(mapStanding);
}

export async function getCategoryWithHeroBySlug(
  slug: string,
): Promise<{ category: Category; hero: CategoryHeroData } | null> {
  const client = getStrapiClient();
  const mediaFields = { fields: ['url', 'alternativeText', 'width', 'height'] };
  const { data } = await client.findMany<StrapiRawCategoryWithHero>('categories', {
    filters: { slug: { $eq: slug } },
    populate: {
      heroSlide1Image: mediaFields,
      heroSlide2Image: mediaFields,
      heroSlide3Image: mediaFields,
      heroSlide3NewsArticle: {
        populate: {
          mainPhoto: mediaFields,
        },
      },
    },
    pagination: { pageSize: 1 },
  });
  if (data.length === 0) return null;
  const raw = data[0];
  return {
    category: mapCategory(raw),
    hero: {
      heroSlide1Image: mapMedia(raw.heroSlide1Image),
      heroSlide2Image: mapMedia(raw.heroSlide2Image),
      heroSlide3Image: mapMedia(raw.heroSlide3Image),
      heroSlide3NewsArticle: raw.heroSlide3NewsArticle
        ? {
            title: raw.heroSlide3NewsArticle.title,
            slug: raw.heroSlide3NewsArticle.slug || raw.heroSlide3NewsArticle.documentId,
            description: raw.heroSlide3NewsArticle.description,
            mainPhoto: mapMedia(raw.heroSlide3NewsArticle.mainPhoto),
          }
        : null,
      heroSlide3Title: raw.heroSlide3Title ?? null,
      heroSlide3Text: raw.heroSlide3Text ?? null,
      heroSlide3Link: raw.heroSlide3Link ?? null,
    },
  };
}

export async function getUpcomingMatch(categorySlug: string): Promise<Match | null> {
  const today = new Date().toISOString().split('T')[0];
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawMatch>('matches', {
    filters: {
      categories: { slug: { $eq: categorySlug } },
      matchDate: { $gte: today },
      homeScore: { $null: true },
    },
    populate: {
      tournament: { fields: ['name'] },
      homeTeam: { fields: ['name'], populate: { logo: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
      awayTeam: { fields: ['name'], populate: { logo: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
    },
    sort: 'matchDate:asc',
    pagination: { pageSize: 1 },
  });
  return data.length > 0 ? mapMatch(data[0]) : null;
}

export async function getLastResult(categorySlug: string): Promise<Match | null> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawMatch>('matches', {
    filters: {
      categories: { slug: { $eq: categorySlug } },
      homeScore: { $notNull: true },
    },
    populate: {
      tournament: { fields: ['name'] },
      homeTeam: { fields: ['name'], populate: { logo: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
      awayTeam: { fields: ['name'], populate: { logo: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
    },
    sort: 'matchDate:desc',
    pagination: { pageSize: 1 },
  });
  return data.length > 0 ? mapMatch(data[0]) : null;
}

export async function getPartners(): Promise<Partner[]> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawPartner>('partners', {
    populate: {
      logo: { fields: ['url', 'alternativeText', 'width', 'height'] },
    },
    sort: 'sortOrder:asc',
    pagination: { pageSize: 100 },
  });
  return data.map(mapPartner);
}

export async function getPartnerBySlug(slug: string): Promise<PartnerDetail | null> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawPartner>('partners', {
    filters: { slug: { $eq: slug } },
    populate: buildPartnerPopulate(),
    pagination: { pageSize: 1 },
  });
  return data.length > 0 ? mapPartnerDetail(data[0]) : null;
}

export async function getPlayerHighlightsByCategory(categorySlug: string): Promise<PlayerHighlight[]> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawPlayerHighlight>('player-highlights', {
    filters: {
      categories: { slug: { $eq: categorySlug } },
    },
    populate: {
      player: {
        fields: ['name'],
        populate: { photo: { fields: ['url', 'alternativeText', 'width', 'height'] } },
      },
      highlightStat: true,
      stats: true,
    },
    sort: 'sortOrder:asc',
    pagination: { pageSize: 100 },
  });
  return data.map(mapPlayerHighlight);
}
