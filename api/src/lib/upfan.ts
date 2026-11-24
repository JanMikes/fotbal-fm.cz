/**
 * Upfan partner ticketing API client (https://docs.upfan.io, API v1).
 *
 * - Two environments with separate credentials, accounts, orders and resource ids:
 *   `sandbox` (test payments) and `production`. An environment without credentials is
 *   "not configured" and is never used — see `environmentFor()` in ticketing.ts.
 * - Machine tokens (OAuth client_credentials, HTTP Basic at the token URL) are cached per
 *   environment and renewed before `expires_in`; a 401 renews once and retries.
 * - Upfan allows 300 requests/min per integration (writes 60/min) INCLUDING status polling.
 *   `UpfanBudget` keeps us under that with headroom and fails fast (`UpfanBusyError`) instead
 *   of queueing; a 429 blocks the environment for `Retry-After`.
 * - Never log tokens, onboarding/payment URLs or QR values (Upfan: keep authentication,
 *   verification, payment and admission data out of logs).
 */

export type UpfanEnvironment = 'sandbox' | 'production';

export interface UpfanEnvironmentConfig {
  environment: UpfanEnvironment;
  apiBaseUrl: string;
  tokenUrl: string;
  audience: string;
  clientId: string;
  clientSecret: string;
  /** Registered return URLs (Universal Links / App Links into the mobile app). */
  buyerReturnUrl: string;
  paymentReturnUrl: string;
}

const DEFAULTS: Record<UpfanEnvironment, { apiBaseUrl: string; tokenUrl: string; audience: string; returnPath: string }> = {
  sandbox: {
    apiBaseUrl: 'https://api.upfan.dev/api/partner/v1',
    tokenUrl: 'https://upfan-hydra-825592685518.europe-west6.run.app/oauth2/token',
    audience: 'https://api.upfan.dev/partner/v1',
    returnPath: '/upfan/test',
  },
  production: {
    apiBaseUrl: 'https://api.upfan.io/api/partner/v1',
    tokenUrl: 'https://auth.upfan.io/oauth2/token',
    audience: 'https://api.upfan.io/partner/v1',
    returnPath: '/upfan',
  },
};

export const UPFAN_SCOPES =
  'buyers:write events:read venues:read ticket-categories:read reservations:read reservations:write orders:read tickets:read';

const ENV_PREFIX: Record<UpfanEnvironment, string> = { sandbox: 'UPFAN_SANDBOX', production: 'UPFAN_PRODUCTION' };

/** Reads one environment from process.env; null when its client id/secret are missing. */
export function readUpfanConfig(environment: UpfanEnvironment, env: NodeJS.ProcessEnv = process.env): UpfanEnvironmentConfig | null {
  const prefix = ENV_PREFIX[environment];
  const clientId = env[`${prefix}_CLIENT_ID`]?.trim();
  const clientSecret = env[`${prefix}_CLIENT_SECRET`]?.trim();
  if (!clientId || !clientSecret) return null;

  const defaults = DEFAULTS[environment];
  const returnBase = (env.UPFAN_RETURN_BASE_URL?.trim() || 'https://fotbal-fm.cz').replace(/\/+$/, '');
  return {
    environment,
    apiBaseUrl: env[`${prefix}_API_BASE_URL`]?.trim() || defaults.apiBaseUrl,
    tokenUrl: env[`${prefix}_TOKEN_URL`]?.trim() || defaults.tokenUrl,
    audience: env[`${prefix}_AUDIENCE`]?.trim() || defaults.audience,
    clientId,
    clientSecret,
    buyerReturnUrl: `${returnBase}${defaults.returnPath}/buyer-return`,
    paymentReturnUrl: `${returnBase}${defaults.returnPath}/payment-return`,
  };
}

// --- Errors ---

/** A non-2xx answer from Upfan. `code` is `errors[0].code` (match on status + code, never on message). */
export class UpfanApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(`Upfan API ${status}${code ? ` ${code}` : ''}`);
  }
}

