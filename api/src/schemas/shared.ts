import { z } from '@hono/zod-openapi';

export const PaginationSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  pageCount: z.number(),
  total: z.number(),
});

export const MediaImageSchema = z.object({
  url: z.string(),
  alternativeText: z.string().nullable(),
  width: z.number(),
  height: z.number(),
});

export const CategorySchema = z.object({
  documentId: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const TeamSchema = z.object({
  name: z.string(),
  logo: MediaImageSchema.nullable(),
});
