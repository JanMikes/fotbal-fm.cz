import { cache } from 'react';
import { isPlausibleSlug } from '@/lib/slug';
import { getCategorySlugIndex, getPageSlugIndex } from '@/lib/strapi/data';

/*
 * Membership guards for the dynamic routes scanners love. Each one answers "can this slug
 * exist?" from a cached index of all slugs, so an unknown slug 404s with zero Strapi calls and
 * leaves no per-slug cache key behind. When the index itself is unavailable (Strapi failing,
 * index `null`), the guard lets the request through to the real lookup — today's behaviour —
 * rather than 404ing every page during a Strapi blip.
 *
 * Wrapped in React cache(): the layout, generateMetadata and the page all ask once per request.
 */

/** `/[slug]` — a CMS page. */
export const isKnownPageSlug = cache(async (slug: string): Promise<boolean> => {
  if (!isPlausibleSlug(slug)) return false;
  const index = await getPageSlugIndex();
  return index === null || index.includes(slug);
});

/** `/kategorie/[category]/…` — a category, hidden ones included. */
export const isKnownCategorySlug = cache(async (slug: string): Promise<boolean> => {
  if (!isPlausibleSlug(slug)) return false;
  const index = await getCategorySlugIndex();
  return index === null || index.includes(slug);
});
