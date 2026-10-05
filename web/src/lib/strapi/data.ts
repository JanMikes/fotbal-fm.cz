import type {
  Category,
  CategoryGroup,
  CategoryHeroData,
  DeepLink,
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
  StrapiQueryOptions,
  StrapiRawCategory,
  StrapiRawCategoryGroup,
  StrapiRawCategoryWithHero,
  StrapiRawDeepLink,
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
import { mapDeepLink } from './mappers/deep-link';
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
import { cache } from 'react';
import { cached, TAGS, type Tag } from '@fotbal-fm/cache';
import { strapiUrl } from '@fotbal-fm/strapi-client';
import { currentSeasonStartYear, seasonDateRange } from '@/lib/season';
import { deepLinkCodeCandidates } from '@/lib/app-links';

/*
 * Every Strapi read the site makes, as a named query: the content type, the request options and
 * the cache TAGS of every content type the request filters on or populates (`all` is implied).
 * Strapi bumps a tag after any write of a type with that tag (lily D75 Phase 1); a missing tag
 * means a stale page until the 5-min soft TTL — test U1 walks these queries against the Strapi
 * schemas and fails on any reachable type whose tag is missing.
 *
 * The cache stores the raw Strapi response per request URL; the functions below map on read.
 */

/** Media fields the site renders; `updatedAt` versions the URL (`?v=`) so a replaced file gets a new one. */
const MEDIA = { fields: ['url', 'alternativeText', 'width', 'height', 'updatedAt'] };

/** Substring identifying our club's teams (FK Frýdek-Místek, Frýdek-Místek B, …). */
const CLUB_NAME_FRAGMENT = 'Frýdek';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

const MATCH_POPULATE = {
  tournament: { fields: ['name'] },
  homeTeam: { fields: ['name'], populate: { logo: MEDIA } },
  awayTeam: { fields: ['name'], populate: { logo: MEDIA } },
};
const MATCH_TAGS = [TAGS.match, TAGS.category, TAGS.tournament, TAGS.team, TAGS.media];

const NEWS_SUMMARY_POPULATE = {
  mainPhoto: MEDIA,
  categories: { fields: ['name', 'slug'] },
  newsArticleTypes: { fields: ['name', 'slug'] },
};
const NEWS_TAGS = [TAGS.newsArticle, TAGS.category, TAGS.newsArticleType, TAGS.media];

const VISIBLE = { $or: [{ hidden: { $eq: false } }, { hidden: { $null: true } }] };

export interface Query {
  contentType: string;
  /** findMany: one page; findAll: every page (no pagination option); findSingle: a single type. */
  kind: 'many' | 'all' | 'single';
  tags: readonly Tag[];
  options: StrapiQueryOptions;
}

function asList(slugs: string | string[] | undefined): string[] {
  const list = Array.isArray(slugs) ? slugs : slugs ? [slugs] : [];
  return [...list].sort(); // one URL (one cache entry) per set of values
}

export interface ClubMatchesFilter {
  categorySlug?: string;
  season: number;
  homeAway?: 'home' | 'away';
  page?: number;
  pageSize?: number;
}

export interface ClubMatchesResult {
  matches: Match[];
  total: number;
  pageCount: number;
}

export const QUERIES = {
  getCategories: (): Query => ({
    contentType: 'categories',
    kind: 'many',
    tags: [TAGS.category],
    options: { filters: VISIBLE, sort: 'sortOrder:asc', pagination: { pageSize: 100 } },
  }),

  getCategoryBySlug: (slug: string): Query => ({
    contentType: 'categories',
    kind: 'many',
    tags: [TAGS.category],
    options: { filters: { slug: { $eq: slug } }, pagination: { pageSize: 1 } },
  }),

  getCategorySlugIndex: (): Query => ({
    contentType: 'categories',
    kind: 'all',
    tags: [TAGS.category],
    options: { fields: ['slug'] },
  }),

  getCategoryGroups: (): Query => ({
    contentType: 'category-groups',
    kind: 'many',
    tags: [TAGS.categoryGroup, TAGS.category],
    options: {
      filters: VISIBLE,
      sort: 'sortOrder:asc',
      populate: {
        categories: { fields: ['documentId', 'name', 'slug', 'sortOrder', 'hidden', 'sortOrderInGroup'] },
      },
      pagination: { pageSize: 100 },
    },
  }),

  getNewsArticlesByCategory: (categorySlug: string | undefined, page: number, pageSize: number, typeSlugs: string[]): Query => {
    const filters: Record<string, unknown> = { date: { $notNull: true } };
    if (categorySlug) {
      filters.$or = [
        { categories: { slug: { $eq: categorySlug } } },
        { categories: { id: { $null: true } } },
      ];
    }
    if (typeSlugs.length === 1) filters.newsArticleTypes = { slug: { $eq: typeSlugs[0] } };
    else if (typeSlugs.length > 1) filters.newsArticleTypes = { slug: { $in: typeSlugs } };
    return {
      contentType: 'news-articles',
      kind: 'many',
      tags: NEWS_TAGS,
      options: { filters, populate: NEWS_SUMMARY_POPULATE, sort: 'date:desc', pagination: { page, pageSize } },
    };
  },

  getAllNewsArticles: (page: number, pageSize: number, typeSlugs: string[], categorySlugs: string[]): Query => {
    const filters: Record<string, unknown> = { date: { $notNull: true } };
    const typeFilter = typeSlugs.length === 1
      ? { newsArticleTypes: { slug: { $eq: typeSlugs[0] } } }
      : typeSlugs.length > 1 ? { newsArticleTypes: { slug: { $in: typeSlugs } } } : null;
    const catFilter = categorySlugs.length === 1
      ? { categories: { slug: { $eq: categorySlugs[0] } } }
      : categorySlugs.length > 1 ? { categories: { slug: { $in: categorySlugs } } } : null;
    if (typeFilter && catFilter) filters.$and = [typeFilter, catFilter];
    else if (typeFilter) Object.assign(filters, typeFilter);
    else if (catFilter) Object.assign(filters, catFilter);
    return {
      contentType: 'news-articles',
      kind: 'many',
      tags: NEWS_TAGS,
      options: { filters, populate: NEWS_SUMMARY_POPULATE, sort: 'date:desc', pagination: { page, pageSize } },
    };
  },

  getNewsArticleTypes: (): Query => ({
    contentType: 'news-article-types',
    kind: 'many',
    tags: [TAGS.newsArticleType],
    options: { sort: 'name:asc', pagination: { pageSize: 100 } },
  }),

  getNewsArticleBySlug: (slug: string): Query => ({
    contentType: 'news-articles',
    kind: 'many',
    tags: NEWS_TAGS,
    options: {
      filters: { slug: { $eq: slug } },
      populate: {
        mainPhoto: MEDIA,
        gallery: MEDIA,
        files: { fields: ['url', 'name', 'updatedAt'] },
        categories: { fields: ['name', 'slug'] },
        newsArticleTypes: { fields: ['name', 'slug'] },
        relatedNews: { populate: NEWS_SUMMARY_POPULATE },
      },
      pagination: { pageSize: 1 },
    },
  }),

  getUpcomingMatches: (categorySlug: string, limit: number, day: string): Query => ({
    contentType: 'matches',
    kind: 'many',
    tags: MATCH_TAGS,
    options: {
      filters: { categories: { slug: { $eq: categorySlug } }, matchDate: { $gte: day }, homeScore: { $null: true } },
      populate: MATCH_POPULATE,
      sort: 'matchDate:asc',
      pagination: { pageSize: limit },
    },
  }),

  getFinishedMatches: (categorySlug: string, limit: number): Query => ({
    contentType: 'matches',
    kind: 'many',
    tags: MATCH_TAGS,
    options: {
      filters: { categories: { slug: { $eq: categorySlug } }, homeScore: { $notNull: true } },
      populate: MATCH_POPULATE,
      sort: 'matchDate:desc',
      pagination: { pageSize: limit },
    },
  }),

  getAllMatchesByCategory: (categorySlug: string): Query => ({
    contentType: 'matches',
    kind: 'all',
    tags: MATCH_TAGS,
    options: { filters: { categories: { slug: { $eq: categorySlug } } }, populate: MATCH_POPULATE, sort: 'matchDate:desc' },
  }),

  getClubMatches: ({ categorySlug, season, homeAway, page = 1, pageSize = 20 }: ClubMatchesFilter): Query => {
    const [seasonFrom, seasonTo] = seasonDateRange(season);
    const filters: Record<string, unknown> = {
      $or: [
        { season: { $eq: season } },
        { season: { $null: true }, matchDate: { $gte: seasonFrom, $lte: seasonTo } },
      ],
    };
    if (categorySlug) filters.categories = { slug: { $eq: categorySlug } };
    if (homeAway === 'home') filters.homeTeam = { name: { $containsi: CLUB_NAME_FRAGMENT } };
    else if (homeAway === 'away') filters.awayTeam = { name: { $containsi: CLUB_NAME_FRAGMENT } };
    return {
      contentType: 'matches',
      kind: 'many',
      tags: MATCH_TAGS,
      options: {
        filters,
        populate: { ...MATCH_POPULATE, categories: { fields: ['name'] } },
        sort: 'matchDate:asc',
        pagination: { page, pageSize },
      },
    };
  },

  getAvailableSeasons: (): Query => ({
    contentType: 'tournaments',
    kind: 'many',
    tags: [TAGS.tournament],
    options: { fields: ['season'], filters: { season: { $notNull: true } }, pagination: { pageSize: 100 } },
  }),

  getPlayersByCategory: (categorySlug: string): Query => ({
    contentType: 'players',
    kind: 'many',
    tags: [TAGS.player, TAGS.category, TAGS.media],
    options: {
      filters: { categories: { slug: { $eq: categorySlug } } },
      populate: { photo: MEDIA, categories: { fields: ['name', 'slug'] } },
      sort: 'sortOrder:asc',
      pagination: { pageSize: 100 },
    },
  }),

  getNavigation: (): Query => ({
    contentType: 'navigations',
    kind: 'many',
    tags: [TAGS.navigation, TAGS.page, TAGS.media],
    options: { sort: 'sortOrder:asc', populate: buildNavigationPopulate(), pagination: { pageSize: 100 } },
  }),

  getFooter: (): Query => ({
    contentType: 'footer',
    kind: 'single',
    // Its partner sections are footer components with their own logos, not partner relations (U1).
    tags: [TAGS.footer, TAGS.page, TAGS.media],
    options: { populate: buildFooterPopulate() },
  }),

  getNavigationPages: (): Query => ({
    contentType: 'pages',
    kind: 'many',
    tags: [TAGS.page],
    options: { filters: { show_in_categories_nav: { $eq: true } }, fields: ['title', 'slug'], pagination: { pageSize: 100 } },
  }),

  getPageBySlug: (slug: string): Query => ({
    contentType: 'pages',
    kind: 'many',
    tags: [TAGS.page, TAGS.media, TAGS.category, TAGS.newsArticleType, TAGS.form],
    options: { filters: { slug: { $eq: slug } }, populate: buildPagePopulate(), pagination: { pageSize: 1 } },
  }),

  getPageSlugIndex: (): Query => ({
    contentType: 'pages',
    kind: 'all',
    tags: [TAGS.page],
    options: { fields: ['slug'] },
  }),

  getStandingsByCategory: (categorySlug: string): Query => ({
    contentType: 'standings',
    kind: 'many',
    tags: [TAGS.standing, TAGS.category, TAGS.tournament, TAGS.team, TAGS.media],
    options: {
      filters: { categories: { slug: { $eq: categorySlug } } },
      populate: { tournament: { fields: ['name'] }, team: { fields: ['name'], populate: { logo: MEDIA } } },
      sort: 'position:asc',
      pagination: { pageSize: 100 },
    },
  }),

  getCategoryWithHeroBySlug: (slug: string): Query => ({
    contentType: 'categories',
    kind: 'many',
    tags: [TAGS.category, TAGS.media, TAGS.newsArticle],
    options: {
      filters: { slug: { $eq: slug } },
      populate: {
        staticHeroSlideImage: MEDIA,
        heroSlide1Image: MEDIA,
        heroSlide2Image: MEDIA,
        heroSlide3Image: MEDIA,
        heroSlide3NewsArticle: { populate: { mainPhoto: MEDIA } },
      },
      pagination: { pageSize: 1 },
    },
  }),

  getUpcomingMatch: (categorySlug: string, day: string): Query => ({
    contentType: 'matches',
    kind: 'many',
    tags: MATCH_TAGS,
    options: {
      filters: { categories: { slug: { $eq: categorySlug } }, matchDate: { $gte: day }, homeScore: { $null: true } },
      populate: MATCH_POPULATE,
      sort: 'matchDate:asc',
      pagination: { pageSize: 1 },
    },
  }),

  getLastResult: (categorySlug: string): Query => ({
    contentType: 'matches',
    kind: 'many',
    tags: MATCH_TAGS,
    options: {
      filters: { categories: { slug: { $eq: categorySlug } }, homeScore: { $notNull: true } },
      populate: MATCH_POPULATE,
      sort: 'matchDate:desc',
      pagination: { pageSize: 1 },
    },
  }),

  getPartners: (): Query => ({
    contentType: 'partners',
    kind: 'many',
    tags: [TAGS.partner, TAGS.partnerCategory, TAGS.media],
    options: {
      filters: { show_on_web: { $eq: true } },
      populate: { logo: MEDIA, partnerCategory: { fields: ['name'] } },
      sort: 'sortOrder:asc',
      pagination: { pageSize: 100 },
    },
  }),

  getPartnerBySlug: (slug: string): Query => ({
    contentType: 'partners',
    kind: 'many',
    tags: [TAGS.partner, TAGS.partnerCategory, TAGS.media, TAGS.page, TAGS.category, TAGS.newsArticleType, TAGS.form],
    options: { filters: { slug: { $eq: slug } }, populate: buildPartnerPopulate(), pagination: { pageSize: 1 } },
  }),

  getPlayerHighlightsByCategory: (categorySlug: string): Query => ({
    contentType: 'player-highlights',
    kind: 'many',
    tags: [TAGS.playerHighlight, TAGS.player, TAGS.category, TAGS.media],
    options: {
      filters: { categories: { slug: { $eq: categorySlug } } },
      populate: { player: { fields: ['name'], populate: { photo: MEDIA } }, highlightStat: true, stats: true },
      sort: 'sortOrder:asc',
      pagination: { pageSize: 100 },
    },
  }),

  getDeepLinkByCode: (code: string): Query => ({
    contentType: 'deep-links',
    kind: 'many',
    tags: [TAGS.deepLink, TAGS.audienceCategory],
    options: {
      filters: { code: { $eq: code } },
      populate: { audienceCategories: { fields: ['name', 'slug', 'description', 'sortOrder'] } },
      pagination: { pageSize: 1 },
    },
  }),
} satisfies Record<string, (...args: never[]) => Query>;

export type QueryName = keyof typeof QUERIES;

// --- reading through the data cache ---------------------------------------------------------
//
// onError: what a section renders when Strapi fails upstream on a miss (5xx, timeout, network)
// and no stale copy exists. Never stored. An auth failure (401/403) never gets it (P0-V11).

function readMany<R>(fn: QueryName, q: Query): Promise<{ data: R[]; total: number }> {
  return cached({
    fn,
    url: strapiUrl(q.contentType, q.options),
    tags: q.tags,
    load: () => getStrapiClient().findMany<R>(q.contentType, q.options),
    onError: () => ({ data: [], total: 0 }),
  });
}

/** Every page of a collection; `onError` decides what "unavailable" means for the caller. */
function readAll<R, E>(fn: QueryName, q: Query, onError: () => E): Promise<R[] | E> {
  return cached<R[] | E>({
    fn,
    url: strapiUrl(q.contentType, q.options),
    tags: q.tags,
    load: () => getStrapiClient().findAll<R>(q.contentType, q.options),
    onError,
  });
}

function readSingle<R>(fn: QueryName, q: Query): Promise<R | null> {
  return cached<R | null>({
    fn,
    url: strapiUrl(q.contentType, q.options),
    tags: q.tags,
    load: () => getStrapiClient().findSingle<R>(q.contentType, q.options),
    onError: () => null,
  });
}

// --- the data functions -----------------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  const { data } = await readMany<StrapiRawCategory>('getCategories', QUERIES.getCategories());
  return data.map(mapCategory);
}

