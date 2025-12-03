import { z } from 'zod';

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
});

/**
 * Check if we're in a build-time environment (Next.js build process)
 * During build, we don't have access to runtime environment variables
 */
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

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
