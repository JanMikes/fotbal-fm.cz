import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { listAudienceCategories } from '../lib/audience.js';
import { mapAudienceCategories } from '../mappers/audience.js';
import { AudienceCategorySchema } from '../schemas/audience.js';

const listRoute = createRoute({
  method: 'get',
  path: '/audience-categories',
  description:
    'Audience categories a user may pick for themselves (selectable = true), sorted. ' +
    'Categories a user already has but cannot self-select come back only from /me/audience-categories.',
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ data: z.array(AudienceCategorySchema) }) } },
      description: 'Selectable audience categories',
    },
  },
});

export const audienceCategoriesRoute = new OpenAPIHono();

audienceCategoriesRoute.openapi(listRoute, async (c) => {
  const all = await listAudienceCategories();
  const data = mapAudienceCategories(all.filter((category) => category.selectable !== false));
  return c.json({ data }, 200);
});
