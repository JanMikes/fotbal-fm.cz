import { randomUUID } from 'node:crypto';
import { markdownToHtml } from './markdown.js';
import { strapiGet, strapiGetSingle, strapiPost, strapiPut } from './strapi.js';
import {
  UpfanApiError,
  upfanClient,
  type UpfanClient,
  type UpfanEnvironment,
  type UpfanEvent,
  type UpfanOnboarding,
  type UpfanBuyerToken,
  type UpfanTicket,
  type UpfanTicketCategory,
} from './upfan.js';

/**
 * Ticket sales in the mobile app through Upfan. Docs: docs/upfan-ticketing.md.
 *
 * Ownership: Upfan's machine token can read every sale of the integration, so nothing here
 * is ever looked up by an Upfan id coming from the app — always through the caller's own
 * `ticket-purchase` row (filtered by user), which also pins the environment for its whole
 * life (a tester flag flipped mid-purchase changes nothing).
 *
 * Flow per purchase: identify the buyer (guest or account mode) → when Upfan's panel is
 * needed the app opens it and returns via buyer-return → `resume` → reserve (hold 15 min)
 * + create the order in one step → app opens the payment page → payment-return → status
 * polling (`refresh`) until success / failure.
 */

export type PurchaseStatus = 'buyer_verification' | 'payment' | 'success' | 'failure' | 'expired' | 'cancelled';
export type BuyerMode = 'account' | 'guest';

const TERMINAL: ReadonlySet<PurchaseStatus> = new Set(['success', 'failure', 'expired', 'cancelled']);

export interface TicketingUser {
  id: number;
  documentId: string;
  email: string;
  firstname: string | null;
  lastname: string | null;
  ticketingTester: boolean;
}

