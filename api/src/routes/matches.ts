import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { strapiGetWithPagination } from '../lib/strapi.js';
import { MatchSchema } from '../schemas/match.js';
import { PaginationSchema } from '../schemas/shared.js';
import { mapMatch } from '../mappers/match.js';
import type { StrapiRawMatch } from '../types/strapi.js';

const route = createRoute({
  method: 'get',
  path: '/matches',
  request: {
    query: z.object({
      category: z.string().optional().openapi({ description: 'Filter by category slug' }),
      status: z.enum(['upcoming', 'finished']).optional().openapi({ description: 'Filter by match status' }),
      page: z.coerce.number().optional().default(1).openapi({ description: 'Page number' }),
      pageSize: z.coerce.number().optional().default(20).openapi({ description: 'Items per page' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(MatchSchema),
            pagination: PaginationSchema,
          }),
        },
      },
      description: 'Paginated list of matches',
    },
  },
});

export const matchesRoute = new OpenAPIHono();

matchesRoute.openapi(route, async (c) => {
  const { category, status, page, pageSize } = c.req.valid('query');

  const filters: Record<string, unknown> = {};
  if (category) {
    filters.categories = { slug: { $eq: category } };
  }
  if (status === 'upcoming') {
    filters.homeScore = { $null: true };
  } else if (status === 'finished') {
    filters.homeScore = { $notNull: true };
  }

  let sort: string;
  if (status === 'upcoming') {
    sort = 'matchDate:asc';
  } else {
    sort = 'matchDate:desc';
  }

  const result = await strapiGetWithPagination<StrapiRawMatch>('/matches', {
    sort,
    pagination: { page, pageSize },
    filters,
    populate: {
      homeTeam: {
        fields: ['name'],
        populate: {
          logo: { fields: ['url', 'alternativeText', 'width', 'height'] },
        },
      },
      awayTeam: {
        fields: ['name'],
        populate: {
          logo: { fields: ['url', 'alternativeText', 'width', 'height'] },
        },
      },
      tournament: { fields: ['name'] },
      categories: { fields: ['name', 'slug'] },
    },
  });

  const data = result.data.map(mapMatch);
  return c.json({ data, pagination: result.pagination });
});
