import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { extractJwt } from '../middleware/auth.js';
import {
  AuthRequiredError,
  fetchUserAudienceCategories,
  getCurrentUser,
  listAudienceCategories,
  setUserAudienceCategories,
} from '../lib/audience.js';
import { mapAudienceCategories } from '../mappers/audience.js';
import { AudienceCategorySchema } from '../schemas/audience.js';

const ErrorSchema = z.object({ error: z.string() });
const ListSchema = z.object({ data: z.array(AudienceCategorySchema) });

const getRoute = createRoute({
  method: 'get',
  path: '/me/audience-categories',
  description: 'Audience categories of the signed-in user (Bearer JWT).',
  responses: {
    200: { content: { 'application/json': { schema: ListSchema } }, description: 'My audience categories' },
    401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' },
  },
});

const PutBodySchema = z.object({
  audienceCategories: z
    .array(z.string().min(1))
    .max(100)
    .openapi({ example: ['rodice-u12', 'fanousci'], description: 'Slugs — the full new list (replaces the current one)' }),
});

const putRoute = createRoute({
  method: 'put',
  path: '/me/audience-categories',
  description:
    'Replaces the signed-in user\'s audience categories with the given slugs. Any selectable category may be ' +
    'added; a non-selectable one may only be kept if the user already has it (they may always drop it).',
  request: { body: { content: { 'application/json': { schema: PutBodySchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: ListSchema } }, description: 'Updated list' },
    400: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unknown or non-selectable slug' },
    401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' },
  },
});

export const meRoute = new OpenAPIHono();

meRoute.openapi(getRoute, async (c) => {
  let user;
  try {
    user = await getCurrentUser(extractJwt(c));
  } catch (err) {
    return c.json({ error: (err as Error).message }, 401);
  }

  const data = mapAudienceCategories(await fetchUserAudienceCategories(user.id));
  return c.json({ data }, 200);
});

meRoute.openapi(putRoute, async (c) => {
  let user;
  try {
    user = await getCurrentUser(extractJwt(c));
  } catch (err) {
    return c.json({ error: (err as Error).message }, 401);
  }

  const { audienceCategories: slugs } = c.req.valid('json');
  const [all, current] = await Promise.all([listAudienceCategories(), fetchUserAudienceCategories(user.id)]);
  const bySlug = new Map(all.map((category) => [category.slug, category]));
  const ownedIds = new Set(current.map((category) => category.id));

  const next = [];
  for (const slug of new Set(slugs)) {
    const category = bySlug.get(slug);
    if (!category) {
      return c.json({ error: `Neznámá skupina: ${slug}` }, 400);
    }
    if (category.selectable === false && !ownedIds.has(category.id)) {
      return c.json({ error: `Skupinu nelze zvolit: ${slug}` }, 400);
    }
    next.push(category);
  }

  try {
    await setUserAudienceCategories(user.id, next.map((category) => category.id));
  } catch (err) {
    if (err instanceof AuthRequiredError) return c.json({ error: err.message }, 401);
    throw err;
  }

  return c.json({ data: mapAudienceCategories(next) }, 200);
});