export interface StrapiRawTicketPurchase {
  id: number;
  documentId: string;
  reference: string;
  environment: UpfanEnvironment;
  buyerMode: BuyerMode;
  status: PurchaseStatus;
  eventId: number;
  eventName: string | null;
  eventStartsAt: string | null;
  ticketCategoryId: number;
  ticketCategoryName: string | null;
  quantity: number;
  unitAmount: number | null;
  totalAmount: number | null;
  currency: string | null;
  onboardingId: string | null;
  onboardingUrl: string | null;
  onboardingExpiresAt: string | null;
  reservationId: string | null;
  reservationExpiresAt: string | null;
  orderId: string | null;
  paymentUrl: string | null;
  failureCode: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Errors surfaced to routes ---

/** Ticket sales are not available to this user (no credentials for their environment). */
export class TicketingUnavailableError extends Error {}
export class PurchaseNotFoundError extends Error {}
/** Invalid selection: unknown / not purchasable event or category, bad quantity. */
export class PurchaseSelectionError extends Error {
  constructor(readonly reason: string, message: string) {
    super(message);
  }
}
/** A paid-for order cannot be cancelled through the API (refunds go through the club). */
export class PurchaseNotCancellableError extends Error {}

// --- Configuration ---

export function buyerMode(env: NodeJS.ProcessEnv = process.env): BuyerMode {
  return env.UPFAN_BUYER_MODE?.trim() === 'account' ? 'account' : 'guest';
}

/**
 * Testers (admin-only `ticketingTester` on the user) buy in the sandbox, everyone else in
 * production. Fails closed: no credentials for that environment → null, never the other one.
 */
export function environmentFor(user: Pick<TicketingUser, 'ticketingTester'>): UpfanEnvironment | null {
  const environment: UpfanEnvironment = user.ticketingTester ? 'sandbox' : 'production';
  return upfanClient(environment) ? environment : null;
}

function clientFor(environment: UpfanEnvironment): UpfanClient {
  const client = upfanClient(environment);
  if (!client) throw new TicketingUnavailableError('Prodej vstupenek není dostupný.');
  return client;
}

// --- Caller ---

export async function getTicketingUser(jwt: string): Promise<TicketingUser> {
  const user = await strapiGetSingle<{
    id: number;
    documentId: string;
    email: string;
    firstname?: string | null;
    lastname?: string | null;
    ticketingTester?: boolean | null;
  }>('/users/me', jwt);
  return {
    id: user.id,
    documentId: user.documentId,
    email: user.email,
    firstname: user.firstname ?? null,
    lastname: user.lastname ?? null,
    ticketingTester: user.ticketingTester === true,
  };
}

// --- Catalog ---

export interface ShopCategory {
  id: number;
  name: string;
  description: string | null;
  purchasable: boolean;
  unavailableReason: string | null;
  unitAmount: number | null;
  currency: string;
  availableQuantity: number | null;
  maxQuantity: number;
}

export interface ShopEvent {
  id: number;
  name: string;
  /** HTML (Upfan sends Markdown; raw HTML in it is escaped) — same convention as our events. */
  description: string;
  descriptionText: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  currency: string;
  venue: { name: string; address: string } | null;
  purchasable: boolean;
  unavailableReason: string | null;
  categories: ShopCategory[];
}

const CATALOG_TTL_MS = 60_000;
const catalogCache = new Map<UpfanEnvironment, { at: number; events: ShopEvent[] }>();
const catalogInFlight = new Map<UpfanEnvironment, Promise<ShopEvent[]>>();

/** Upfan descriptions are Markdown; escape raw HTML first (Upfan: sanitize before rendering as HTML). */
export function descriptionHtml(markdown: string | null | undefined): string {
  if (!markdown) return '';
  return markdownToHtml(markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).trim();
}

/** HTML → plain text (fallback for clients that do not render HTML). */
export function plainText(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function mapCategory(category: UpfanTicketCategory, event: UpfanEvent, now = new Date()): ShopCategory {
  const current = category.priceTiers.find(
    (tier) =>
      (!tier.salesStartAt || new Date(tier.salesStartAt) <= now) && (!tier.salesEndAt || new Date(tier.salesEndAt) > now),
  );
  let unavailableReason: string | null = null;
  if (!category.checkoutSupported) unavailableReason = category.checkoutUnavailableReason ?? 'checkout_unsupported';
  else if (!current) unavailableReason = 'not_on_sale';
  else if (current.availableQuantity === 0) unavailableReason = 'sold_out';

  const available = current?.availableQuantity ?? null;
  return {
    id: category.id,
    name: category.name,
    description: category.description ? plainText(category.description) : null,
    purchasable: unavailableReason === null,
    unavailableReason,
    unitAmount: current?.unitAmount ?? null,
    currency: current?.currency ?? event.currency,
    availableQuantity: available,
    maxQuantity: Math.max(0, Math.min(10, available ?? 10)),
  };
}

export function mapEvent(event: UpfanEvent, categories: UpfanTicketCategory[], now = new Date()): ShopEvent {
  const mapped = categories.map((c) => mapCategory(c, event, now));
  const eventReason = event.checkout.generalAdmission ? null : event.checkout.unavailableReason ?? 'checkout_unsupported';
  const address = event.venue
    ? [event.venue.address.line, event.venue.address.locality].filter(Boolean).join(', ')
    : '';
  return {
    id: event.id,
    name: event.name,
    description: descriptionHtml(event.description),
    descriptionText: plainText(descriptionHtml(event.description)),
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    currency: event.currency,
    venue: event.venue ? { name: event.venue.name, address } : null,
    purchasable: eventReason === null && mapped.some((c) => c.purchasable),
    unavailableReason: eventReason ?? (mapped.some((c) => c.purchasable) ? null : 'no_purchasable_category'),
    categories: mapped,
  };
}

async function loadCatalog(client: UpfanClient): Promise<ShopEvent[]> {
  const events = await client.listEvents();
  const result: ShopEvent[] = [];
  for (const event of events) {
    // Categories only for events v1 can sell — saves budget on assigned-seating events.
    const categories = event.checkout.generalAdmission ? await client.listTicketCategories(event.id) : [];
    result.push(mapEvent(event, categories));
  }
  return result;
}

/** Events on sale for the caller's environment, cached for a minute (budget: 300 req/min). */
export async function getCatalog(environment: UpfanEnvironment): Promise<ShopEvent[]> {
  const cached = catalogCache.get(environment);
  if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.events;

  let pending = catalogInFlight.get(environment);
  if (!pending) {
    pending = loadCatalog(clientFor(environment))
      .then((events) => {
        catalogCache.set(environment, { at: Date.now(), events });
        return events;
      })
      .catch((err) => {
        // Upfan hiccup: serve the last catalog rather than an empty shop.
        if (cached) return cached.events;
        throw err;
      })
      .finally(() => catalogInFlight.delete(environment));
    catalogInFlight.set(environment, pending);
  }
  return pending;
}

// --- Purchase records (Strapi, service token) ---

async function findPurchase(user: TicketingUser, reference: string): Promise<StrapiRawTicketPurchase> {
  const result = await strapiGet<StrapiRawTicketPurchase>('/ticket-purchases', {
    filters: { reference: { $eq: reference }, user: { id: { $eq: user.id } } },
    pagination: { pageSize: 1 },
  });
  const purchase = result?.data?.[0];
  if (!purchase) throw new PurchaseNotFoundError('Nákup nebyl nalezen.');
  return purchase;
}

async function listUserPurchases(user: TicketingUser, filters: Record<string, unknown> = {}): Promise<StrapiRawTicketPurchase[]> {
  const result = await strapiGet<StrapiRawTicketPurchase>('/ticket-purchases', {
    filters: { user: { id: { $eq: user.id } }, ...filters },
    sort: 'createdAt:desc',
    pagination: { pageSize: 50 },
  });
  return result?.data ?? [];
}

async function updatePurchase(
  purchase: StrapiRawTicketPurchase,
  patch: Partial<Omit<StrapiRawTicketPurchase, 'id' | 'documentId' | 'createdAt' | 'updatedAt'>>,
): Promise<StrapiRawTicketPurchase> {
  await strapiPut(`/ticket-purchases/${purchase.documentId}`, { data: patch });
  return { ...purchase, ...patch };
}

// --- Purchase view (what the app gets) ---

export interface NextAction {
  type: 'open_url';
  url: string;
}

export interface PurchaseView {
  reference: string;
  status: PurchaseStatus;
  environment: UpfanEnvironment;
  event: { id: number; name: string | null; startsAt: string | null };
  category: { id: number; name: string | null };
  quantity: number;
  unitAmount: number | null;
  totalAmount: number | null;
  currency: string | null;
  /** Deadline of the current step: Upfan panel (10 min) or the ticket hold (15 min). */
  expiresAt: string | null;
  failureCode: string | null;
  /** The page the app should open (Upfan panel or payment page); null = nothing to open. */
  nextAction: NextAction | null;
  /** While `payment`: how long to wait before asking again. */
  pollAfterMs: number | null;
  createdAt: string;
}

export function toPurchaseView(p: StrapiRawTicketPurchase, now = Date.now()): PurchaseView {
  let nextAction: NextAction | null = null;
  let expiresAt: string | null = null;
  if (p.status === 'buyer_verification') {
    expiresAt = p.onboardingExpiresAt;
    if (p.onboardingUrl && (!p.onboardingExpiresAt || new Date(p.onboardingExpiresAt).getTime() > now)) {
      nextAction = { type: 'open_url', url: p.onboardingUrl };
    }
  } else if (p.status === 'payment') {
    expiresAt = p.reservationExpiresAt;
    if (p.paymentUrl) nextAction = { type: 'open_url', url: p.paymentUrl };
  }
  return {
    reference: p.reference,
    status: p.status,
    environment: p.environment,
    event: { id: p.eventId, name: p.eventName, startsAt: p.eventStartsAt },
    category: { id: p.ticketCategoryId, name: p.ticketCategoryName },
    quantity: p.quantity,
    unitAmount: p.unitAmount,
    totalAmount: p.totalAmount,
    currency: p.currency,
    expiresAt,
    failureCode: p.failureCode,
    nextAction,
    pollAfterMs: p.status === 'payment' ? pollInterval(p, now) : null,
    createdAt: p.createdAt,
  };
}

// --- Per-purchase serialization (a return link and a foreground check may race) ---

const locks = new Map<string, Promise<unknown>>();

async function withLock<T>(reference: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(reference) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  locks.set(reference, tail);
  try {
    return await run;
  } finally {
    if (locks.get(reference) === tail) locks.delete(reference);
  }
}

// --- Status polling throttle (Upfan: start ~2 s, back off; budget shared by everyone) ---

const lastOrderCheck = new Map<string, number>();

/** 2 s for the first minute after the order, 5 s up to 5 min, then 15 s. */
export function pollInterval(p: Pick<StrapiRawTicketPurchase, 'reservationExpiresAt'>, now = Date.now()): number {
  const orderCreated = p.reservationExpiresAt ? new Date(p.reservationExpiresAt).getTime() - 15 * 60_000 : now;
  const age = now - orderCreated;
  if (age < 60_000) return 2_000;
  if (age < 5 * 60_000) return 5_000;
  return 15_000;
}

// --- Flow ---

function isBuyerToken(result: UpfanBuyerToken | UpfanOnboarding): result is UpfanBuyerToken {
  return result.status === 'authenticated';
}

function onboardingPatch(onboarding: UpfanOnboarding) {
  return {
    onboardingUrl: onboarding.onboardingUrl,
    onboardingId: onboarding.onboardingId ?? null,
    onboardingExpiresAt: new Date(Date.now() + onboarding.expiresIn * 1000).toISOString(),
  };
}

/** Reserve (idempotent per purchase reference) and create the order; leaves the purchase in `payment` or `failure`. */
async function checkout(client: UpfanClient, purchase: StrapiRawTicketPurchase, buyerToken: string): Promise<StrapiRawTicketPurchase> {
  let reservationId = purchase.reservationId;
  if (!reservationId) {
    let reservation;
    try {
      reservation = await client.createReservation(purchase.eventId, purchase.ticketCategoryId, purchase.quantity, purchase.reference);
    } catch (err) {
      if (err instanceof UpfanApiError && (err.status === 422 || err.status === 409 || err.status === 404)) {
        const failureCode =
          err.code === 'E_PARTNER_INVENTORY_LIMIT' ? 'inventory_limit' : err.status === 404 ? 'event_unavailable' : 'sold_out';
        return updatePurchase(purchase, { status: 'failure', failureCode, completedAt: new Date().toISOString() });
      }
      throw err;
    }
    if (reservation.status !== 'active') {
      return updatePurchase(purchase, { status: 'expired', failureCode: 'reservation_expired', completedAt: new Date().toISOString() });
    }
    reservationId = reservation.id;
    purchase = await updatePurchase(purchase, {
      reservationId,
      reservationExpiresAt: reservation.expiresAt,
      unitAmount: reservation.price?.unitAmount ?? purchase.unitAmount,
      totalAmount: reservation.price?.totalAmount ?? purchase.totalAmount,
    });
  }

  try {
    const { order, paymentUrl } = await client.createOrder(buyerToken, reservationId, purchase.reference);
    return updatePurchase(purchase, {
      status: 'payment',
      orderId: order.id,
      paymentUrl,
      totalAmount: order.totalAmount ?? purchase.totalAmount,
      currency: order.currency ?? purchase.currency,
      onboardingUrl: null,
      onboardingId: null,
    });
  } catch (err) {
    if (err instanceof UpfanApiError && err.status === 404) {
      // The hold expired, was cancelled or consumed before the order — start over.
      return updatePurchase(purchase, { status: 'expired', failureCode: 'reservation_expired', completedAt: new Date().toISOString() });
    }
    if (err instanceof UpfanApiError && err.status >= 400 && err.status < 500 && err.status !== 401) {
      await client.cancelReservation(reservationId).catch(() => undefined);
      return updatePurchase(purchase, { status: 'failure', failureCode: 'order_rejected', completedAt: new Date().toISOString() });
    }
    throw err; // busy / network: the purchase keeps its hold; `resume` retries with the same reference
  }
}

/** Identifies the buyer; on a buyer token continues straight to checkout. */
async function identifyAndContinue(client: UpfanClient, user: TicketingUser, purchase: StrapiRawTicketPurchase): Promise<StrapiRawTicketPurchase> {
  if (purchase.buyerMode === 'account') {
    const result = await client.createBuyerSession({
      externalSubject: user.documentId,
      email: user.email,
      firstName: user.firstname ?? undefined,
      lastName: user.lastname ?? undefined,
    });
    if (isBuyerToken(result)) return checkout(client, purchase, result.accessToken);
    return updatePurchase(purchase, onboardingPatch(result));
  }

  if (!purchase.onboardingId) {
    const onboarding = await client.createGuestBuyerSession();
    return updatePurchase(purchase, onboardingPatch(onboarding));
  }

  let token: UpfanBuyerToken;
  try {
    token = await client.redeemGuestBuyerSession(purchase.onboardingId);
  } catch (err) {
    if (err instanceof UpfanApiError && err.status === 409) return purchase; // panel not finished yet — reopen it
    if (err instanceof UpfanApiError && (err.status === 410 || err.status === 404)) {
      return updatePurchase(purchase, { status: 'expired', failureCode: 'onboarding_expired', completedAt: new Date().toISOString() });
    }
    throw err;
  }
  return checkout(client, purchase, token.accessToken);
}

export interface PurchaseSelection {
  eventId: number;
  ticketCategoryId: number;
  quantity: number;
}

export async function startPurchase(user: TicketingUser, selection: PurchaseSelection): Promise<PurchaseView> {
  const environment = environmentFor(user);
  if (!environment) throw new TicketingUnavailableError('Prodej vstupenek zatím není dostupný.');
  const client = clientFor(environment);

  const event = (await getCatalog(environment)).find((e) => e.id === selection.eventId);
  if (!event) throw new PurchaseSelectionError('event_not_found', 'Akce není v prodeji.');
  const category = event.categories.find((c) => c.id === selection.ticketCategoryId);
  if (!category) throw new PurchaseSelectionError('category_not_found', 'Kategorie vstupenek neexistuje.');
  if (!event.purchasable || !category.purchasable) {
    throw new PurchaseSelectionError(category.unavailableReason ?? event.unavailableReason ?? 'not_purchasable', 'Tyto vstupenky teď nelze koupit.');
  }
  if (selection.quantity < 1 || selection.quantity > category.maxQuantity) {
    throw new PurchaseSelectionError('quantity', `Počet vstupenek musí být 1–${category.maxQuantity}.`);
  }

  // A new purchase supersedes the caller's unfinished verification ones (releases any hold).
  for (const stale of await listUserPurchases(user, { status: { $eq: 'buyer_verification' } })) {
    await cancelPurchaseRecord(stale).catch(() => undefined);
  }

  const created = await strapiPost<{ data: StrapiRawTicketPurchase }>('/ticket-purchases', {
    data: {
      reference: `fkfm-${randomUUID()}`,
      user: user.id,
      environment,
      buyerMode: buyerMode(),
      status: 'buyer_verification',
      eventId: event.id,
      eventName: event.name,
      eventStartsAt: event.startsAt,
      ticketCategoryId: category.id,
      ticketCategoryName: category.name,
      quantity: selection.quantity,
      unitAmount: category.unitAmount,
      totalAmount: category.unitAmount === null ? null : category.unitAmount * selection.quantity,
      currency: category.currency,
    },
  });
  const purchase = created.data;

  return withLock(purchase.reference, async () => toPurchaseView(await identifyAndContinue(client, user, purchase)));
}

/** After the buyer-return link (or a "continue" tap): finish verification, then reserve + order. */
export async function resumePurchase(user: TicketingUser, reference: string): Promise<PurchaseView> {
  return withLock(reference, async () => {
    const purchase = await findPurchase(user, reference);
    if (purchase.status === 'buyer_verification') {
      const client = clientFor(purchase.environment);
      if (purchase.onboardingExpiresAt && new Date(purchase.onboardingExpiresAt).getTime() < Date.now() && !purchase.reservationId) {
        // Panel window over. Guest handles stay redeemable 30 min after completion, so try once.
        if (purchase.buyerMode === 'guest' && purchase.onboardingId) {
          return toPurchaseView(await identifyAndContinue(client, user, purchase));
        }
        return toPurchaseView(
          await updatePurchase(purchase, { status: 'expired', failureCode: 'onboarding_expired', completedAt: new Date().toISOString() }),
        );
      }
      return toPurchaseView(await identifyAndContinue(client, user, purchase));
    }
    return toPurchaseView(await refreshRecord(purchase));
  });
}

/** Re-reads the Upfan order (throttled per purchase) and settles success / failure. */
async function refreshRecord(purchase: StrapiRawTicketPurchase): Promise<StrapiRawTicketPurchase> {
  if (purchase.status === 'buyer_verification') {
    const expired =
      purchase.onboardingExpiresAt &&
      new Date(purchase.onboardingExpiresAt).getTime() + 30 * 60_000 < Date.now() &&
      !purchase.reservationId;
    return expired
      ? updatePurchase(purchase, { status: 'expired', failureCode: 'onboarding_expired', completedAt: new Date().toISOString() })
      : purchase;
  }
  if (purchase.status !== 'payment' || !purchase.orderId) return purchase;

  const now = Date.now();
  const last = lastOrderCheck.get(purchase.reference);
  if (last !== undefined && now - last < pollInterval(purchase, now)) return purchase;
  lastOrderCheck.set(purchase.reference, now);

  const order = await clientFor(purchase.environment).getOrder(purchase.orderId);
  if (order.status === 'success') {
    lastOrderCheck.delete(purchase.reference);
    return updatePurchase(purchase, {
      status: 'success',
      totalAmount: order.totalAmount ?? purchase.totalAmount,
      currency: order.currency ?? purchase.currency,
      paymentUrl: null,
      completedAt: new Date().toISOString(),
    });
  }
  if (order.status === 'failure') {
    lastOrderCheck.delete(purchase.reference);
    return updatePurchase(purchase, { status: 'failure', failureCode: 'payment_failed', paymentUrl: null, completedAt: new Date().toISOString() });
  }
  // pending or an unknown status (= incomplete): keep polling; pick up a late payment URL.
  if (order.paymentUrl && order.paymentUrl !== purchase.paymentUrl) {
    return updatePurchase(purchase, { paymentUrl: order.paymentUrl });
  }
  return purchase;
}

export async function getPurchase(user: TicketingUser, reference: string): Promise<PurchaseView> {
  return withLock(reference, async () => toPurchaseView(await refreshRecord(await findPurchase(user, reference))));
}

/** The caller's purchases, newest first; unfinished ones are refreshed (throttled). */
export async function listPurchases(user: TicketingUser): Promise<PurchaseView[]> {
  const purchases = await listUserPurchases(user);
  const views: PurchaseView[] = [];
  for (const purchase of purchases) {
    const current = TERMINAL.has(purchase.status)
      ? purchase
      : await withLock(purchase.reference, () => refreshRecord(purchase)).catch(() => purchase);
    views.push(toPurchaseView(current));
  }
  return views;
}

async function cancelPurchaseRecord(purchase: StrapiRawTicketPurchase): Promise<StrapiRawTicketPurchase> {
  if (TERMINAL.has(purchase.status)) return purchase;
  if (purchase.status === 'payment' && purchase.orderId) {
    throw new PurchaseNotCancellableError('Objednávka už čeká na platbu a nejde zrušit. Nezaplacená objednávka sama vyprší.');
  }
  if (purchase.reservationId) {
    try {
      await clientFor(purchase.environment).cancelReservation(purchase.reservationId);
    } catch (err) {
      if (!(err instanceof UpfanApiError && (err.status === 404 || err.status === 409))) throw err;
    }
  }
  return updatePurchase(purchase, { status: 'cancelled', onboardingUrl: null, onboardingId: null, completedAt: new Date().toISOString() });
}

export async function cancelPurchase(user: TicketingUser, reference: string): Promise<PurchaseView> {
  return withLock(reference, async () => toPurchaseView(await cancelPurchaseRecord(await findPurchase(user, reference))));
}

// --- Tickets ---

export interface TicketView {
  id: number;
  purchaseReference: string;
  environment: UpfanEnvironment;
  status: string;
  holderName: string | null;
  event: { id: number; name: string; startsAt: string; endsAt: string };
  category: { id: number; name: string };
  /** Static admission payload — render verbatim as a QR code (keep it a string). Null = not usable. */
  qrCode: string | null;
}

const TICKETS_TTL_MS = 30_000;
const ticketCache = new Map<string, { at: number; tickets: UpfanTicket[] }>();

async function orderTickets(purchase: StrapiRawTicketPurchase): Promise<UpfanTicket[]> {
  const key = `${purchase.environment}:${purchase.orderId}`;
  const cached = ticketCache.get(key);
  if (cached && Date.now() - cached.at < TICKETS_TTL_MS) return cached.tickets;
  const tickets = await clientFor(purchase.environment).listOrderTickets(purchase.orderId!);
  ticketCache.set(key, { at: Date.now(), tickets });
  return tickets;
}

/**
 * Tickets of the caller's successful purchases, read live from Upfan (refunded tickets
 * disappear there — the app must drop what is no longer listed).
 */
export async function listTickets(user: TicketingUser): Promise<TicketView[]> {
  // Settle purchases still waiting for payment first (throttled): no webhooks, so a fan who
  // paid and lost the purchase in the app would otherwise never see the tickets.
  for (const pending of await listUserPurchases(user, { status: { $eq: 'payment' } })) {
    await withLock(pending.reference, async () => refreshRecord(await findPurchase(user, pending.reference))).catch(() => undefined);
  }
  const purchases = await listUserPurchases(user, { status: { $eq: 'success' } });
  const result: TicketView[] = [];
  for (const purchase of purchases) {
    if (!purchase.orderId) continue;
    const tickets = await orderTickets(purchase);
    for (const ticket of tickets) {
      result.push({
        id: ticket.id,
        purchaseReference: purchase.reference,
        environment: purchase.environment,
        status: ticket.status,
        holderName: ticket.holderName,
        event: ticket.event,
        category: ticket.category,
        qrCode: ticket.qrCode?.type === 'static' ? ticket.qrCode.value : null,
      });
    }
  }
  return result.sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
}

/** Tests: clear in-memory caches and throttles. */
export function resetTicketingState(): void {
  catalogCache.clear();
  catalogInFlight.clear();
  lastOrderCheck.clear();
  ticketCache.clear();
  locks.clear();
}
