import type { NewsArticle, NewsArticleSummary } from '@/lib/types';
import type { StrapiRawNewsArticle } from '../types';
import { mapMedia, mapMediaArray } from './shared';
import { mapCategories } from './category';
import { mapNewsArticleType } from './news-article-type';

export function mapNewsArticleSummary(raw: StrapiRawNewsArticle): NewsArticleSummary {
  return {
    documentId: raw.documentId,
    title: raw.title,
    slug: raw.slug || raw.documentId,
    description: raw.description,
    mainPhoto: mapMedia(raw.mainPhoto),
    categories: mapCategories(raw.categories),
    newsArticleType: mapNewsArticleType(raw.newsArticleType),
    createdAt: raw.createdAt,
  };
}

export function mapNewsArticle(raw: StrapiRawNewsArticle): NewsArticle {
  return {
    ...mapNewsArticleSummary(raw),
    video: raw.video,
    gallery: mapMediaArray(raw.gallery),
    relatedNews: (raw.relatedNews ?? []).map(mapNewsArticleSummary),
  };
}