/** Our own request budget is spent, Upfan answered 429, or Upfan is unreachable — try again later. */
export class UpfanBusyError extends Error {
  constructor(readonly retryAfterMs: number) {
    super('Upfan is busy');
  }
}

// --- Budget ---

/** Our share of Upfan's per-integration limits (300/min total, 60/min writes), with headroom. */
export const BUDGET = { totalPerMinute: 270, writesPerMinute: 55 } as const;
const WINDOW_MS = 60_000;

export class UpfanBudget {
  private all: number[] = [];
  private writes: number[] = [];
  private blockedUntil = 0;

  constructor(private readonly now: () => number = Date.now) {}

  /** Records one request or throws UpfanBusyError when it would exceed the budget. */
  take(kind: 'read' | 'write'): void {
    const now = this.now();
    if (now < this.blockedUntil) throw new UpfanBusyError(this.blockedUntil - now);
    this.all = this.all.filter((t) => now - t < WINDOW_MS);
    this.writes = this.writes.filter((t) => now - t < WINDOW_MS);
    if (this.all.length >= BUDGET.totalPerMinute) throw new UpfanBusyError(WINDOW_MS - (now - this.all[0]));
    if (kind === 'write' && this.writes.length >= BUDGET.writesPerMinute) {
      throw new UpfanBusyError(WINDOW_MS - (now - this.writes[0]));
    }
    this.all.push(now);
    if (kind === 'write') this.writes.push(now);
  }

  /** After a 429: stop calling Upfan for `ms`. */
  block(ms: number): void {
    this.blockedUntil = Math.max(this.blockedUntil, this.now() + ms);
  }

  remaining(): number {
    const now = this.now();
    return BUDGET.totalPerMinute - this.all.filter((t) => now - t < WINDOW_MS).length;
  }
}

// --- Wire types (subset of the OpenAPI contract we use) ---

export interface UpfanEvent {
  id: number;
  name: string;
  slug: string | null;
  description: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  currency: string;
  venue: { id: number; name: string; timezone: string | null; address: { line: string; locality: string | null; region: string | null; country: string | null } } | null;
  checkout: { generalAdmission: boolean; assignedSeating: boolean; unavailableReason?: string | null };
}

export interface UpfanPriceTier {
  id: number;
  name: string | null;
  unitAmount: number;
  currency: string;
  availableQuantity: number | null;
  salesStartAt: string | null;
  salesEndAt: string | null;
}

export interface UpfanTicketCategory {
  id: number;
  name: string;
  description: string | null;
  type: 'general_admission' | 'assigned_seating';
  checkoutSupported: boolean;
  checkoutUnavailableReason?: string | null;
  priceTiers: UpfanPriceTier[];
}

export interface UpfanBuyerToken {
  status: 'authenticated';
  accessToken: string;
  tokenType: 'bearer';
  expiresIn: number;
  scope: string;
}

export interface UpfanOnboarding {
  status: 'onboarding_required';
  mode: 'complete_profile' | 'link_account' | 'guest_checkout';
  onboardingUrl: string;
  onboardingId?: string;
  expiresIn: number;
}

export interface UpfanReservation {
  id: string;
  eventId: number;
  ticketCategoryId: number;
  quantity: number;
  status: 'active' | 'expired' | 'cancelled' | 'checked_out';
  expiresAt: string;
  price: { unitAmount: number; totalAmount: number } | null;
  createdAt: string;
}

