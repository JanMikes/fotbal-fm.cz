import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/strapi.js', () => ({
  strapiGet: vi.fn(),
  strapiGetWithPagination: vi.fn(),
  strapiGetSingleEntry: vi.fn(),
  strapiPost: vi.fn(),
  strapiGetSingle: vi.fn(),
  strapiPut: vi.fn(),
  strapiDelete: vi.fn(),
}));

const { strapiGet, strapiGetSingle, strapiPost, strapiPut } = await import('../../lib/strapi.js');
const { app } = await import('../../app.js');
const { resetUpfanClients } = await import('../../lib/upfan.js');
const { resetTicketingState } = await import('../../lib/ticketing.js');
const { resetTicketLimiters } = await import('../../routes/tickets.js');

// --- Users ---

const tester = { id: 40, documentId: 'user-doc-40', username: 'jan', email: 'jan@test.cz', firstname: 'Jan', lastname: 'Test', ticketingTester: true };
const fan = { id: 41, documentId: 'user-doc-41', username: 'fan', email: 'fan@test.cz', firstname: null, lastname: null, ticketingTester: false };
const users: Record<string, typeof tester | typeof fan> = { 'jwt-40': tester, 'jwt-41': fan };
const auth = (jwt = 'jwt-40') => ({ Authorization: `Bearer ${jwt}` });

// --- In-memory Strapi ticket-purchases ---

type Row = Record<string, unknown> & { id: number; documentId: string; reference: string; user: number; status: string };
let rows: Row[] = [];

function matches(row: Row, filters: Record<string, unknown> = {}): boolean {
  for (const [key, cond] of Object.entries(filters)) {
    if (key === 'user') {
      if (row.user !== ((cond as { id: { $eq: number } }).id.$eq)) return false;
    } else if (row[key] !== (cond as { $eq: unknown }).$eq) return false;
  }
  return true;
}

function mockStrapi() {
  vi.mocked(strapiGetSingle).mockImplementation(async (path: string, jwt?: string) => {
    if (path === '/users/me' && jwt && users[jwt]) return users[jwt] as never;
    throw new Error('unauthorized');
  });
  vi.mocked(strapiGet).mockImplementation((async (path: string, options?: { filters?: Record<string, unknown> }) => {
    if (path !== '/ticket-purchases') throw new Error(`unexpected ${path}`);
    const data = rows.filter((r) => matches(r, options?.filters)).sort((a, b) => b.id - a.id);
    return { data: data.map((r) => ({ ...r })), meta: {} };
  }) as never);
  vi.mocked(strapiPost).mockImplementation((async (path: string, body: { data: Record<string, unknown> }) => {
    if (path !== '/ticket-purchases') throw new Error(`unexpected ${path}`);
    const id = rows.length + 1;
    const row = {
      id,
      documentId: `tp-${id}`,
      onboardingId: null,
      onboardingUrl: null,
      onboardingExpiresAt: null,
      reservationId: null,
      reservationExpiresAt: null,
      orderId: null,
      paymentUrl: null,
      failureCode: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...body.data,
    } as unknown as Row;
    rows.push(row);
    return { data: { ...row } } as never;
  }) as never);
  vi.mocked(strapiPut).mockImplementation((async (path: string, body: { data: Record<string, unknown> }) => {
    const documentId = path.split('/').pop();
    const row = rows.find((r) => r.documentId === documentId);
    if (!row) throw new Error(`no row ${path}`);
    Object.assign(row, body.data);
    return { data: { ...row } } as never;
  }) as never);
}

// --- Fake Upfan sandbox ---

const API = 'https://api.upfan.dev/api/partner/v1';
const TOKEN_URL = 'https://upfan-hydra-825592685518.europe-west6.run.app/oauth2/token';

const event = {
  id: 231,
  name: 'Permanentky FK Frýdek-Místek 2026/2027',
  slug: null,
  description: '### Permanentka\n\nSezóna **2026/2027** <script>alert(1)</script>',
  startsAt: '2026-05-31T22:00:00.000+00:00',
  endsAt: '2027-06-30T21:59:59.000+00:00',
  timezone: 'Europe/Prague',
  currency: 'CZK',
  venue: { id: 7, name: 'Stadion Stovky', timezone: 'Europe/Prague', address: { line: 'Horymírova 3000', locality: 'Frýdek-Místek', region: null, country: 'CZ' } },
  checkout: { generalAdmission: true, assignedSeating: false, unavailableReason: null },
};
const categories = [
  { id: 1838, name: 'Permanentka - Základní', description: null, type: 'general_admission', checkoutSupported: true, checkoutUnavailableReason: null, priceTiers: [{ id: 1, name: 'Základní', unitAmount: 150000, currency: 'CZK', availableQuantity: null, salesStartAt: null, salesEndAt: null }] },
  { id: 1840, name: 'VIP', description: null, type: 'assigned_seating', checkoutSupported: false, checkoutUnavailableReason: 'assigned_seating', priceTiers: [] },
];

