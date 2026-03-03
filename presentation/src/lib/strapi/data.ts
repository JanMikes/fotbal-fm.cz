import type {
  Category,
  CategoryHeroData,
  FooterLinkSection,
  Match,
  NavigationItem,
  NewsArticle,
  NewsArticleSummary,
  Page,
  Partner,
  PartnerDetail,
  Player,
  Standing,
} from '@/lib/types';
import type {
  StrapiRawCategory,
  StrapiRawCategoryWithHero,
  StrapiRawFooterLinkSection,
  StrapiRawMatch,
  StrapiRawNavigation,
  StrapiRawNewsArticle,
  StrapiRawPage,
  StrapiRawPartner,
  StrapiRawPlayer,
  StrapiRawStanding,
} from './types';
import { getStrapiClient } from './client';
import { mapCategory } from './mappers/category';
import { mapFooterLinkSection } from './mappers/footer-link-section';
import { mapMatch } from './mappers/match';
import { mapNavigation } from './mappers/navigation';
import { mapNewsArticle, mapNewsArticleSummary } from './mappers/news-article';
import { mapPage } from './mappers/page';
import { mapPartner, mapPartnerDetail } from './mappers/partner';
import { mapPlayer } from './mappers/player';
import { mapStanding } from './mappers/standing';
import { mapMedia } from './mappers/shared';
import { buildNavigationPopulate, buildFooterLinkSectionPopulate, buildPagePopulate, buildPartnerPopulate } from './populates';

export async function getCategories(): Promise<Category[]> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawCategory>('categories', {
    filters: { hidden: { $ne: true } },
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

export async function getNewsArticlesByCategory(
  categorySlug: string,
  page = 1,
  pageSize = 6,
): Promise<{ articles: NewsArticleSummary[]; total: number }> {
  const client = getStrapiClient();
  const { data, total } = await client.findMany<StrapiRawNewsArticle>('news-articles', {
    filters: {
      categories: { slug: { $eq: categorySlug } },
    },
    populate: {
      mainPhoto: { fields: ['url', 'alternativeText', 'width', 'height'] },
      categories: { fields: ['name', 'slug'] },
      newsArticleType: { fields: ['name', 'slug'] },
    },
    sort: 'createdAt:desc',
    pagination: { page, pageSize },
  });
  return {
    articles: data.map(mapNewsArticleSummary),
    total,
  };
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
      newsArticleType: { fields: ['name', 'slug'] },
      relatedNews: {
        populate: {
          mainPhoto: { fields: ['url', 'alternativeText', 'width', 'height'] },
          categories: { fields: ['name', 'slug'] },
          newsArticleType: { fields: ['name', 'slug'] },
        },
      },
    },
    pagination: { pageSize: 1 },
  });
  return data.length > 0 ? mapNewsArticle(data[0]) : null;
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
      homeTeam: { fields: ['name'] },
      awayTeam: { fields: ['name'] },
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
      homeTeam: { fields: ['name'] },
      awayTeam: { fields: ['name'] },
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
      homeTeam: { fields: ['name'] },
      awayTeam: { fields: ['name'] },
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
  return data.map(mapPlayer);
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

export async function getFooterLinkSections(): Promise<FooterLinkSection[]> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawFooterLinkSection>('footer-link-sections', {
    sort: 'sortOrder:asc',
    populate: buildFooterLinkSectionPopulate(),
    pagination: { pageSize: 100 },
  });
  return data.map(mapFooterLinkSection);
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
      team: { fields: ['name'] },
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
      homeTeam: { fields: ['name'] },
      awayTeam: { fields: ['name'] },
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
      homeTeam: { fields: ['name'] },
      awayTeam: { fields: ['name'] },
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