export interface UpfanOrder {
  id: string;
  externalReference: string | null;
  /** Unknown future statuses must be treated as incomplete. */
  status: 'pending' | 'success' | 'failure' | string;
  eventId: number | null;
  totalAmount: number | null;
  currency: string | null;
  paymentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpfanTicket {
  id: number;
  orderId: string | null;
  status: 'ready' | 'pending_payment' | string;
  holderName: string | null;
  event: { id: number; name: string; startsAt: string; endsAt: string };
  category: { id: number; name: string };
  seat: unknown;
  qrCode?: { type: 'static'; value: string } | null;
  documentPath: string;
}

// --- Client ---

interface CachedToken {
  value: string;
  expiresAt: number;
}

const REQUEST_TIMEOUT_MS = 10_000;
/** Renew machine tokens this long before they expire. */
const TOKEN_MARGIN_MS = 30_000;

export class UpfanClient {
  readonly budget: UpfanBudget;
  private token: CachedToken | null = null;
  private tokenPromise: Promise<string> | null = null;

  constructor(
    readonly config: UpfanEnvironmentConfig,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly now: () => number = Date.now,
  ) {
    this.budget = new UpfanBudget(now);
  }

  get environment(): UpfanEnvironment {
    return this.config.environment;
  }

  /** Machine token, cached and single-flight. */
  async machineToken(forceRenew = false): Promise<string> {
    if (!forceRenew && this.token && this.now() < this.token.expiresAt - TOKEN_MARGIN_MS) return this.token.value;
    if (!this.tokenPromise) {
      this.tokenPromise = this.fetchMachineToken().finally(() => {
        this.tokenPromise = null;
      });
    }
    return this.tokenPromise;
  }

  private async fetchMachineToken(): Promise<string> {
    const { clientId, clientSecret, tokenUrl, audience } = this.config;
    const body = new URLSearchParams({ grant_type: 'client_credentials', audience, scope: UPFAN_SCOPES });
    let res: Response;
    try {
      res = await this.fetchImpl(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new UpfanBusyError(5_000);
    }
    if (!res.ok) {
      const oauth = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new UpfanApiError(res.status, oauth?.error ?? null);
    }
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, expiresAt: this.now() + json.expires_in * 1000 };
    return json.access_token;
  }

