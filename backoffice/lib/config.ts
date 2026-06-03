import { z } from 'zod/v4';
import { AppError, ErrorCode } from './core/errors';

/**
 * Environment variable schema definition
 * Validates all required environment variables at runtime
 */
const envSchema = z.object({
  // Session configuration
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),

  // Strapi API configuration (server-side only)
  STRAPI_URL: z.string().url('STRAPI_URL must be a valid URL'),
  STRAPI_API_TOKEN: z.string().min(50, 'STRAPI_API_TOKEN must be at least 50 characters'),

  // Public uploads URL (client-side accessible)
  PUBLIC_UPLOADS_URL: z.string().url('PUBLIC_UPLOADS_URL must be a valid URL').default('http://localhost:8080'),

  // Registration secret
  REGISTRATION_SECRET: z.string().min(1, 'REGISTRATION_SECRET is required').optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Email configuration
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  EMAIL_FROM: z.string().default('noreply@fotbal-fm.cz'),
  EMAIL_TO: z.string().default('info@fotbal-fm.cz'),

  // Application URL (for links in emails)
  APP_URL: z.string().url().default('http://localhost:3000'),

  // WBoost Brand-Manuals API (social-network template export) — server-side only.
  // Optional: when unset the export feature is disabled but the rest of the app boots normally.
  // getWboostConfig() surfaces a friendly error only when the feature is actually used.
  WBOOST_API_BASE: z.string().url('WBOOST_API_BASE must be a valid URL').optional(),
  WBOOST_CLIENT_ID: z.string().min(1).optional(),
  WBOOST_CLIENT_SECRET: z.string().min(1).optional(),
  WBOOST_PROJECT_ID: z.string().min(1).optional(),
  // Picker thumbnails: 'true' once the API serves thumbnails from the API host.
  // Default off — we never touch the object store directly.
  WBOOST_THUMBNAILS: z.enum(['true', 'false']).default('false'),
});

/**
 * Skip strict env validation when runtime env isn't available or relevant:
 * - during the Next.js production build (env injected later at runtime), and
 * - under tests (vitest), so unit tests don't require real runtime env.
 * In these cases validateEnv() returns safe placeholders instead of throwing.
 */
const isBuildTime =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NODE_ENV === 'test' ||
  !!process.env.VITEST;

/**
 * Validates and parses environment variables
 * Throws an error if validation fails
 * Skips validation during build time
 */
