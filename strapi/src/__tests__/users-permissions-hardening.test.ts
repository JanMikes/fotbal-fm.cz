import { describe, it, expect, vi, beforeEach } from 'vitest';
import extend from '../extensions/users-permissions/strapi-server';

// The users-permissions hardening (src/extensions/users-permissions/strapi-server.ts): service-token
// requests keep the stock controllers, user-JWT requests are confined to their own profile.

type Ctx = Parameters<ReturnType<typeof setup>['controllers']['find']>[0];

function setup() {
  const stock = {
    find: vi.fn(async () => 'find'),
    findOne: vi.fn(async () => 'findOne'),
    update: vi.fn(async () => 'update'),
    create: vi.fn(async () => 'create'),
    destroy: vi.fn(async () => 'destroy'),
  };
  const plugin = extend({ controllers: { user: { ...stock } } });
  return { stock, controllers: plugin.controllers.user };
}

function ctx(strategy: string, opts: { userId?: number; id?: string; body?: Record<string, unknown> } = {}) {
  return {
    state: { auth: { strategy: { name: strategy } }, user: opts.userId === undefined ? undefined : { id: opts.userId } },
    params: { id: opts.id },
    query: { filters: { email: { $eq: 'someone@example.com' } } },
    request: { body: opts.body ?? {} },
    unauthorized: vi.fn(() => 'unauthorized'),
  };
}

describe('users-permissions hardening', () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  // Strapi ≤5.44 named the content-API token strategy `api-token`, 5.45+ `content-api-token`.
  // Missing the new name turned every service-token call into a "member" call (403 on create,
  // update and delete — audience assignment, registration and account deletion broke).
  describe.each(['api-token', 'content-api-token'])('service token (%s strategy)', (strategy) => {
    it('keeps the stock behaviour for every action', async () => {
      const c = ctx(strategy, { id: '7', body: { role: 3, audienceCategories: [1] } });
      expect(await t.controllers.find(c as Ctx)).toBe('find');
      expect(c.query).toEqual({ filters: { email: { $eq: 'someone@example.com' } } });
      expect(await t.controllers.findOne(c as Ctx)).toBe('findOne');
      expect(await t.controllers.update(c as Ctx)).toBe('update');
      expect(await t.controllers.create(c as Ctx)).toBe('create');
      expect(await t.controllers.destroy(c as Ctx)).toBe('destroy');
    });
  });

  describe('user JWT', () => {
    it('narrows find to the caller', async () => {
      const c = ctx('users-permissions', { userId: 5 });
      expect(await t.controllers.find(c as Ctx)).toBe('find');
      expect(c.query).toEqual({ filters: { id: { $eq: 5 } } });
    });

    it('allows own profile reads and plain-field updates only', async () => {
      expect(await t.controllers.findOne(ctx('users-permissions', { userId: 5, id: '5' }) as Ctx)).toBe('findOne');
      await expect(t.controllers.findOne(ctx('users-permissions', { userId: 5, id: '6' }) as Ctx)).rejects.toThrow('Cizí profil');
      expect(await t.controllers.update(ctx('users-permissions', { userId: 5, id: '5', body: { firstname: 'Jan' } }) as Ctx)).toBe('update');
      await expect(t.controllers.update(ctx('users-permissions', { userId: 5, id: '5', body: { role: 1 } }) as Ctx)).rejects.toThrow('role');
      await expect(t.controllers.update(ctx('users-permissions', { userId: 5, id: '6', body: { firstname: 'X' } }) as Ctx)).rejects.toThrow('vlastní profil');
    });

    it('never creates or deletes users', async () => {
      await expect(t.controllers.create(ctx('users-permissions', { userId: 5 }) as Ctx)).rejects.toThrow('registrace');
      await expect(t.controllers.destroy(ctx('users-permissions', { userId: 5, id: '5' }) as Ctx)).rejects.toThrow('aplikaci');
      expect(t.stock.create).not.toHaveBeenCalled();
      expect(t.stock.destroy).not.toHaveBeenCalled();
    });

    it('treats an admin token like any non-service caller', async () => {
      await expect(t.controllers.create(ctx('admin-token') as Ctx)).rejects.toThrow('registrace');
    });
  });
});
