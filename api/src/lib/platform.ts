import type { Context } from 'hono';

export type AppPlatform = 'ios' | 'android' | 'web' | 'unknown';

/**
 * Optional `X-App-Platform` request header sent by the mobile app (ios | android) or the
 * website (web). Only used to label deep-link claims for analytics; never required.
 */
export function readPlatform(c: Context): AppPlatform {
  const value = c.req.header('x-app-platform')?.trim().toLowerCase();
  return value === 'ios' || value === 'android' || value === 'web' ? value : 'unknown';
}