function validateEnv() {
  // During build time, return placeholder values
  // Real validation happens at runtime
  if (isBuildTime) {
    return {
      SESSION_SECRET: 'build-time-placeholder',
      STRAPI_URL: 'http://build-time-placeholder',
      STRAPI_API_TOKEN: 'build-time-placeholder-token-aaaaaaaaaaaaaaaaaaaaaaaaaa',
      PUBLIC_UPLOADS_URL: 'http://localhost:8080',
      REGISTRATION_SECRET: 'build-time-placeholder',
      NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test' || 'production',
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SMTP_USER: '',
      SMTP_PASSWORD: '',
      SMTP_SECURE: 'false' as const,
      EMAIL_FROM: 'noreply@fotbal-fm.cz',
      EMAIL_TO: 'info@fotbal-fm.cz',
      APP_URL: 'http://localhost:3000',
      WBOOST_API_BASE: undefined,
      WBOOST_CLIENT_ID: undefined,
      WBOOST_CLIENT_SECRET: undefined,
      WBOOST_PROJECT_ID: undefined,
      WBOOST_THUMBNAILS: 'false' as const,
    };
  }

  try {
    return envSchema.parse({
      SESSION_SECRET: process.env.SESSION_SECRET,
      STRAPI_URL: process.env.STRAPI_URL,
      STRAPI_API_TOKEN: process.env.STRAPI_API_TOKEN,
      PUBLIC_UPLOADS_URL: process.env.PUBLIC_UPLOADS_URL,
      REGISTRATION_SECRET: process.env.REGISTRATION_SECRET,
      NODE_ENV: process.env.NODE_ENV,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASSWORD: process.env.SMTP_PASSWORD,
      SMTP_SECURE: process.env.SMTP_SECURE,
      EMAIL_FROM: process.env.EMAIL_FROM,
      EMAIL_TO: process.env.EMAIL_TO,
      APP_URL: process.env.APP_URL,
      WBOOST_API_BASE: process.env.WBOOST_API_BASE,
      WBOOST_CLIENT_ID: process.env.WBOOST_CLIENT_ID,
      WBOOST_CLIENT_SECRET: process.env.WBOOST_CLIENT_SECRET,
      WBOOST_PROJECT_ID: process.env.WBOOST_PROJECT_ID,
      WBOOST_THUMBNAILS: process.env.WBOOST_THUMBNAILS,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
      throw new Error(
        `❌ Invalid environment variables:\n${missingVars}\n\nPlease check your .env.local file against .env.example`
      );
    }
    throw error;
  }
}

/**
 * Validated environment configuration
 * Use this instead of accessing process.env directly
 */
export const config = validateEnv();

/**
 * Application constants
 */
export const constants = {
  // Session configuration
  SESSION_MAX_AGE: 60 * 60 * 24 * 7, // 7 days in seconds
  SESSION_COOKIE_NAME: 'session',

  // API configuration
  API_TIMEOUT: 10000, // 10 seconds

  // File upload limits
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,

  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

/**
 * Get the Strapi API URL (server-side only)
 */
export function getStrapiUrl(): string {
  return config.STRAPI_URL;
}

/**
 * Get the public uploads URL (accessible from browser)
 * Used for serving uploaded images and other static assets via nginx
 */
export function getPublicUploadsUrl(): string {
  return config.PUBLIC_UPLOADS_URL;
}

/**
 * Check if application is in production mode
 */
export function isProduction(): boolean {
  return config.NODE_ENV === 'production';
}

/**
 * Check if application is in development mode
 */
export function isDevelopment(): boolean {
  return config.NODE_ENV === 'development';
}

/**
 * Resolved WBoost Brand-Manuals API configuration (server-side only).
 */
export interface WboostConfig {
  /** API host for OAuth token + templates + export + thumbnails (e.g. http://host.docker.internal:8099). */
  apiBase: string;
  clientId: string;
  clientSecret: string;
  projectId: string;
  /**
   * Whether picker thumbnails are served from the API host. Off by default until
   * the API exposes a thumbnail endpoint; when off the picker shows text cards.
   * We never reach the object store directly.
   */
  thumbnailsEnabled: boolean;
}

/**
 * Get the WBoost export configuration.
 * Throws a friendly AppError (503) if the feature is not configured, so a missing
 * env var only fails when the export feature is actually used — never on app boot.
 */
export function getWboostConfig(): WboostConfig {
  const {
    WBOOST_API_BASE,
    WBOOST_CLIENT_ID,
    WBOOST_CLIENT_SECRET,
    WBOOST_PROJECT_ID,
    WBOOST_THUMBNAILS,
  } = config;

  if (
    !WBOOST_API_BASE ||
    !WBOOST_CLIENT_ID ||
    !WBOOST_CLIENT_SECRET ||
    !WBOOST_PROJECT_ID
  ) {
    throw new AppError(
      'Export šablon není nakonfigurován (chybí WBOOST_* proměnné prostředí).',
      ErrorCode.INTERNAL_ERROR,
      503
    );
  }

  return {
    apiBase: WBOOST_API_BASE.replace(/\/$/, ''),
    clientId: WBOOST_CLIENT_ID,
    clientSecret: WBOOST_CLIENT_SECRET,
    projectId: WBOOST_PROJECT_ID,
    thumbnailsEnabled: WBOOST_THUMBNAILS === 'true',
  };
}

/**
 * Whether the WBoost export feature is configured.
 */
export function isWboostConfigured(): boolean {
  return Boolean(
    config.WBOOST_API_BASE &&
      config.WBOOST_CLIENT_ID &&
      config.WBOOST_CLIENT_SECRET &&
      config.WBOOST_PROJECT_ID
  );
}
