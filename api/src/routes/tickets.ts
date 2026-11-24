import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { extractJwt } from '../middleware/auth.js';
import { createRateLimiter } from '../lib/rate-limit.js';
import {
  PurchaseNotCancellableError,
  PurchaseNotFoundError,
  PurchaseSelectionError,
  TicketingUnavailableError,
  cancelPurchase,
  environmentFor,
  getCatalog,
  getPurchase,
  getTicketingUser,
  listPurchases,
  listTickets,
  resumePurchase,
  startPurchase,
  type TicketingUser,
} from '../lib/ticketing.js';
import { UpfanApiError, UpfanBusyError } from '../lib/upfan.js';

/**
 * Ticket sales through Upfan (see docs/upfan-ticketing.md). Every route needs the user's JWT;
 * the API talks to Upfan with its own credentials and only ever returns the caller's purchases.
 */

const ErrorSchema = z.object({
  error: z.string(),
  reason: z.string().optional(),
  retryAfterMs: z.number().optional(),
});

const EnvironmentSchema = z.enum(['sandbox', 'production']).openapi({
  description: '`sandbox` = test purchase (account flagged as tester, fake payments) — show a TEST badge',
});

const ShopCategorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  purchasable: z.boolean(),
  unavailableReason: z.string().nullable().openapi({ description: 'not_on_sale | sold_out | assigned_seating | required_checkout_fields | …' }),
  unitAmount: z.number().int().nullable().openapi({ description: 'Price per ticket in minor units (haléře): 150000 = 1 500 Kč' }),
  currency: z.string(),
  availableQuantity: z.number().int().nullable().openapi({ description: 'Snapshot, not a guarantee; null = no tier limit' }),
  maxQuantity: z.number().int().openapi({ description: 'Upper bound for the quantity picker (≤ 10)' }),
});

const ShopEventSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().openapi({ description: 'HTML (from Upfan Markdown, raw HTML escaped) — render like our event descriptions' }),
  descriptionText: z.string().openapi({ description: 'Plain-text version of description' }),
  startsAt: z.string(),
  endsAt: z.string(),
  timezone: z.string(),
  currency: z.string(),
  venue: z.object({ name: z.string(), address: z.string() }).nullable(),
  purchasable: z.boolean(),
  unavailableReason: z.string().nullable(),
  categories: z.array(ShopCategorySchema),
});

const PurchaseSchema = z.object({
  reference: z.string().openapi({ example: 'fkfm-3f1c…', description: 'Our purchase id — store it while the purchase is unfinished' }),
  status: z.enum(['buyer_verification', 'payment', 'success', 'failure', 'expired', 'cancelled']),
  environment: EnvironmentSchema,
  event: z.object({ id: z.number().int(), name: z.string().nullable(), startsAt: z.string().nullable() }),
  category: z.object({ id: z.number().int(), name: z.string().nullable() }),
  quantity: z.number().int(),
  unitAmount: z.number().int().nullable(),
  totalAmount: z.number().int().nullable(),
  currency: z.string().nullable(),
  expiresAt: z.string().nullable().openapi({ description: 'Deadline of the current step (Upfan panel 10 min / ticket hold 15 min)' }),
  failureCode: z.string().nullable().openapi({
    description: 'sold_out | inventory_limit | event_unavailable | order_rejected | payment_failed | reservation_expired | onboarding_expired',
  }),
  nextAction: z
    .object({ type: z.literal('open_url'), url: z.string() })
    .nullable()
    .openapi({ description: 'Page to open in the system browser (Upfan verification or payment). Never a WebView.' }),
  pollAfterMs: z.number().int().nullable().openapi({ description: 'While status = payment: wait this long before the next GET' }),
  createdAt: z.string(),
});

const TicketSchema = z.object({
  id: z.number().int(),
  purchaseReference: z.string(),
  environment: EnvironmentSchema,
  status: z.string().openapi({ description: 'ready | pending_payment' }),
  holderName: z.string().nullable(),
  event: z.object({ id: z.number().int(), name: z.string(), startsAt: z.string(), endsAt: z.string() }),
  category: z.object({ id: z.number().int(), name: z.string() }),
  qrCode: z.string().nullable().openapi({
    description: 'Static admission payload — render verbatim as a QR code (black on white, keep it a string). Null = not usable.',
  }),
});

