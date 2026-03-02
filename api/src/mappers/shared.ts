import type { StrapiRawCategory } from '@fotbal-fm/strapi-client';
import { mapMedia } from '../lib/media.js';
import type { StrapiRawTeam } from '../types/strapi.js';

export function mapCategory(raw: StrapiRawCategory) {
  return {
    documentId: raw.documentId,
    name: raw.name,
    slug: raw.slug,
  };
}

export function mapCategories(raw: StrapiRawCategory[] | null | undefined) {
  if (!raw) return [];
  return raw.map(mapCategory);
}

export function mapTeam(raw: StrapiRawTeam | null | undefined) {
  if (!raw) return null;
  return {
    name: raw.name,
    logo: mapMedia(raw.logo),
  };
}
