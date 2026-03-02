import type {
  Category,
  Match,
  NavigationItem,
  NewsArticle,
  NewsArticleSummary,
  Page,
  Player,
} from '@/lib/types';
import type {
  StrapiRawCategory,
  StrapiRawMatch,
  StrapiRawNavigation,
  StrapiRawNewsArticle,
  StrapiRawPage,
  StrapiRawPlayer,
} from './types';
import { getStrapiClient } from './client';
import { mapCategory } from './mappers/category';
import { mapMatch } from './mappers/match';
import { mapNavigation } from './mappers/navigation';
import { mapNewsArticle, mapNewsArticleSummary } from './mappers/news-article';
import { mapPage } from './mappers/page';
import { mapPlayer } from './mappers/player';
import { buildNavigationPopulate, buildPagePopulate } from './populates';

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

export async function getMatchesByCategory(categorySlug: string): Promise<Match[]> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawMatch>('matches', {
    filters: {
      categories: { slug: { $eq: categorySlug } },
    },
    populate: {
      tournament: { fields: ['name'] },
    },
    sort: 'matchDate:desc',
    pagination: { pageSize: 20 },
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

export async function getPlayerBySlug(slug: string): Promise<Player | null> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawPlayer>('players', {
    filters: { slug: { $eq: slug } },
    populate: {
      photo: { fields: ['url', 'alternativeText', 'width', 'height'] },
      categories: { fields: ['name', 'slug'] },
    },
    pagination: { pageSize: 1 },
  });
  return data.length > 0 ? mapPlayer(data[0]) : null;
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

export async function getPageBySlug(slug: string): Promise<Page | null> {
  const client = getStrapiClient();
  const { data } = await client.findMany<StrapiRawPage>('pages', {
    filters: { slug: { $eq: slug } },
    populate: buildPagePopulate(),
    pagination: { pageSize: 1 },
  });
  return data.length > 0 ? mapPage(data[0]) : null;
}
