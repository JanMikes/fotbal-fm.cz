import { z } from '@hono/zod-openapi';
import { MediaImageSchema, CategorySchema } from './shared.js';

export const NewsArticleTypeSchema = z.object({
  documentId: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const NewsArticleSummarySchema = z.object({
  documentId: z.string(),
  title: z.string(),
  slug: z.string().nullable(),
  description: z.string().nullable(),
  mainPhoto: MediaImageSchema.nullable(),
  categories: z.array(CategorySchema),
  newsArticleType: NewsArticleTypeSchema.nullable(),
  createdAt: z.string(),
});

export const NewsArticleDetailSchema = NewsArticleSummarySchema.extend({
  video: z.string().nullable(),
  gallery: z.array(MediaImageSchema),
  relatedNews: z.array(NewsArticleSummarySchema),
});
