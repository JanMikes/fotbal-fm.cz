import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { extractJwt } from '../../middleware/auth.js';

function createContext(headers: Record<string, string> = {}) {
  const app = new Hono();
  // We need to create a proper Hono context, so we use a route handler
  let result: string | Error;
  app.get('/test', (c) => {
    try {
      result = extractJwt(c);
      return c.json({ token: result });
    } catch (e) {
      result = e as Error;
      return c.json({ error: (e as Error).message }, 401);
    }
  });

  return { app, getResult: () => result! };
}

describe('extractJwt', () => {
  it('extracts token from valid Bearer header', async () => {
    const { app } = createContext();
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer my-jwt-token' },
    });
    const json = await res.json();
    expect(json.token).toBe('my-jwt-token');
  });

  it('throws when Authorization header is missing', async () => {
    const { app } = createContext();
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Chybí autorizační hlavička');
  });

  it('throws when Authorization header has invalid format', async () => {
    const { app } = createContext();
    const res = await app.request('/test', {
      headers: { Authorization: 'Basic abc123' },
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Neplatný formát autorizační hlavičky');
  });

  it('throws when Authorization header has no token', async () => {
    const { app } = createContext();
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer' },
    });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Neplatný formát autorizační hlavičky');
  });
});