interface UpfanCall {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

let upfanCalls: UpfanCall[] = [];
let upfan: {
  redeemStatus: number;
  orderStatus: string;
  reservationStatus: number;
  buyerSession: 201 | 202;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function fakeUpfan(url: string, init: RequestInit = {}): Response {
  if (url === TOKEN_URL) return json(200, { access_token: 'machine', expires_in: 300, token_type: 'bearer' });
  const method = init.method ?? 'GET';
  const path = url.replace(API, '');
  const headers = (init.headers ?? {}) as Record<string, string>;
  upfanCalls.push({ method, path, headers, body: init.body ? JSON.parse(init.body as string) : undefined });

  if (method === 'GET' && path.startsWith('/events?')) return json(200, { data: [event], meta: { currentPage: 1, lastPage: 1 } });
  if (method === 'GET' && path === '/events/231/ticket-categories') return json(200, { data: categories });
  if (method === 'POST' && path === '/guest-buyer-sessions') {
    return json(202, { data: { status: 'onboarding_required', mode: 'guest_checkout', onboardingUrl: 'https://upfan.dev/cs/propojeni-uctu?token=secret', onboardingId: 'guest:1111', expiresIn: 600 } });
  }
  if (method === 'POST' && path === '/guest-buyer-sessions/guest%3A1111/redemptions') {
    if (upfan.redeemStatus === 201) return json(201, { data: { status: 'authenticated', accessToken: 'buyer-token', tokenType: 'bearer', expiresIn: 300, scope: '' } });
    return json(upfan.redeemStatus, { errors: [{ code: upfan.redeemStatus === 409 ? 'E_PARTNER_GUEST_ONBOARDING_INCOMPLETE' : 'E_PARTNER_BUYER_ONBOARDING_EXPIRED', message: 'x' }] });
  }
  if (method === 'POST' && path === '/buyer-sessions') {
    if (upfan.buyerSession === 201) return json(201, { data: { status: 'authenticated', accessToken: 'buyer-token', tokenType: 'bearer', expiresIn: 300, scope: '' } });
    return json(202, { data: { status: 'onboarding_required', mode: 'complete_profile', onboardingUrl: 'https://upfan.dev/cs/propojeni-uctu?token=acc', expiresIn: 600 } });
  }
  if (method === 'POST' && path === '/events/231/ticket-reservations') {
    if (upfan.reservationStatus !== 201) return json(upfan.reservationStatus, { errors: [{ code: 'E_UNPROCESSABLE_ENTITY', message: 'x' }] });
    return json(201, { data: { id: 'res-1', eventId: 231, ticketCategoryId: 1838, quantity: 2, status: 'active', expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), price: { unitAmount: 150000, totalAmount: 300000 }, createdAt: new Date().toISOString() } });
  }
  if (method === 'DELETE' && path === '/ticket-reservations/res-1') return json(200, { data: { id: 'res-1', status: 'cancelled' } });
  if (method === 'POST' && path === '/orders') {
    return json(201, { data: { id: 'order-1', externalReference: 'x', status: 'pending', eventId: 231, totalAmount: 300000, currency: 'CZK', paymentUrl: 'https://pay.test/1', createdAt: '', updatedAt: '' }, payment: { token: 'p', url: 'https://pay.test/1' } });
  }
  if (method === 'GET' && path === '/orders/order-1') {
    return json(200, { data: { id: 'order-1', externalReference: 'x', status: upfan.orderStatus, eventId: 231, totalAmount: 300000, currency: 'CZK', paymentUrl: 'https://pay.test/1', createdAt: '', updatedAt: '' } });
  }
  if (method === 'GET' && path === '/orders/order-1/tickets') {
    return json(200, { data: [
      { id: 501, orderId: 'order-1', status: 'ready', holderName: 'Jan Test', event: { id: 231, name: event.name, startsAt: event.startsAt, endsAt: event.endsAt }, category: { id: 1838, name: 'Permanentka - Základní' }, seat: null, qrCode: { type: 'static', value: '0250100000000000000000001' }, documentPath: '/api/partner/v1/tickets/501/document' },
      { id: 502, orderId: 'order-1', status: 'pending_payment', holderName: 'Jan Test', event: { id: 231, name: event.name, startsAt: event.startsAt, endsAt: event.endsAt }, category: { id: 1838, name: 'Permanentka - Základní' }, seat: null, qrCode: null, documentPath: '/api/partner/v1/tickets/502/document' },
    ] });
  }
  throw new Error(`unexpected Upfan call ${method} ${path}`);
}

const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => fakeUpfan(String(url), init));

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetUpfanClients();
}

