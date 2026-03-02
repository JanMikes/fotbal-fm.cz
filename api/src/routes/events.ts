import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { strapiGet } from '../lib/strapi.js';
import { EventSchema } from '../schemas/event.js';
import { mapEvent } from '../mappers/event.js';
import type { StrapiRawEvent } from '../types/strapi.js';

const route = createRoute({
  method: 'get',
  path: '/events',
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
            data: z.array(EventSchema),
          }),
        },
      },
      description: 'List of events',
    },
  },
});

export const eventsRoute = new OpenAPIHono();

eventsRoute.openapi(route, async (c) => {
  const { category } = c.req.valid('query');

  const filters: Record<string, unknown> = {};
  if (category) {
    filters.categories = { slug: { $eq: category } };
  }

  const result = await strapiGet<StrapiRawEvent>('/events', {
    sort: 'dateFrom:desc',
    pagination: { pageSize: 100 },
    filters,
    populate: {
      categories: { fields: ['name', 'slug'] },
      photos: { fields: ['url', 'alternativeText', 'width', 'height'] },
    },
  });

  const data = result.data.map(mapEvent);
  return c.json({ data });
});
