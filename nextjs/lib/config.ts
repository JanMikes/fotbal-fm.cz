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

  // Registration secret
  REGISTRATION_SECRET: z.string().min(1, 'REGISTRATION_SECRET is required').optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Validates and parses environment variables
 * Throws an error if validation fails
 */
function validateEnv() {
  try {
    return envSchema.parse({
      SESSION_SECRET: process.env.SESSION_SECRET,
      STRAPI_URL: process.env.STRAPI_URL,
      STRAPI_API_TOKEN: process.env.STRAPI_API_TOKEN,
      REGISTRATION_SECRET: process.env.REGISTRATION_SECRET,
      NODE_ENV: process.env.NODE_ENV,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
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
 * Client-side should use relative paths for uploads via shared volume
 */
export function getStrapiUrl(): string {
  return config.STRAPI_URL;
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
