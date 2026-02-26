import type { Context } from 'hono';

export function extractJwt(c: Context): string {
  const header = c.req.header('Authorization');

  if (!header) {
    throw new Error('Chybí autorizační hlavička');
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new Error('Neplatný formát autorizační hlavičky');
  }

  return parts[1];
}
