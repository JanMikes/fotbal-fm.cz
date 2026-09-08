import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/strapi.js', () => ({
  strapiGet: vi.fn(),
  strapiPost: vi.fn(),
  strapiGetSingle: vi.fn(),
  strapiPut: vi.fn(),
  strapiDelete: vi.fn(),
}));

const { strapiPost, strapiGetSingle, strapiDelete, strapiGet, strapiPut } = await import('../../lib/strapi.js');
const { app } = await import('../../app.js');
const { resetDeepLinkLimiters } = await import('../../lib/deep-link-limits.js');

const rodice = { id: 1, documentId: 'ac-1', name: 'Rodiče U12', slug: 'rodice-u12', description: null, sortOrder: 1, selectable: true };
const deepLink = {
  id: 7, documentId: 'dl-7', name: 'Rodiče U12', code: '7K3M9PQ2', url: 'https://fotbal-fm.cz/a/7K3M9PQ2',
  active: true, expiresAt: null, claimsCount: 0, audienceCategories: [rodice],
};

/** Strapi reads made by the login/register enrichment (profile + optional deep link). */
function mockEnrichment(userCategories: unknown[], links: unknown[] = [deepLink]) {
  vi.mocked(strapiGetSingle).mockImplementation(async (path: string) =>
    ({ id: 2, username: 'newuser', email: 'new@test.cz', audienceCategories: userCategories }) as never);
  vi.mocked(strapiGet).mockImplementation(async (path: string, options?: { filters?: Record<string, unknown> }) => {
    if (path === '/deep-links') {
      const wanted = (options?.filters?.code as { $eq: string } | undefined)?.$eq;
      return { data: links.filter((l) => (l as { code: string }).code === wanted), meta: {} } as never;
    }
    if (path === '/deep-link-claims') return { data: [], meta: {} } as never;
    throw new Error(`unexpected path ${path}`);
  });
}