// The four by-slug lookups below are wrapped in React cache(): generateMetadata and the page
// call them with the same slug, and cache() turns that into one lookup per request.

export const getCategoryBySlug = cache(async (slug: string): Promise<Category | null> => {
  const { data } = await readMany<StrapiRawCategory>('getCategoryBySlug', QUERIES.getCategoryBySlug(slug));
  return data.length > 0 ? mapCategory(data[0]) : null;
});

/**
 * Slugs of ALL categories, hidden ones included (getCategoryBySlug serves those by direct URL
 * too). The /kategorie/[category] routes check it before any other data call, so an unknown
 * slug costs no Strapi request and no per-slug cache key. `null` = Strapi failed: callers fall
 * through to getCategoryBySlug instead of 404ing every category.
 */
export async function getCategorySlugIndex(): Promise<string[] | null> {
  const data = await readAll<Pick<StrapiRawCategory, 'slug'>, null>('getCategorySlugIndex', QUERIES.getCategorySlugIndex(), () => null);
  return data ? data.map((c) => c.slug).filter(Boolean) : null;
}

export async function getCategoryGroups(): Promise<CategoryGroup[]> {
  const { data } = await readMany<StrapiRawCategoryGroup>('getCategoryGroups', QUERIES.getCategoryGroups());
  return data.map(mapCategoryGroup).filter((g) => g.categories.length > 0);
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
  const q = QUERIES.getNewsArticlesByCategory(categorySlug, page, pageSize, asList(newsArticleTypeSlugs));
  const { data, total } = await readMany<StrapiRawNewsArticle>('getNewsArticlesByCategory', q);
  return { articles: data.map(mapNewsArticleSummary), total };
}

