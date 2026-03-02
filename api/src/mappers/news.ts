import { mapMedia, mapMediaArray } from '../lib/media.js';
import type { StrapiRawNewsArticle } from '../types/strapi.js';
import { mapCategories } from './shared.js';

function mapNewsArticleType(raw: StrapiRawNewsArticle['newsArticleType']) {
  if (!raw) return null;
  return {
    documentId: raw.documentId,
    name: raw.name,
    slug: raw.slug,
  };
}

export function mapNewsArticleSummary(raw: StrapiRawNewsArticle) {
  return {
    documentId: raw.documentId,
    title: raw.title,
    slug: raw.slug ?? null,
    description: raw.description ?? null,
    mainPhoto: mapMedia(raw.mainPhoto),
    categories: mapCategories(raw.categories),
    newsArticleType: mapNewsArticleType(raw.newsArticleType),
    createdAt: raw.createdAt,
  };
}

export function mapNewsArticleDetail(raw: StrapiRawNewsArticle) {
  return {
    ...mapNewsArticleSummary(raw),
    video: raw.video ?? null,
    gallery: mapMediaArray(raw.gallery),
    relatedNews: (raw.relatedNews ?? []).map(mapNewsArticleSummary),
  };
}
