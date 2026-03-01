import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/strapi.js', () => ({
  strapiGet: vi.fn(),
  strapiPost: vi.fn(),
  strapiGetSingle: vi.fn(),
  strapiPut: vi.fn(),
  strapiDelete: vi.fn(),
}));

const { strapiPost, strapiGetSingle, strapiDelete } = await import('../../lib/strapi.js');
const { app } = await import('../../app.js');

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