export async function getAllNewsArticles(
  page = 1,
  pageSize = 12,
  newsArticleTypeSlugs?: string | string[],
  categorySlugs?: string | string[],
): Promise<{ articles: NewsArticleSummary[]; total: number }> {
  const q = QUERIES.getAllNewsArticles(page, pageSize, asList(newsArticleTypeSlugs), asList(categorySlugs));
  const { data, total } = await readMany<StrapiRawNewsArticle>('getAllNewsArticles', q);
  return { articles: data.map(mapNewsArticleSummary), total };
}

export async function getNewsArticleTypes(): Promise<NewsArticleType[]> {
  const { data } = await readMany<StrapiRawNewsArticleType>('getNewsArticleTypes', QUERIES.getNewsArticleTypes());
  return data.map((t) => ({ documentId: t.documentId, name: t.name, slug: t.slug }));
}

export const getNewsArticleBySlug = cache(async (slug: string): Promise<NewsArticle | null> => {
  const { data } = await readMany<StrapiRawNewsArticle>('getNewsArticleBySlug', QUERIES.getNewsArticleBySlug(slug));
  return data.length > 0 ? mapNewsArticle(data[0]) : null;
});

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
  const { data } = await readMany<StrapiRawMatch>('getUpcomingMatches', QUERIES.getUpcomingMatches(categorySlug, limit, today()));
  return data.map(mapMatch);
}

