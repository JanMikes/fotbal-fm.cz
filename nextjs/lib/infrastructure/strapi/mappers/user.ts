/**
 * User mapper.
 * Transforms raw Strapi user data into domain User type.
 */

import { z } from 'zod';
import { User } from '@/types/user';
import { StrapiRawUser } from '../types';
import { ValidationError } from '@/lib/core/errors';

/**
 * Zod schema for user validation
 */
const strapiRawUserSchema = z.object({
  id: z.number(),
  documentId: z.string().optional(),
  username: z.string(),
  email: z.string().email(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  jobTitle: z.string().optional(),
  confirmed: z.boolean(),
  blocked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Map raw Strapi user to domain User
 */
export function mapUser(raw: unknown): User {
  // Validate raw data structure
  const parseResult = strapiRawUserSchema.safeParse(raw);

  if (!parseResult.success) {
    console.error('[mapUser] Validation failed:', parseResult.error.issues);
    throw new ValidationError(
      'Neplatná data uživatele ze Strapi',
      { zodErrors: parseResult.error.issues, raw }
    );
  }

  const data = parseResult.data;

  return {
    id: data.id,
    email: data.email,
    username: data.username,
    firstName: data.firstname ?? '',
    lastName: data.lastname ?? '',
    jobTitle: data.jobTitle ?? '',
    confirmed: data.confirmed,
    blocked: data.blocked,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Safe mapper that returns null on failure instead of throwing
 */
export function safeMapUser(raw: unknown): User | null {
  try {
    return mapUser(raw);
  } catch (error) {
    console.error('[safeMapUser] Failed to map user:', error);
    return null;
  }
}