const ReferenceParamSchema = z.object({ reference: z.string().min(1).max(64) });

const errorResponses = {
  401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Missing or invalid JWT' },
  429: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Too many requests from this user' },
  503: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Ticket sales unavailable (reason=unavailable) or Upfan busy (reason=busy, Retry-After)' },
} as const;

const shopRoute = createRoute({
  method: 'get',
  path: '/tickets/shop',
  description: 'Events on sale with their ticket categories. `available: false` = hide the shop (sales not open for this account).',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({ available: z.boolean(), environment: EnvironmentSchema.nullable(), events: z.array(ShopEventSchema) }),
          }),
        },
      },
      description: 'Shop',
    },
    ...errorResponses,
  },
});

const startRoute = createRoute({
  method: 'post',
  path: '/ticket-purchases',
  description:
    'Starts a purchase. Usually returns status `buyer_verification` with `nextAction` = Upfan verification page; an already ' +
    'verified account in account mode goes straight to `payment` with the payment page.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            eventId: z.number().int().positive(),
            ticketCategoryId: z.number().int().positive(),
            quantity: z.number().int().min(1).max(10),
          }),
        },
      },
      required: true,
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: z.object({ data: PurchaseSchema }) } }, description: 'Purchase' },
    422: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Event/category not on sale, or quantity out of range' },
    ...errorResponses,
  },
});

const listRoute = createRoute({
  method: 'get',
  path: '/ticket-purchases',
  description: 'The caller\'s purchases, newest first (unfinished ones refreshed).',
  responses: {
    200: { content: { 'application/json': { schema: z.object({ data: z.array(PurchaseSchema) }) } }, description: 'Purchases' },
    ...errorResponses,
  },
});

const getRoute = createRoute({
  method: 'get',
  path: '/ticket-purchases/{reference}',
  description: 'Current state, confirmed with Upfan (throttled — respect `pollAfterMs`). Call after the payment-return link and while status = payment.',
  request: { params: ReferenceParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ data: PurchaseSchema }) } }, description: 'Purchase' },
    404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not the caller\'s purchase' },
    ...errorResponses,
  },
});

const resumeRoute = createRoute({
  method: 'post',
  path: '/ticket-purchases/{reference}/resume',
  description:
    'Call after the buyer-return link (or a "Pokračovat" tap): finishes buyer verification, reserves the tickets and creates the order. ' +
    'Returns `payment` + payment page, or still `buyer_verification` + the verification page when it is not finished.',
  request: { params: ReferenceParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ data: PurchaseSchema }) } }, description: 'Purchase' },
    404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not the caller\'s purchase' },
    ...errorResponses,
  },
});

const cancelRoute = createRoute({
  method: 'post',
  path: '/ticket-purchases/{reference}/cancel',
  description: 'Cancels an unfinished purchase and releases its hold. A purchase already waiting for payment cannot be cancelled (409).',
  request: { params: ReferenceParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: z.object({ data: PurchaseSchema }) } }, description: 'Purchase' },
    404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not the caller\'s purchase' },
    409: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Waiting for payment — cannot be cancelled' },
    ...errorResponses,
  },
});

const ticketsRoute_ = createRoute({
  method: 'get',
  path: '/me/tickets',
  description:
    'The caller\'s tickets, read live from Upfan. Refunded tickets disappear — drop locally cached tickets/QR codes that are no longer listed.',
  responses: {
    200: { content: { 'application/json': { schema: z.object({ data: z.array(TicketSchema) }) } }, description: 'Tickets' },
    ...errorResponses,
  },
});

// Per-user limits on our side (Upfan's own budget is enforced in lib/upfan.ts).
const writeLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
const readLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export function resetTicketLimiters(): void {
  writeLimiter.reset();
  readLimiter.reset();
}

const RATE_LIMIT_MESSAGE = 'Příliš mnoho požadavků, zkus to prosím za chvíli.';

/** Resolves the caller or answers 401. */
async function authenticate(c: Context): Promise<TicketingUser | Response> {
  try {
    return await getTicketingUser(extractJwt(c));
  } catch {
    return c.json({ error: 'Neplatný nebo expirovaný token' }, 401);
  }
}