async function post(path: string, body?: unknown, jwt?: string) {
  return app.request(path, {
    method: 'POST',
    headers: { ...auth(jwt), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function get(path: string, jwt?: string) {
  return app.request(path, { headers: auth(jwt) });
}

/** Starts a guest purchase of 2 basic season tickets as the tester; returns its reference. */
async function startGuestPurchase(): Promise<string> {
  const res = await post('/api/v1/ticket-purchases', { eventId: 231, ticketCategoryId: 1838, quantity: 2 });
  expect(res.status).toBe(201);
  return (await res.json()).data.reference;
}

describe('Ticket routes', () => {
  beforeEach(() => {
    rows = [];
    upfanCalls = [];
    upfan = { redeemStatus: 201, orderStatus: 'pending', reservationStatus: 201, buyerSession: 201 };
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    setEnv({
      UPFAN_SANDBOX_CLIENT_ID: 'sandbox-id',
      UPFAN_SANDBOX_CLIENT_SECRET: 'sandbox-secret',
      UPFAN_PRODUCTION_CLIENT_ID: undefined,
      UPFAN_PRODUCTION_CLIENT_SECRET: undefined,
      UPFAN_BUYER_MODE: undefined,
    });
    resetTicketingState();
    resetTicketLimiters();
    mockStrapi();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('GET /tickets/shop', () => {
    it('401 without a JWT', async () => {
      const res = await app.request('/api/v1/tickets/shop');
      expect(res.status).toBe(401);
    });

    it('a tester sees the sandbox catalog, mapped for the app', async () => {
      const res = await get('/api/v1/tickets/shop');
      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.available).toBe(true);
      expect(data.environment).toBe('sandbox');
      expect(data.events).toHaveLength(1);
      const shopEvent = data.events[0];
      expect(shopEvent.description).toContain('<h3>Permanentka</h3>');
      expect(shopEvent.description).toContain('<strong>2026/2027</strong>');
      expect(shopEvent.description).not.toContain('<script>');
      expect(shopEvent.description).toContain('&lt;script&gt;');
      expect(shopEvent.descriptionText).toContain('Sezóna 2026/2027');
      expect(shopEvent.venue).toEqual({ name: 'Stadion Stovky', address: 'Horymírova 3000, Frýdek-Místek' });
      expect(shopEvent.purchasable).toBe(true);
      expect(shopEvent.categories[0]).toMatchObject({ id: 1838, purchasable: true, unitAmount: 150000, currency: 'CZK', maxQuantity: 10 });
      expect(shopEvent.categories[1]).toMatchObject({ id: 1840, purchasable: false, unavailableReason: 'assigned_seating' });
    });

    it('fails closed: a regular fan never falls back to the sandbox', async () => {
      const res = await get('/api/v1/tickets/shop', 'jwt-41');
      expect(res.status).toBe(200);
      expect((await res.json()).data).toEqual({ available: false, environment: null, events: [] });
      expect(upfanCalls).toHaveLength(0);
    });

    it('caches the catalog (Upfan budget)', async () => {
      await get('/api/v1/tickets/shop');
      await get('/api/v1/tickets/shop');
      expect(upfanCalls.filter((c) => c.path.startsWith('/events'))).toHaveLength(2); // 1× list + 1× categories
    });
  });

  describe('guest buyer flow (default)', () => {
    it('start → verification page; resume before the panel is done → same page again', async () => {
      const res = await post('/api/v1/ticket-purchases', { eventId: 231, ticketCategoryId: 1838, quantity: 2 });
      expect(res.status).toBe(201);
      const { data } = await res.json();
      expect(data).toMatchObject({
        status: 'buyer_verification',
        environment: 'sandbox',
        quantity: 2,
        totalAmount: 300000,
        nextAction: { type: 'open_url', url: 'https://upfan.dev/cs/propojeni-uctu?token=secret' },
      });
      const guest = upfanCalls.find((c) => c.path === '/guest-buyer-sessions')!;
      expect(guest.body).toEqual({ connectionReturnUrl: 'https://fotbal-fm.cz/upfan/test/buyer-return', locale: 'cs' });
      // No hold before the buyer is verified.
      expect(upfanCalls.some((c) => c.path.includes('ticket-reservations'))).toBe(false);

      upfan.redeemStatus = 409;
      const resumed = await post(`/api/v1/ticket-purchases/${data.reference}/resume`);
      expect(resumed.status).toBe(200);
      expect((await resumed.json()).data).toMatchObject({ status: 'buyer_verification', nextAction: { url: 'https://upfan.dev/cs/propojeni-uctu?token=secret' } });
    });

    it('resume after verification reserves (idempotency key = our reference) and creates the order', async () => {
      const reference = await startGuestPurchase();
      const res = await post(`/api/v1/ticket-purchases/${reference}/resume`);
      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data).toMatchObject({ status: 'payment', nextAction: { type: 'open_url', url: 'https://pay.test/1' }, pollAfterMs: 2000 });

      const reservation = upfanCalls.find((c) => c.path === '/events/231/ticket-reservations')!;
      expect(reservation.headers['Idempotency-Key']).toBe(reference);
      expect(reservation.body).toEqual({ ticketCategoryId: 1838, quantity: 2 });
      const order = upfanCalls.find((c) => c.path === '/orders')!;
      expect(order.headers.Authorization).toBe('Bearer buyer-token');
      expect(order.body).toEqual({ reservationId: 'res-1', redirectUrl: 'https://fotbal-fm.cz/upfan/test/payment-return', externalReference: reference });
    });

    it('status: pending → success after payment; the order is polled at most every 2 s', async () => {
      const reference = await startGuestPurchase();
      await post(`/api/v1/ticket-purchases/${reference}/resume`);

      const first = await get(`/api/v1/ticket-purchases/${reference}`);
      expect((await first.json()).data.status).toBe('payment');
      upfan.orderStatus = 'success';
      const throttled = await get(`/api/v1/ticket-purchases/${reference}`);
      expect((await throttled.json()).data.status).toBe('payment'); // too soon — Upfan not asked again
      expect(upfanCalls.filter((c) => c.path === '/orders/order-1')).toHaveLength(1);

      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(Date.now() + 2_500);
      const settled = await get(`/api/v1/ticket-purchases/${reference}`);
      vi.useRealTimers();
      const { data } = await settled.json();
      expect(data).toMatchObject({ status: 'success', nextAction: null, pollAfterMs: null });
    });

    it('a sold-out category ends the purchase as failure/sold_out', async () => {
      const reference = await startGuestPurchase();
      upfan.reservationStatus = 422;
      const res = await post(`/api/v1/ticket-purchases/${reference}/resume`);
      expect((await res.json()).data).toMatchObject({ status: 'failure', failureCode: 'sold_out', nextAction: null });
    });

    it('an expired guest panel ends the purchase as expired', async () => {
      const reference = await startGuestPurchase();
      upfan.redeemStatus = 410;
      const res = await post(`/api/v1/ticket-purchases/${reference}/resume`);
      expect((await res.json()).data).toMatchObject({ status: 'expired', failureCode: 'onboarding_expired' });
    });
  });

  describe('account buyer flow (UPFAN_BUYER_MODE=account)', () => {
    beforeEach(() => setEnv({ UPFAN_BUYER_MODE: 'account' }));

    it('a linked buyer goes straight to payment, identified by the immutable documentId', async () => {
      const res = await post('/api/v1/ticket-purchases', { eventId: 231, ticketCategoryId: 1838, quantity: 1 });
      const { data } = await res.json();
      expect(data).toMatchObject({ status: 'payment', nextAction: { url: 'https://pay.test/1' } });
      const session = upfanCalls.find((c) => c.path === '/buyer-sessions')!;
      expect(session.body).toMatchObject({
        externalSubject: 'user-doc-40',
        email: 'jan@test.cz',
        emailVerified: true,
        firstName: 'Jan',
        lastName: 'Test',
        connectionReturnUrl: 'https://fotbal-fm.cz/upfan/test/buyer-return',
        locale: 'cs',
      });
    });

    it('an unlinked buyer gets the Upfan panel first', async () => {
      upfan.buyerSession = 202;
      const res = await post('/api/v1/ticket-purchases', { eventId: 231, ticketCategoryId: 1838, quantity: 1 });
      expect((await res.json()).data).toMatchObject({ status: 'buyer_verification', nextAction: { url: 'https://upfan.dev/cs/propojeni-uctu?token=acc' } });
    });
  });

  describe('validation and ownership', () => {
    it('422 for a category that cannot be bought', async () => {
      const res = await post('/api/v1/ticket-purchases', { eventId: 231, ticketCategoryId: 1840, quantity: 1 });
      expect(res.status).toBe(422);
      expect((await res.json()).reason).toBe('assigned_seating');
    });

    it('422 for an unknown event', async () => {
      const res = await post('/api/v1/ticket-purchases', { eventId: 999, ticketCategoryId: 1838, quantity: 1 });
      expect(res.status).toBe(422);
    });

    it('503 when the account has no environment', async () => {
      const res = await post('/api/v1/ticket-purchases', { eventId: 231, ticketCategoryId: 1838, quantity: 1 }, 'jwt-41');
      expect(res.status).toBe(503);
      expect((await res.json()).reason).toBe('unavailable');
    });

    it("another user's purchase is a 404, never proxied", async () => {
      const reference = await startGuestPurchase();
      const res = await get(`/api/v1/ticket-purchases/${reference}`, 'jwt-41');
      expect(res.status).toBe(404);
    });

    it('the environment stays pinned to the purchase even if the tester flag is removed', async () => {
      const reference = await startGuestPurchase();
      users['jwt-40'] = { ...tester, ticketingTester: false };
      try {
        const res = await post(`/api/v1/ticket-purchases/${reference}/resume`);
        expect((await res.json()).data).toMatchObject({ status: 'payment', environment: 'sandbox' });
      } finally {
        users['jwt-40'] = tester;
      }
    });
  });

  describe('cancel', () => {
    it('cancels an unfinished purchase', async () => {
      const reference = await startGuestPurchase();
      const res = await post(`/api/v1/ticket-purchases/${reference}/cancel`);
      expect((await res.json()).data).toMatchObject({ status: 'cancelled', nextAction: null });
    });

    it('409 once the order waits for payment', async () => {
      const reference = await startGuestPurchase();
      await post(`/api/v1/ticket-purchases/${reference}/resume`);
      const res = await post(`/api/v1/ticket-purchases/${reference}/cancel`);
      expect(res.status).toBe(409);
    });

    it('starting a new purchase cancels the unfinished verification ones', async () => {
      const first = await startGuestPurchase();
      await startGuestPurchase();
      expect(rows.find((r) => r.reference === first)!.status).toBe('cancelled');
    });
  });

  describe('GET /me/tickets', () => {
    it("lists the caller's tickets with the QR payload kept as a string", async () => {
      const reference = await startGuestPurchase();
      await post(`/api/v1/ticket-purchases/${reference}/resume`);
      rows[0].status = 'success';

      const res = await get('/api/v1/me/tickets');
      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({ id: 501, purchaseReference: reference, environment: 'sandbox', qrCode: '0250100000000000000000001' });
      expect(data[1]).toMatchObject({ id: 502, qrCode: null, status: 'pending_payment' });

      const other = await get('/api/v1/me/tickets', 'jwt-41');
      expect((await other.json()).data).toEqual([]);
    });

    it('settles a paid purchase the app never re-checked (no webhooks)', async () => {
      const reference = await startGuestPurchase();
      await post(`/api/v1/ticket-purchases/${reference}/resume`);
      upfan.orderStatus = 'success';

      const res = await get('/api/v1/me/tickets');
      const { data } = await res.json();
      expect(data.map((t: { id: number }) => t.id)).toEqual([501, 502]);
      expect(rows[0].status).toBe('success');
    });
  });

  it('503 busy with Retry-After when Upfan rate-limits us', async () => {
    fetchMock.mockImplementationOnce(async () => json(200, { access_token: 'machine', expires_in: 300 }));
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ errors: [{ code: 'E_TOO_MANY_REQUESTS', message: 'x' }] }), { status: 429, headers: { 'Retry-After': '9' } }));
    const res = await get('/api/v1/tickets/shop');
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('9');
    expect((await res.json()).reason).toBe('busy');
  });
});
