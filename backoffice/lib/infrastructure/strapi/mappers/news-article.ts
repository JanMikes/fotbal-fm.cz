/**
 * News article mapper.
 * Transforms raw Strapi news-article data into domain NewsArticle type.
 */

import { z } from 'zod/v4';
import { NewsArticle } from '@/types/news-article';
import { Category } from '@/types/category';
import { strapiRawCategorySchema, strapiRawUserInfoSchema, strapiRawMediaSchema } from '../types';
import {
  mapRawMediaToImage,
  mapMediaToImages,
  mapMediaToFiles,
  mapUserInfo,
  nullToUndefined,
} from './shared';
import { ValidationError } from '@/lib/core/errors';

/**
 * Zod schema for news article validation
 */
const strapiRawNewsArticleSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  title: z.string(),
  slug: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  video: z.string().nullable().optional(),
  mainPhoto: strapiRawMediaSchema.nullable().optional(),
  gallery: z.array(strapiRawMediaSchema).nullable().optional(),
  files: z.array(strapiRawMediaSchema).nullable().optional(),
  categories: z.array(strapiRawCategorySchema).nullable().optional(),
  author: z.union([
    strapiRawUserInfoSchema,
    z.object({ data: strapiRawUserInfoSchema.nullable().optional() }),
  ]).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Map raw Strapi categories to domain Category array
 */
function mapCategories(categories: z.infer<typeof strapiRawCategorySchema>[] | null | undefined): Category[] {
  if (!categories || !Array.isArray(categories)) {
    return [];
  }

  return categories.map((c) => ({
    id: c.documentId,
    name: c.name,
    slug: c.slug,
    sortOrder: c.sortOrder ?? 0,
  }));
}

/**
 * Map raw Strapi news article to domain NewsArticle
 */
export function mapNewsArticle(raw: unknown): NewsArticle {
  if (!raw) {
    throw new ValidationError(
      'Neplatná data aktuality: prázdná data',
      { raw }
    );
  }

  const parseResult = strapiRawNewsArticleSchema.safeParse(raw);

  if (!parseResult.success) {
    const rawObj = raw as Record<string, unknown>;
    console.error('[mapNewsArticle] Validation failed for article id=%s documentId=%s. Errors:', rawObj?.id, rawObj?.documentId, JSON.stringify(parseResult.error.issues, null, 2));
    throw new ValidationError(
      'Neplatná data aktuality ze Strapi',
      { zodErrors: parseResult.error.issues }
    );
  }

  const data = parseResult.data;

  return {
    id: data.documentId,
    title: data.title,
    slug: nullToUndefined(data.slug),
    date: data.date ?? data.createdAt,
    description: nullToUndefined(data.description),
    video: nullToUndefined(data.video),
    mainPhoto: data.mainPhoto ? mapRawMediaToImage(data.mainPhoto) : null,
    gallery: mapMediaToImages(data.gallery),
    files: mapMediaToFiles(data.files),
    categories: mapCategories(data.categories),
    author: mapUserInfo(data.author),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Map array of raw Strapi news articles
 */
export function mapNewsArticles(rawArray: unknown[]): NewsArticle[] {
  return rawArray.map(mapNewsArticle);
}

/**
 * Safe mapper that returns null on failure instead of throwing
 */
export function safeMapNewsArticle(raw: unknown): NewsArticle | null {
  try {
    return mapNewsArticle(raw);
  } catch {
    // Error already logged by mapNewsArticle
    return null;
  }
}
