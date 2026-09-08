import type { StrapiRawAudienceCategory, StrapiRawDeepLink } from '../types/strapi.js';

export interface AudienceCategory {
  documentId: string;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
  selectable: boolean;
}

export function mapAudienceCategory(raw: StrapiRawAudienceCategory): AudienceCategory {
  return {
    documentId: raw.documentId,
    slug: raw.slug,
    name: raw.name,
    description: raw.description ?? null,
    sortOrder: raw.sortOrder ?? 0,
    selectable: raw.selectable !== false,
  };
}

export function sortAudienceCategories<T extends { sortOrder: number | null; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'cs'));
}

export function mapAudienceCategories(raw: StrapiRawAudienceCategory[] | null | undefined): AudienceCategory[] {
  return sortAudienceCategories(raw ?? []).map(mapAudienceCategory);
}

export function mapDeepLink(raw: StrapiRawDeepLink) {
  return {
    code: raw.code,
    url: raw.url,
    name: raw.name,
    active: raw.active !== false,
    expiresAt: raw.expiresAt ?? null,
    audienceCategories: mapAudienceCategories(raw.audienceCategories),
  };
}
