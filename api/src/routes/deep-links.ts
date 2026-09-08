import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { extractJwt } from '../middleware/auth.js';
import { optionalJsonBody } from '../middleware/optional-json-body.js';
import { getCurrentUser } from '../lib/audience.js';
import {
  DeepLinkCategoryError,
  claimDeepLink,
  createDeepLinkForUser,
  deepLinkValidity,
  findDeepLinkByCode,
} from '../lib/deep-links.js';
import { readPlatform } from '../lib/platform.js';
import { clientIp } from '../lib/rate-limit.js';
import { RATE_LIMIT_MESSAGE, claimLimiter, createLimiter, resolveLimiter } from '../lib/deep-link-limits.js';
import { mapAudienceCategories, mapDeepLink } from '../mappers/audience.js';
import { DeepLinkClaimResultSchema, DeepLinkSchema, ErrorSchema } from '../schemas/audience.js';

const INVALID_MESSAGES = {
  not_found: 'Odkaz neexistuje.',
  inactive: 'Odkaz už není aktivní.',
  expired: 'Platnost odkazu vypršela.',
} as const;

const CodeParamSchema = z.object({
  code: z.string().min(1).max(32).openapi({ example: '7K3M9PQ2', description: 'Case-insensitive; dashes and spaces are ignored' }),
});

const resolveRoute = createRoute({
  method: 'get',
  path: '/deep-links/{code}',
  description: 'Resolves a deep link so the app or landing page can show which audience categories it grants.',
  request: { params: CodeParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ data: DeepLinkSchema }) } }, description: 'Deep link' },
    404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unknown, inactive or expired link' },
    429: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Too many requests' },
  },
});

const claimRoute = createRoute({
  method: 'post',
  path: '/deep-links/{code}/claim',
  description:
    'Adds the link\'s audience categories to the signed-in user (Bearer JWT). Idempotent — a repeated claim ' +
    'changes nothing and reports alreadyClaimed = true. Optional header X-App-Platform: ios | android | web.',
  request: { params: CodeParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ data: DeepLinkClaimResultSchema }) } }, description: 'Claimed' },
    401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' },
    404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unknown, inactive or expired link' },
    429: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Too many requests' },
  },
});

// `nullish`: a .NET client serialises an unset property as null, which must mean "omitted".
const CreateBodySchema = z.object({
  audienceCategories: z
    .array(z.string().min(1))
    .max(100)
    .nullish()
    .openapi({ description: 'Slugs to put on the link. Omitted or null = the caller\'s own selectable categories.' }),
  name: z.string().max(120).nullish().openapi({ description: 'Admin-visible label; defaults to "Pozvánka od <username>"' }),
});

const createRoute_ = createRoute({
  method: 'post',
  path: '/deep-links',
  description:
    '"Invite a friend": creates a deep link owned by the signed-in user (Bearer JWT). Only selectable categories ' +
    'can be shared. An identical active link by the same user is returned instead of creating a duplicate.',
  middleware: [optionalJsonBody],
  request: { body: { content: { 'application/json': { schema: CreateBodySchema } }, required: false } },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ data: DeepLinkSchema }) } }, description: 'Deep link (new or reused)' },
    400: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unknown or non-selectable category' },
    401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' },
    429: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Too many requests' },
  },
});

export const deepLinksRoute = new OpenAPIHono();

deepLinksRoute.openapi(resolveRoute, async (c) => {
  if (!resolveLimiter.check(clientIp(c))) {
    return c.json({ error: RATE_LIMIT_MESSAGE }, 429);
  }

  const { code } = c.req.valid('param');
  const link = await findDeepLinkByCode(code);
  const reason = link ? deepLinkValidity(link) : 'not_found';
  if (!link || reason) {
    const key = reason ?? 'not_found';
    return c.json({ error: INVALID_MESSAGES[key], reason: key }, 404);
  }

  return c.json({ data: mapDeepLink(link) }, 200);
});

deepLinksRoute.openapi(claimRoute, async (c) => {
  let user;
  try {
    user = await getCurrentUser(extractJwt(c));
  } catch (err) {
    return c.json({ error: (err as Error).message }, 401);
  }

  if (!claimLimiter.check(String(user.id))) {
    return c.json({ error: RATE_LIMIT_MESSAGE }, 429);
  }

  const { code } = c.req.valid('param');
  const link = await findDeepLinkByCode(code);
  const reason = link ? deepLinkValidity(link) : 'not_found';
  if (!link || reason) {
    const key = reason ?? 'not_found';
    return c.json({ error: INVALID_MESSAGES[key], reason: key }, 404);
  }

  const claim = await claimDeepLink({ link, user, source: 'claim', platform: readPlatform(c) });
  return c.json(
    {
      data: {
        code: link.code,
        claimed: true,
        alreadyClaimed: claim.alreadyClaimed,
        addedAudienceCategories: mapAudienceCategories(claim.added),
        audienceCategories: mapAudienceCategories(claim.audienceCategories),
      },
    },
    200,
  );
});

deepLinksRoute.openapi(createRoute_, async (c) => {
  let user;
  try {
    user = await getCurrentUser(extractJwt(c));
  } catch (err) {
    return c.json({ error: (err as Error).message }, 401);
  }

  if (!createLimiter.check(String(user.id))) {
    return c.json({ error: 'Příliš mnoho vytvořených odkazů. Zkuste to prosím později.' }, 429);
  }

  // The body is optional: an empty POST means "share my own categories".
  const body = c.req.valid('json') ?? {};

  try {
    const link = await createDeepLinkForUser({
      user,
      audienceCategorySlugs: body.audienceCategories ?? undefined,
      name: body.name ?? undefined,
    });
    return c.json({ data: mapDeepLink(link) }, 200);
  } catch (err) {
    if (err instanceof DeepLinkCategoryError) {
      return c.json({ error: err.message }, 400);
    }
    throw err;
  }
});
