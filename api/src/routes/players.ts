import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { strapiGet } from '../lib/strapi.js';
import { PlayerSchema } from '../schemas/player.js';
import { mapPlayer } from '../mappers/player.js';
import type { StrapiRawPlayer } from '../types/strapi.js';

const route = createRoute({
  method: 'get',
  path: '/players',
  request: {
    query: z.object({
      category: z.string().optional().openapi({ description: 'Filter by category slug' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(PlayerSchema),
          }),
        },
      },
      description: 'List of players',
    },
  },
});

export const playersRoute = new OpenAPIHono();

playersRoute.openapi(route, async (c) => {
  const { category } = c.req.valid('query');

  const filters: Record<string, unknown> = {};
  if (category) {
    filters.categories = { slug: { $eq: category } };
  }

  const result = await strapiGet<StrapiRawPlayer>('/players', {
    sort: 'sortOrder:asc',
    pagination: { pageSize: 200 },
    filters,
    populate: {
      photo: { fields: ['url', 'alternativeText', 'width', 'height'] },
      categories: { fields: ['name', 'slug'] },
    },
  });

  const data = result.data.map(mapPlayer);
  return c.json({ data });
});
