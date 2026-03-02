import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { strapiGet } from '../lib/strapi.js';
import { StandingSchema } from '../schemas/standing.js';
import { mapStanding } from '../mappers/standing.js';
import type { StrapiRawStanding } from '../types/strapi.js';

const route = createRoute({
  method: 'get',
  path: '/standings',
  request: {
    query: z.object({
      category: z.string().openapi({ description: 'Filter by category slug (required)' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(StandingSchema),
          }),
        },
      },
      description: 'Standings table for a category',
    },
  },
});

export const standingsRoute = new OpenAPIHono();

standingsRoute.openapi(route, async (c) => {
  const { category } = c.req.valid('query');

  const result = await strapiGet<StrapiRawStanding>('/standings', {
    sort: 'position:asc',
    pagination: { pageSize: 100 },
    filters: {
      categories: { slug: { $eq: category } },
    },
    populate: {
      team: {
        fields: ['name'],
        populate: {
          logo: { fields: ['url', 'alternativeText', 'width', 'height'] },
        },
      },
      tournament: { fields: ['name'] },
    },
  });

  const data = result.data.map(mapStanding);
  return c.json({ data });
});
