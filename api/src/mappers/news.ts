import { markdownToHtml } from '../lib/markdown.js';
import { mapMedia, mapMediaArray } from '../lib/media.js';
import type { StrapiRawNewsArticle } from '../types/strapi.js';
import { mapCategories } from './shared.js';

function mapNewsArticleTypes(raw: StrapiRawNewsArticle['newsArticleTypes']) {
  if (!raw) return [];
  return raw.map((item) => ({
    documentId: item.documentId,
    name: item.name,
    slug: item.slug,
  }));
}

export function mapNewsArticleSummary(raw: StrapiRawNewsArticle) {
  return {
    documentId: raw.documentId,
    title: raw.title,
    slug: raw.slug ?? null,
    description: raw.description ? markdownToHtml(raw.description) : null,
    mainPhoto: mapMedia(raw.mainPhoto),
    categories: mapCategories(raw.categories),
    newsArticleTypes: mapNewsArticleTypes(raw.newsArticleTypes),
    date: raw.date,
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
