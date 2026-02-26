import type {
  Category,
  Match,
  NewsArticle,
  NewsArticleSummary,
  Player,
} from '@/lib/types';
import type {
  StrapiRawCategory,
  StrapiRawMatchResult,
  StrapiRawNewsArticle,
  StrapiRawPlayer,
} from './types';
import { getStrapiClient } from './client';
import { mapCategory } from './mappers/category';
import { mapMatchResult } from './mappers/match-result';
import { mapNewsArticle, mapNewsArticleSummary } from './mappers/news-article';
import { mapPlayer } from './mappers/player';

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
  const { data } = await client.findMany<StrapiRawMatchResult>('match-results', {
    filters: {
      categories: { slug: { $eq: categorySlug } },
    },
    sort: 'matchDate:desc',
    pagination: { pageSize: 20 },
  });
  return data.map(mapMatchResult);
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