function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('Auth routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetDeepLinkLimiters();
  });

  // Login
  describe('POST /api/v1/auth/login', () => {
    it('returns jwt and user on success', async () => {
      const loginResponse = { jwt: 'token-123', user: { id: 1, username: 'jan', email: 'jan@test.cz' } };
      vi.mocked(strapiPost).mockResolvedValueOnce(loginResponse);

      const res = await jsonRequest('/api/v1/auth/login', {
        identifier: 'jan@test.cz',
        password: 'heslo123',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jwt).toBe('token-123');
      expect(json.user.email).toBe('jan@test.cz');
    });

    it('adds audienceCategories to the user and keeps every Strapi field', async () => {
      const loginResponse = { jwt: 'token-123', user: { id: 2, username: 'jan', email: 'jan@test.cz', confirmed: true, createdAt: '2026-01-01' } };
      vi.mocked(strapiPost).mockResolvedValueOnce(loginResponse);
      mockEnrichment([rodice]);

      const res = await jsonRequest('/api/v1/auth/login', { identifier: 'jan@test.cz', password: 'heslo123' });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.user).toMatchObject({ id: 2, confirmed: true, createdAt: '2026-01-01' });
      expect(json.user.audienceCategories.map((c: { slug: string }) => c.slug)).toEqual(['rodice-u12']);
      expect(json.deepLink).toBeUndefined();
      expect(vi.mocked(strapiPost)).toHaveBeenCalledWith('/auth/local', { identifier: 'jan@test.cz', password: 'heslo123' });
    });

    it.each([null, ''])('treats deepLinkCode %j as "no code" and never forwards it to Strapi', async (value) => {
      vi.mocked(strapiPost).mockResolvedValueOnce({ jwt: 'token-123', user: { id: 2, username: 'jan', email: 'jan@test.cz' } });
      mockEnrichment([]);

      const res = await jsonRequest('/api/v1/auth/login', { identifier: 'jan@test.cz', password: 'heslo123', deepLinkCode: value });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jwt).toBe('token-123');
      expect(json.deepLink).toBeUndefined();
      expect(vi.mocked(strapiPost)).toHaveBeenCalledWith('/auth/local', { identifier: 'jan@test.cz', password: 'heslo123' });
      expect(vi.mocked(strapiGet)).not.toHaveBeenCalledWith('/deep-links', expect.anything());
    });

    it('applies the deep-link rate limits to codes sent with login', async () => {
      vi.mocked(strapiPost).mockResolvedValue({ jwt: 'token-123', user: { id: 2, username: 'jan', email: 'jan@test.cz' } });
      mockEnrichment([]);
      const headers = { 'x-forwarded-for': '203.0.113.7' };

      for (let i = 0; i < 60; i += 1) {
        const res = await jsonRequest('/api/v1/auth/login', { identifier: 'jan@test.cz', password: 'heslo123', deepLinkCode: `NOPE${String(i).padStart(4, '0')}` }, headers);
        expect((await res.json()).deepLink.reason).toBe('not_found');
      }
      const res = await jsonRequest('/api/v1/auth/login', { identifier: 'jan@test.cz', password: 'heslo123', deepLinkCode: 'NOPE9999' }, headers);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jwt).toBe('token-123');
      expect(json.deepLink).toMatchObject({ claimed: false, reason: 'rate_limited' });
    });

    it('still logs in when loading audience categories fails', async () => {
      vi.mocked(strapiPost).mockResolvedValueOnce({ jwt: 'token-123', user: { id: 2, username: 'jan', email: 'jan@test.cz' } });
      vi.mocked(strapiGetSingle).mockRejectedValue(new Error('strapi down'));

      const res = await jsonRequest('/api/v1/auth/login', { identifier: 'jan@test.cz', password: 'heslo123' });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jwt).toBe('token-123');
      expect(json.user.audienceCategories).toBeUndefined();
    });

    it('returns 401 on invalid credentials', async () => {
      vi.mocked(strapiPost).mockRejectedValueOnce(new Error('Invalid'));

      const res = await jsonRequest('/api/v1/auth/login', {
        identifier: 'bad@test.cz',
        password: 'wrong',
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Neplatné přihlašovací údaje');
    });
  });

  // Register
  describe('POST /api/v1/auth/register', () => {
    it('returns jwt and user on success', async () => {
      const registerResponse = { jwt: 'new-token', user: { id: 2, username: 'newuser', email: 'new@test.cz' } };
      vi.mocked(strapiPost).mockResolvedValueOnce(registerResponse);

      const res = await jsonRequest('/api/v1/auth/register', {
        username: 'newuser',
        email: 'new@test.cz',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jwt).toBe('new-token');
    });

    it('claims a deep link server-side and reports it (deepLinkCode is never forwarded to Strapi)', async () => {
      const registerResponse = { jwt: 'new-token', user: { id: 2, username: 'newuser', email: 'new@test.cz', confirmed: true } };
      vi.mocked(strapiPost).mockResolvedValue(registerResponse);
      vi.mocked(strapiPut).mockResolvedValue({} as never);
      mockEnrichment([]);

      const res = await jsonRequest('/api/v1/auth/register', {
        username: 'newuser',
        email: 'new@test.cz',
        password: 'password123',
        deepLinkCode: '7k3m-9pq2',
      }, { 'X-App-Platform': 'android' });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jwt).toBe('new-token');
      expect(json.user.confirmed).toBe(true);
      expect(json.user.audienceCategories.map((c: { slug: string }) => c.slug)).toEqual(['rodice-u12']);
      expect(json.deepLink).toMatchObject({ code: '7K3M9PQ2', claimed: true, alreadyClaimed: false });
      expect(json.deepLink.addedAudienceCategories.map((c: { slug: string }) => c.slug)).toEqual(['rodice-u12']);

      expect(vi.mocked(strapiPost)).toHaveBeenCalledWith('/auth/local/register', {
        username: 'newuser',
        email: 'new@test.cz',
        password: 'password123',
      });
      expect(vi.mocked(strapiPut)).toHaveBeenCalledWith('/users/2', { audienceCategories: [1] });
      expect(vi.mocked(strapiPost)).toHaveBeenCalledWith('/deep-link-claims', {
        data: expect.objectContaining({ deepLink: 'dl-7', user: 2, source: 'register', platform: 'android' }),
      });
    });

    it('still registers when the deep link code is unknown', async () => {
      vi.mocked(strapiPost).mockResolvedValue({ jwt: 'new-token', user: { id: 2, username: 'newuser', email: 'new@test.cz' } });
      mockEnrichment([]);

      const res = await jsonRequest('/api/v1/auth/register', {
        username: 'newuser',
        email: 'new@test.cz',
        password: 'password123',
        deepLinkCode: 'NOPE1234',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jwt).toBe('new-token');
      expect(json.user.audienceCategories).toEqual([]);
      expect(json.deepLink).toMatchObject({ code: 'NOPE1234', claimed: false, reason: 'not_found' });
      expect(vi.mocked(strapiPut)).not.toHaveBeenCalled();
    });

    it('returns Czech error for duplicate email/username', async () => {
      vi.mocked(strapiPost).mockRejectedValueOnce(
        new Error(JSON.stringify({ error: { message: 'Email or Username are already taken' } }))
      );

      const res = await jsonRequest('/api/v1/auth/register', {
        username: 'existing',
        email: 'existing@test.cz',
        password: 'password123',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('E-mail nebo uživatelské jméno je již zaregistrováno');
    });

    it('returns generic Czech error for other failures', async () => {
      vi.mocked(strapiPost).mockRejectedValueOnce(new Error('Unknown error'));

      const res = await jsonRequest('/api/v1/auth/register', {
        username: 'newuser',
        email: 'new@test.cz',
        password: 'password123',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Registrace se nezdařila');
    });
  });

  // Change Password
  describe('POST /api/v1/auth/change-password', () => {
    it('returns new jwt on success', async () => {
      const changeResponse = { jwt: 'new-jwt', user: { id: 1, username: 'jan', email: 'jan@test.cz' } };
      vi.mocked(strapiPost).mockResolvedValueOnce(changeResponse);

      const res = await jsonRequest(
        '/api/v1/auth/change-password',
        { currentPassword: 'old', password: 'newPass1', passwordConfirmation: 'newPass1' },
        { Authorization: 'Bearer user-jwt' },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jwt).toBe('new-jwt');
    });

    it('returns 401 when missing auth header', async () => {
      const res = await jsonRequest('/api/v1/auth/change-password', {
        currentPassword: 'old',
        password: 'newPass1',
        passwordConfirmation: 'newPass1',
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Chybí autorizační hlavička');
    });

    it('returns Czech error for wrong current password', async () => {
      vi.mocked(strapiPost).mockRejectedValueOnce(
        new Error(JSON.stringify({ error: { message: 'The provided current password is invalid' } }))
      );

      const res = await jsonRequest(
        '/api/v1/auth/change-password',
        { currentPassword: 'wrong', password: 'newPass1', passwordConfirmation: 'newPass1' },
        { Authorization: 'Bearer user-jwt' },
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Zadané aktuální heslo je nesprávné');
    });

    it('returns Czech error for password mismatch', async () => {
      vi.mocked(strapiPost).mockRejectedValueOnce(
        new Error(JSON.stringify({ error: { message: 'Passwords do not match' } }))
      );

      const res = await jsonRequest(
        '/api/v1/auth/change-password',
        { currentPassword: 'oldPass', password: 'newPass1', passwordConfirmation: 'newPass2' },
        { Authorization: 'Bearer user-jwt' },
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Hesla se neshodují');
    });
  });

  // Close Account
  describe('POST /api/v1/auth/close-account', () => {
    it('deletes account on success', async () => {
      vi.mocked(strapiGetSingle).mockResolvedValueOnce({ id: 1, email: 'jan@test.cz' });
      vi.mocked(strapiPost).mockResolvedValueOnce({ jwt: 'x', user: {} });
      vi.mocked(strapiDelete).mockResolvedValueOnce({ id: 1 });

      const res = await jsonRequest(
        '/api/v1/auth/close-account',
        { password: 'heslo123' },
        { Authorization: 'Bearer user-jwt' },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it('returns 401 when missing auth header', async () => {
      const res = await jsonRequest('/api/v1/auth/close-account', { password: 'heslo' });
      expect(res.status).toBe(401);
    });

    it('returns 401 for invalid token', async () => {
      vi.mocked(strapiGetSingle).mockRejectedValueOnce(new Error('Unauthorized'));

      const res = await jsonRequest(
        '/api/v1/auth/close-account',
        { password: 'heslo' },
        { Authorization: 'Bearer bad-token' },
      );

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Neplatný nebo expirovaný token');
    });

    it('returns 401 for wrong password', async () => {
      vi.mocked(strapiGetSingle).mockResolvedValueOnce({ id: 1, email: 'jan@test.cz' });
      vi.mocked(strapiPost).mockRejectedValueOnce(new Error('Invalid credentials'));

      const res = await jsonRequest(
        '/api/v1/auth/close-account',
        { password: 'wrong' },
        { Authorization: 'Bearer user-jwt' },
      );

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Nesprávné heslo');
    });

    it('returns 400 when delete fails', async () => {
      vi.mocked(strapiGetSingle).mockResolvedValueOnce({ id: 1, email: 'jan@test.cz' });
      vi.mocked(strapiPost).mockResolvedValueOnce({ jwt: 'x', user: {} });
      vi.mocked(strapiDelete).mockRejectedValueOnce(new Error('Delete failed'));

      const res = await jsonRequest(
        '/api/v1/auth/close-account',
        { password: 'heslo123' },
        { Authorization: 'Bearer user-jwt' },
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Smazání účtu se nezdařilo');
    });
  });

  // Forgot Password
  describe('POST /api/v1/auth/forgot-password', () => {
    it('always returns ok (prevents email enumeration)', async () => {
      vi.mocked(strapiPost).mockResolvedValueOnce({});

      const res = await jsonRequest('/api/v1/auth/forgot-password', {
        email: 'jan@test.cz',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it('returns ok even when strapi throws', async () => {
      vi.mocked(strapiPost).mockRejectedValueOnce(new Error('Email not found'));

      const res = await jsonRequest('/api/v1/auth/forgot-password', {
        email: 'nonexistent@test.cz',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });
  });

  // Reset Password
  describe('POST /api/v1/auth/reset-password', () => {
    it('returns jwt on success', async () => {
      const resetResponse = { jwt: 'reset-jwt', user: { id: 1, username: 'jan', email: 'jan@test.cz' } };
      vi.mocked(strapiPost).mockResolvedValueOnce(resetResponse);

      const res = await jsonRequest('/api/v1/auth/reset-password', {
        code: 'valid-code',
        password: 'newPassword1',
        passwordConfirmation: 'newPassword1',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.jwt).toBe('reset-jwt');
    });

    it('returns Czech error for invalid code', async () => {
      vi.mocked(strapiPost).mockRejectedValueOnce(
        new Error(JSON.stringify({ error: { message: 'Incorrect code provided' } }))
      );

      const res = await jsonRequest('/api/v1/auth/reset-password', {
        code: 'bad-code',
        password: 'newPassword1',
        passwordConfirmation: 'newPassword1',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Neplatný nebo expirovaný kód pro obnovení hesla');
    });

    it('returns Czech error for password mismatch', async () => {
      vi.mocked(strapiPost).mockRejectedValueOnce(
        new Error(JSON.stringify({ error: { message: 'Passwords do not match' } }))
      );

      const res = await jsonRequest('/api/v1/auth/reset-password', {
        code: 'valid-code',
        password: 'newPass1',
        passwordConfirmation: 'newPass2',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Hesla se neshodují');
    });

    it('returns generic Czech error for unknown failure', async () => {
      vi.mocked(strapiPost).mockRejectedValueOnce(new Error('Network error'));

      const res = await jsonRequest('/api/v1/auth/reset-password', {
        code: 'code',
        password: 'newPass1',
        passwordConfirmation: 'newPass1',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Obnovení hesla se nezdařilo');
    });
  });
});
