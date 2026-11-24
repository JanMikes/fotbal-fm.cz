import { describe, it, expect, vi } from 'vitest';
import { BUDGET, UpfanApiError, UpfanBudget, UpfanBusyError, UpfanClient, readUpfanConfig, type UpfanEnvironmentConfig } from '../../lib/upfan.js';

const config: UpfanEnvironmentConfig = {
  environment: 'sandbox',
  apiBaseUrl: 'https://api.test/api/partner/v1',
  tokenUrl: 'https://auth.test/oauth2/token',
  audience: 'https://api.test/partner/v1',
  clientId: 'client',
  clientSecret: 'secret',
  buyerReturnUrl: 'https://fotbal-fm.cz/upfan/test/buyer-return',
  paymentReturnUrl: 'https://fotbal-fm.cz/upfan/test/payment-return',
};

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

describe('readUpfanConfig', () => {
  it('is null without credentials', () => {
    expect(readUpfanConfig('production', {})).toBeNull();
    expect(readUpfanConfig('sandbox', { UPFAN_SANDBOX_CLIENT_ID: 'x' })).toBeNull();
  });

  it('uses the documented endpoints and our registered return URLs per environment', () => {
    const sandbox = readUpfanConfig('sandbox', { UPFAN_SANDBOX_CLIENT_ID: 'id', UPFAN_SANDBOX_CLIENT_SECRET: 's' })!;
    expect(sandbox.apiBaseUrl).toBe('https://api.upfan.dev/api/partner/v1');
    expect(sandbox.audience).toBe('https://api.upfan.dev/partner/v1');
    expect(sandbox.buyerReturnUrl).toBe('https://fotbal-fm.cz/upfan/test/buyer-return');
    expect(sandbox.paymentReturnUrl).toBe('https://fotbal-fm.cz/upfan/test/payment-return');

    const production = readUpfanConfig('production', { UPFAN_PRODUCTION_CLIENT_ID: 'id', UPFAN_PRODUCTION_CLIENT_SECRET: 's' })!;
    expect(production.apiBaseUrl).toBe('https://api.upfan.io/api/partner/v1');
    expect(production.tokenUrl).toBe('https://auth.upfan.io/oauth2/token');
    expect(production.buyerReturnUrl).toBe('https://fotbal-fm.cz/upfan/buyer-return');
    expect(production.paymentReturnUrl).toBe('https://fotbal-fm.cz/upfan/payment-return');
  });
});

describe('UpfanBudget', () => {
  it('stops at our share of the per-minute limits and recovers after the window', () => {
    let now = 0;
    const budget = new UpfanBudget(() => now);
    for (let i = 0; i < BUDGET.writesPerMinute; i++) budget.take('write');
    expect(() => budget.take('write')).toThrow(UpfanBusyError);
    for (let i = BUDGET.writesPerMinute; i < BUDGET.totalPerMinute; i++) budget.take('read');
    expect(() => budget.take('read')).toThrow(UpfanBusyError);
    now = 60_001;
    expect(() => budget.take('write')).not.toThrow();
  });

  it('blocks everything for the Retry-After of a 429', () => {
    let now = 0;
    const budget = new UpfanBudget(() => now);
    budget.block(5_000);
    expect(() => budget.take('read')).toThrow(UpfanBusyError);
    now = 5_001;
    expect(() => budget.take('read')).not.toThrow();
  });
});

describe('UpfanClient', () => {
  it('gets a machine token with HTTP Basic + audience + scopes, and caches it until shortly before expiry', async () => {
    let now = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url) === config.tokenUrl) {
        const body = new URLSearchParams(init!.body as URLSearchParams);
        expect(body.get('grant_type')).toBe('client_credentials');
        expect(body.get('audience')).toBe(config.audience);
        expect(body.get('scope')).toContain('reservations:write');
        expect((init!.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('client:secret').toString('base64')}`);
        return json(200, { access_token: 'machine-1', expires_in: 300, token_type: 'bearer' });
      }
      return json(200, { data: [], meta: { currentPage: 1, lastPage: 1 } });
    });
    const client = new UpfanClient(config, fetchImpl as typeof fetch, () => now);

    await client.listEvents();
    await client.listEvents();
    expect(fetchImpl.mock.calls.filter(([u]) => String(u) === config.tokenUrl)).toHaveLength(1);

    now = 280_000; // inside the 30 s renewal margin
    await client.listEvents();
    expect(fetchImpl.mock.calls.filter(([u]) => String(u) === config.tokenUrl)).toHaveLength(2);
  });

  it('renews the machine token once on 401 and retries', async () => {
    let tokens = 0;
    let calls = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === config.tokenUrl) return json(200, { access_token: `machine-${++tokens}`, expires_in: 300 });
      calls++;
      return calls === 1 ? json(401, { errors: [{ code: 'E_PARTNER_TOKEN_INACTIVE', message: 'x' }] }) : json(200, { data: { id: 'o1', status: 'pending' } });
    });
    const client = new UpfanClient(config, fetchImpl as typeof fetch);
    const order = await client.getOrder('o1');
    expect(order.status).toBe('pending');
    expect(tokens).toBe(2);
  });

  it('turns 429 into UpfanBusyError and honours Retry-After', async () => {
    let now = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === config.tokenUrl) return json(200, { access_token: 't', expires_in: 300 });
      return json(429, { errors: [{ code: 'E_TOO_MANY_REQUESTS', message: 'x' }] }, { 'Retry-After': '7' });
    });
    const client = new UpfanClient(config, fetchImpl as typeof fetch, () => now);
    await expect(client.getOrder('o1')).rejects.toMatchObject({ retryAfterMs: 7_000 });
    const before = fetchImpl.mock.calls.length;
    await expect(client.getOrder('o1')).rejects.toBeInstanceOf(UpfanBusyError);
    expect(fetchImpl.mock.calls.length).toBe(before); // blocked locally, Upfan not called
  });

  it('exposes Upfan error codes', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === config.tokenUrl) return json(200, { access_token: 't', expires_in: 300 });
      return json(409, { errors: [{ code: 'E_PARTNER_INVENTORY_LIMIT', message: 'x' }] });
    });
    const client = new UpfanClient(config, fetchImpl as typeof fetch);
    const err = await client.createReservation(1, 2, 3, 'key').catch((e) => e);
    expect(err).toBeInstanceOf(UpfanApiError);
    expect(err).toMatchObject({ status: 409, code: 'E_PARTNER_INVENTORY_LIMIT' });
  });

  it('sends the Idempotency-Key on reservations and the buyer token + references on orders', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url) === config.tokenUrl) return json(200, { access_token: 'machine', expires_in: 300 });
      const headers = init!.headers as Record<string, string>;
      if (String(url).endsWith('/ticket-reservations')) {
        expect(headers['Idempotency-Key']).toBe('fkfm-1');
        return json(201, { data: { id: 'r1', status: 'active' } });
      }
      expect(headers.Authorization).toBe('Bearer buyer-token');
      expect(JSON.parse(init!.body as string)).toEqual({
        reservationId: 'r1',
        redirectUrl: config.paymentReturnUrl,
        externalReference: 'fkfm-1',
      });
      return json(201, { data: { id: 'o1', status: 'pending', paymentUrl: null }, payment: { token: 'p', url: 'https://pay/1' } });
    });
    const client = new UpfanClient(config, fetchImpl as typeof fetch);
    await client.createReservation(10, 20, 2, 'fkfm-1');
    const { paymentUrl } = await client.createOrder('buyer-token', 'r1', 'fkfm-1');
    expect(paymentUrl).toBe('https://pay/1');
  });
});
