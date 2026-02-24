import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { StrapiRawCategory } from '@fotbal-fm/strapi-client';
import { strapiGet } from '../lib/strapi.js';

const CategorySchema = z.object({
  id: z.number(),
  documentId: z.string(),
  name: z.string(),
  slug: z.string(),
  sortOrder: z.number(),
});

const route = createRoute({
  method: 'get',
  path: '/categories',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(CategorySchema),
          }),
        },
      },
      description: 'List of categories',
    },
  },
});

export const categoriesRoute = new OpenAPIHono();

categoriesRoute.openapi(route, async (c) => {
  const result = await strapiGet<StrapiRawCategory>('/categories', {
    sort: 'sortOrder:asc',
    pagination: { pageSize: 100 },
  });

  const data = result.data.map((cat) => ({
    id: cat.id,
    documentId: cat.documentId,
    name: cat.name,
    slug: cat.slug,
    sortOrder: cat.sortOrder,
  }));

  return c.json({ data });
});
