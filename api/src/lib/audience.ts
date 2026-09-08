import { buildStrapiQueryString } from '@fotbal-fm/strapi-client';
import { strapiGet, strapiGetSingle, strapiPut } from './strapi.js';
import type { StrapiRawAudienceCategory, StrapiRawUser } from '../types/strapi.js';

/**
 * All Strapi access for users' audience categories lives here. Reads and writes use the
 * service API token; the caller's JWT is only ever used to find out who they are
 * (`getCurrentUser`). That is what keeps one user from touching another's categories.
 */

export const AUDIENCE_CATEGORY_FIELDS = ['name', 'slug', 'description', 'sortOrder', 'selectable'];

export interface CurrentUser {
  id: number;
  username: string;
  email: string;
}

export class AuthRequiredError extends Error {}

/** Resolves the caller from their JWT; throws AuthRequiredError on a missing/expired token. */
export async function getCurrentUser(jwt: string): Promise<CurrentUser> {
  try {
    const user = await strapiGetSingle<StrapiRawUser>('/users/me', jwt);
    return { id: user.id, username: user.username, email: user.email };
  } catch {
    throw new AuthRequiredError('Neplatný nebo expirovaný token');
  }
}

export async function listAudienceCategories(): Promise<StrapiRawAudienceCategory[]> {
  const result = await strapiGet<StrapiRawAudienceCategory>('/audience-categories', {
    sort: 'sortOrder:asc',
    pagination: { pageSize: 100 },
  });
  return result?.data ?? [];
}

export async function fetchUserAudienceCategories(userId: number): Promise<StrapiRawAudienceCategory[]> {
  const qs = buildStrapiQueryString({
    populate: { audienceCategories: { fields: AUDIENCE_CATEGORY_FIELDS } },
  });
  const user = await strapiGetSingle<StrapiRawUser>(`/users/${userId}${qs}`);
  return user?.audienceCategories ?? [];
}

/** Replaces the user's categories with exactly `categoryIds` (Strapi numeric ids). */
export async function setUserAudienceCategories(userId: number, categoryIds: number[]): Promise<void> {
  await strapiPut(`/users/${userId}`, { audienceCategories: categoryIds });
}
