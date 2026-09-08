import type { MiddlewareHandler } from 'hono';

/**
 * Lets a route with an optional JSON body accept `Content-Type: application/json` with an
 * empty body (what an HTTP client sends for a bare POST). Hono's JSON validator would
 * otherwise answer "Malformed JSON in request body". Runs before the route validators.
 */
export const optionalJsonBody: MiddlewareHandler = async (c, next) => {
  const contentType = c.req.header('content-type') ?? '';
  if (/application\/json/i.test(contentType)) {
    const text = await c.req.raw.clone().text();
    if (!text.trim()) {
      c.req.raw = new Request(c.req.raw.url, {
        method: c.req.method,
        headers: c.req.raw.headers,
        body: '{}',
      });
    }
  }
  await next();
};