function handleError(c: Context, err: unknown): Response {
  if (err instanceof TicketingUnavailableError) return c.json({ error: err.message, reason: 'unavailable' }, 503);
  if (err instanceof UpfanBusyError) {
    c.header('Retry-After', String(Math.max(1, Math.ceil(err.retryAfterMs / 1000))));
    return c.json({ error: 'Prodej vstupenek je teď vytížený, zkus to prosím za chvíli.', reason: 'busy', retryAfterMs: err.retryAfterMs }, 503);
  }
  if (err instanceof PurchaseNotFoundError) return c.json({ error: err.message }, 404);
  if (err instanceof PurchaseSelectionError) return c.json({ error: err.message, reason: err.reason }, 422);
  if (err instanceof PurchaseNotCancellableError) return c.json({ error: err.message, reason: 'awaiting_payment' }, 409);
  if (err instanceof UpfanApiError) {
    console.error(`[tickets] Upfan error ${err.status} ${err.code ?? ''}`);
    return c.json({ error: 'Prodej vstupenek teď nefunguje, zkus to prosím později.', reason: 'upfan_error' }, 503);
  }
  throw err;
}

export const ticketsRoute = new OpenAPIHono();

ticketsRoute.openapi(shopRoute, (async (c: Context) => {
  const user = await authenticate(c);
  if (user instanceof Response) return user;
  if (!readLimiter.check(String(user.id))) return c.json({ error: RATE_LIMIT_MESSAGE }, 429);
  const environment = environmentFor(user);
  if (!environment) return c.json({ data: { available: false, environment: null, events: [] } }, 200);
  try {
    const events = await getCatalog(environment);
    return c.json({ data: { available: true, environment, events } }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}) as never);

ticketsRoute.openapi(startRoute, (async (c: Context) => {
  const user = await authenticate(c);
  if (user instanceof Response) return user;
  if (!writeLimiter.check(String(user.id))) return c.json({ error: RATE_LIMIT_MESSAGE }, 429);
  const body = (c.req as unknown as { valid: (t: 'json') => { eventId: number; ticketCategoryId: number; quantity: number } }).valid('json');
  try {
    return c.json({ data: await startPurchase(user, body) }, 201);
  } catch (err) {
    return handleError(c, err);
  }
}) as never);

ticketsRoute.openapi(listRoute, (async (c: Context) => {
  const user = await authenticate(c);
  if (user instanceof Response) return user;
  if (!readLimiter.check(String(user.id))) return c.json({ error: RATE_LIMIT_MESSAGE }, 429);
  try {
    return c.json({ data: await listPurchases(user) }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}) as never);

ticketsRoute.openapi(getRoute, (async (c: Context) => {
  const user = await authenticate(c);
  if (user instanceof Response) return user;
  if (!readLimiter.check(String(user.id))) return c.json({ error: RATE_LIMIT_MESSAGE }, 429);
  try {
    return c.json({ data: await getPurchase(user, c.req.param('reference')!) }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}) as never);

ticketsRoute.openapi(resumeRoute, (async (c: Context) => {
  const user = await authenticate(c);
  if (user instanceof Response) return user;
  if (!writeLimiter.check(String(user.id))) return c.json({ error: RATE_LIMIT_MESSAGE }, 429);
  try {
    return c.json({ data: await resumePurchase(user, c.req.param('reference')!) }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}) as never);

ticketsRoute.openapi(cancelRoute, (async (c: Context) => {
  const user = await authenticate(c);
  if (user instanceof Response) return user;
  if (!writeLimiter.check(String(user.id))) return c.json({ error: RATE_LIMIT_MESSAGE }, 429);
  try {
    return c.json({ data: await cancelPurchase(user, c.req.param('reference')!) }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}) as never);

ticketsRoute.openapi(ticketsRoute_, (async (c: Context) => {
  const user = await authenticate(c);
  if (user instanceof Response) return user;
  if (!readLimiter.check(String(user.id))) return c.json({ error: RATE_LIMIT_MESSAGE }, 429);
  try {
    return c.json({ data: await listTickets(user) }, 200);
  } catch (err) {
    return handleError(c, err);
  }
}) as never);