export async function getFinishedMatches(categorySlug: string, limit = 3): Promise<Match[]> {
  const { data } = await readMany<StrapiRawMatch>('getFinishedMatches', QUERIES.getFinishedMatches(categorySlug, limit));
  return data.map(mapMatch);
}

export async function getAllMatchesByCategory(categorySlug: string): Promise<Match[]> {
  const data = await readAll<StrapiRawMatch, StrapiRawMatch[]>('getAllMatchesByCategory', QUERIES.getAllMatchesByCategory(categorySlug), () => []);
  return data.map(mapMatch);
}

/**
 * Club-wide match listing for the "Kdy hrajeme" page: all categories,
 * filterable by category, home/away and season. Matches without the synced
 * season field (manually created) fall back to the season's date window.
 */
export async function getClubMatches(filter: ClubMatchesFilter): Promise<ClubMatchesResult> {
  const pageSize = filter.pageSize ?? 20;
  const { data, total } = await readMany<StrapiRawMatch>('getClubMatches', QUERIES.getClubMatches(filter));
  return {
    matches: data.map(mapMatch),
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Seasons available across synced data (from tournaments), newest first.
 * Always includes the current season.
 */
export async function getAvailableSeasons(): Promise<number[]> {
  const { data } = await readMany<{ id: number; season: number | null }>('getAvailableSeasons', QUERIES.getAvailableSeasons());
  const seasons = new Set<number>();
  for (const t of data) {
    if (t.season) seasons.add(t.season);
  }
  seasons.add(currentSeasonStartYear());
  return [...seasons].sort((a, b) => b - a);
}

export async function getPlayersByCategory(categorySlug: string): Promise<Player[]> {
  const { data } = await readMany<StrapiRawPlayer>('getPlayersByCategory', QUERIES.getPlayersByCategory(categorySlug));
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
  const { data } = await readMany<StrapiRawNavigation>('getNavigation', QUERIES.getNavigation());
  return data.map(mapNavigation).filter((item): item is NavigationItem => item !== null);
}

export async function getFooter(): Promise<Footer | null> {
  const raw = await readSingle<StrapiRawFooter>('getFooter', QUERIES.getFooter());
  return raw ? mapFooter(raw) : null;
}

export async function getNavigationPages(): Promise<{ title: string; slug: string }[]> {
  const { data } = await readMany<StrapiRawPage>('getNavigationPages', QUERIES.getNavigationPages());
  return data.map((p) => ({ title: p.title, slug: p.slug }));
}

export const getPageBySlug = cache(async (slug: string): Promise<Page | null> => {
  const { data } = await readMany<StrapiRawPage>('getPageBySlug', QUERIES.getPageBySlug(slug));
  return data.length > 0 ? mapPage(data[0]) : null;
});

/**
 * Every CMS page slug: the membership index the `[slug]` catch-all checks before it asks Strapi
 * for a page, so scanner paths (/.env, /wp-login.php, …) cost no Strapi call and no cache key
 * of their own. Loaded with findAll (no 100-row cliff). `null` = Strapi failed: callers fall
 * through to getPageBySlug instead of 404ing every CMS page during a Strapi blip.
 */
export async function getPageSlugIndex(): Promise<string[] | null> {
  const data = await readAll<Pick<StrapiRawPage, 'slug'>, null>('getPageSlugIndex', QUERIES.getPageSlugIndex(), () => null);
  return data ? data.map((p) => p.slug).filter(Boolean) : null;
}

export async function getStandingsByCategory(categorySlug: string): Promise<Standing[]> {
  const { data } = await readMany<StrapiRawStanding>('getStandingsByCategory', QUERIES.getStandingsByCategory(categorySlug));
  return data.map(mapStanding);
}

export async function getCategoryWithHeroBySlug(
  slug: string,
): Promise<{ category: Category; hero: CategoryHeroData } | null> {
  const { data } = await readMany<StrapiRawCategoryWithHero>('getCategoryWithHeroBySlug', QUERIES.getCategoryWithHeroBySlug(slug));
  if (data.length === 0) return null;
  const raw = data[0];
  return {
    category: mapCategory(raw),
    hero: {
      staticHeroSlideImage: mapMedia(raw.staticHeroSlideImage),
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
  const { data } = await readMany<StrapiRawMatch>('getUpcomingMatch', QUERIES.getUpcomingMatch(categorySlug, today()));
  return data.length > 0 ? mapMatch(data[0]) : null;
}

export async function getLastResult(categorySlug: string): Promise<Match | null> {
  const { data } = await readMany<StrapiRawMatch>('getLastResult', QUERIES.getLastResult(categorySlug));
  return data.length > 0 ? mapMatch(data[0]) : null;
}

export async function getPartners(): Promise<Partner[]> {
  const { data } = await readMany<StrapiRawPartner>('getPartners', QUERIES.getPartners());
  return data.map(mapPartner);
}

export const getPartnerBySlug = cache(async (slug: string): Promise<PartnerDetail | null> => {
  const { data } = await readMany<StrapiRawPartner>('getPartnerBySlug', QUERIES.getPartnerBySlug(slug));
  return data.length > 0 ? mapPartnerDetail(data[0]) : null;
});

export async function getPlayerHighlightsByCategory(categorySlug: string): Promise<PlayerHighlight[]> {
  const { data } = await readMany<StrapiRawPlayerHighlight>('getPlayerHighlightsByCategory', QUERIES.getPlayerHighlightsByCategory(categorySlug));
  return data.map(mapPlayerHighlight);
}

// --- Deep links (landing page /a/<code>) ---

export async function getDeepLinkByCode(rawCode: string): Promise<DeepLink | null> {
  for (const code of deepLinkCodeCandidates(rawCode)) {
    const { data } = await readMany<StrapiRawDeepLink>('getDeepLinkByCode', QUERIES.getDeepLinkByCode(code));
    // Status (active/expired) is computed at request time, never from the cached snapshot's clock.
    if (data[0]) return mapDeepLink(data[0]);
  }
  return null;
}