  /**
   * One API call. `token` = a buyer token, or omitted for the machine token (renewed once on 401).
   * Returns the parsed body and HTTP status (several endpoints branch on 200/201/202).
   */
  async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    options: { body?: unknown; buyerToken?: string; headers?: Record<string, string> } = {},
  ): Promise<{ status: number; body: T }> {
    this.budget.take(method === 'GET' ? 'read' : 'write');

    const send = async (bearer: string) => {
      try {
        return await this.fetchImpl(`${this.config.apiBaseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
            ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
          },
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        throw new UpfanBusyError(5_000);
      }
    };

    let res = await send(options.buyerToken ?? (await this.machineToken()));
    if (res.status === 401 && !options.buyerToken) {
      this.budget.take(method === 'GET' ? 'read' : 'write');
      res = await send(await this.machineToken(true));
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const ms = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 10_000;
      this.budget.block(ms);
      throw new UpfanBusyError(ms);
    }
    if (res.status >= 500) throw new UpfanBusyError(5_000);

    const body = (await res.json().catch(() => null)) as T & { errors?: { code?: string }[] };
    if (!res.ok) throw new UpfanApiError(res.status, body?.errors?.[0]?.code ?? null);
    return { status: res.status, body: body as T };
  }

  // --- Endpoints ---

  async listEvents(): Promise<UpfanEvent[]> {
    const events: UpfanEvent[] = [];
    for (let page = 1; page <= 10; page++) {
      const { body } = await this.request<{ data: UpfanEvent[]; meta: { currentPage: number; lastPage: number } }>(
        'GET',
        `/events?page=${page}&limit=100`,
      );
      events.push(...body.data);
      if (body.meta.currentPage >= body.meta.lastPage) break;
    }
    return events;
  }

  async listTicketCategories(eventId: number): Promise<UpfanTicketCategory[]> {
    const { body } = await this.request<{ data: UpfanTicketCategory[] }>('GET', `/events/${eventId}/ticket-categories`);
    return body.data;
  }

  /** 201 → buyer token; 202 → Upfan-hosted onboarding panel needed (then repeat). */
  async createBuyerSession(input: {
    externalSubject: string;
    email: string;
    firstName?: string;
    lastName?: string;
  }): Promise<UpfanBuyerToken | UpfanOnboarding> {
    const { body } = await this.request<{ data: UpfanBuyerToken | UpfanOnboarding }>('POST', '/buyer-sessions', {
      body: {
        externalSubject: input.externalSubject,
        email: input.email,
        emailVerified: true,
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.lastName ? { lastName: input.lastName } : {}),
        connectionReturnUrl: this.config.buyerReturnUrl,
        locale: 'cs',
      },
    });
    return body.data;
  }

  /** Guest checkout: always 202 with an onboarding panel and a redemption handle. Not idempotent. */
  async createGuestBuyerSession(): Promise<UpfanOnboarding> {
    const { body } = await this.request<{ data: UpfanOnboarding }>('POST', '/guest-buyer-sessions', {
      body: { connectionReturnUrl: this.config.buyerReturnUrl, locale: 'cs' },
    });
    return body.data;
  }

  /** 201 → buyer token; 409 E_PARTNER_GUEST_ONBOARDING_INCOMPLETE; 410 expired. */
  async redeemGuestBuyerSession(onboardingId: string): Promise<UpfanBuyerToken> {
    const { body } = await this.request<{ data: UpfanBuyerToken }>(
      'POST',
      `/guest-buyer-sessions/${encodeURIComponent(onboardingId)}/redemptions`,
    );
    return body.data;
  }

  /** Idempotent per `idempotencyKey`: a replay returns the original hold (possibly no longer active). */
  async createReservation(eventId: number, ticketCategoryId: number, quantity: number, idempotencyKey: string): Promise<UpfanReservation> {
    const { body } = await this.request<{ data: UpfanReservation }>('POST', `/events/${eventId}/ticket-reservations`, {
      body: { ticketCategoryId, quantity },
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return body.data;
  }

  async cancelReservation(reservationId: string): Promise<UpfanReservation> {
    const { body } = await this.request<{ data: UpfanReservation }>('DELETE', `/ticket-reservations/${encodeURIComponent(reservationId)}`);
    return body.data;
  }

  /** Buyer token only. Idempotent per `externalReference` (+ same buyer and reservation). */
  async createOrder(buyerToken: string, reservationId: string, externalReference: string): Promise<{ order: UpfanOrder; paymentUrl: string | null }> {
    const { body } = await this.request<{ data: UpfanOrder; payment?: { url: string | null } }>('POST', '/orders', {
      buyerToken,
      body: { reservationId, redirectUrl: this.config.paymentReturnUrl, externalReference },
    });
    return { order: body.data, paymentUrl: body.payment?.url ?? body.data.paymentUrl ?? null };
  }

  async getOrder(orderId: string): Promise<UpfanOrder> {
    const { body } = await this.request<{ data: UpfanOrder }>('GET', `/orders/${encodeURIComponent(orderId)}`);
    return body.data;
  }

  async listOrderTickets(orderId: string): Promise<UpfanTicket[]> {
    const { body } = await this.request<{ data: UpfanTicket[] }>('GET', `/orders/${encodeURIComponent(orderId)}/tickets`);
    return body.data;
  }
}

// --- Per-environment singletons ---

const clients = new Map<UpfanEnvironment, UpfanClient | null>();

/** The client for an environment, or null when it has no credentials. */
export function upfanClient(environment: UpfanEnvironment): UpfanClient | null {
  if (!clients.has(environment)) {
    const config = readUpfanConfig(environment);
    clients.set(environment, config ? new UpfanClient(config) : null);
  }
  return clients.get(environment) ?? null;
}

/** Tests: drop cached clients (and their tokens/budgets) so env changes take effect. */
export function resetUpfanClients(): void {
  clients.clear();
}
