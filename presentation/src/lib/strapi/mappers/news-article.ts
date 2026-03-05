import type { NewsArticle, NewsArticleSummary } from '@/lib/types';
import type { StrapiRawNewsArticle } from '../types';
import { mapMedia, mapMediaArray, mapFileArray } from './shared';
import { mapCategories } from './category';
import { mapNewsArticleTypes } from './news-article-type';

export function mapNewsArticleSummary(raw: StrapiRawNewsArticle): NewsArticleSummary {
  return {
    documentId: raw.documentId,
    title: raw.title,
    slug: raw.slug || raw.documentId,
    description: raw.description,
    mainPhoto: mapMedia(raw.mainPhoto),
    categories: mapCategories(raw.categories),
    newsArticleTypes: mapNewsArticleTypes(raw.newsArticleTypes),
    createdAt: raw.createdAt,
  };
}

export function mapNewsArticle(raw: StrapiRawNewsArticle): NewsArticle {
  return {
    ...mapNewsArticleSummary(raw),
    description: raw.description ?? null,
    video: raw.video,
    gallery: mapMediaArray(raw.gallery),
    files: mapFileArray(raw.files),
    relatedNews: (raw.relatedNews ?? []).map(mapNewsArticleSummary),
  };
}
