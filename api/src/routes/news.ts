import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { strapiGet, strapiGetWithPagination } from '../lib/strapi.js';
import { NewsArticleSummarySchema, NewsArticleDetailSchema } from '../schemas/news.js';
import { PaginationSchema } from '../schemas/shared.js';
import { mapNewsArticleSummary, mapNewsArticleDetail } from '../mappers/news.js';
import type { StrapiRawNewsArticle } from '../types/strapi.js';

const listRoute = createRoute({
  method: 'get',
  path: '/news',
  request: {
    query: z.object({
      category: z.string().optional().openapi({ description: 'Filter by category slug' }),
      page: z.coerce.number().optional().default(1).openapi({ description: 'Page number' }),
      pageSize: z.coerce.number().optional().default(20).openapi({ description: 'Items per page' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(NewsArticleSummarySchema),
            pagination: PaginationSchema,
          }),
        },
      },
      description: 'Paginated list of news articles',
    },
  },
});

const detailRoute = createRoute({
  method: 'get',
  path: '/news/{slug}',
  request: {
    params: z.object({
      slug: z.string().openapi({ description: 'Article slug' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: NewsArticleDetailSchema,
          }),
        },
      },
      description: 'News article detail',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Article not found',
    },
  },
});

export const newsRoute = new OpenAPIHono();

const listPopulate = {
  mainPhoto: { fields: ['url', 'alternativeText', 'width', 'height'] },
  categories: { fields: ['name', 'slug'] },
  newsArticleTypes: { fields: ['name', 'slug'] },
};

newsRoute.openapi(listRoute, async (c) => {
  const { category, page, pageSize } = c.req.valid('query');

  const filters: Record<string, unknown> = {};
  if (category) {
    filters.categories = { slug: { $eq: category } };
  }

  const result = await strapiGetWithPagination<StrapiRawNewsArticle>('/news-articles', {
    sort: 'createdAt:desc',
    pagination: { page, pageSize },
    filters,
    populate: listPopulate,
  });

  const data = result.data.map(mapNewsArticleSummary);
  return c.json({ data, pagination: result.pagination });
});

newsRoute.openapi(detailRoute, async (c) => {
  const { slug } = c.req.valid('param');

  const result = await strapiGet<StrapiRawNewsArticle>('/news-articles', {
    filters: { slug: { $eq: slug } },
    pagination: { pageSize: 1 },
    populate: {
      ...listPopulate,
      gallery: { fields: ['url', 'alternativeText', 'width', 'height'] },
      relatedNews: {
        populate: listPopulate,
      },
    },
  });

  const article = result.data[0];
  if (!article) {
    return c.json({ error: 'Article not found' }, 404);
  }

  return c.json({ data: mapNewsArticleDetail(article) }, 200);
});
