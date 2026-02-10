import type { Category } from '@/lib/types';
import type { StrapiRawCategory } from '../types';

export function mapCategory(raw: StrapiRawCategory): Category {
  return {
    documentId: raw.documentId,
    name: raw.name,
    slug: raw.slug,
    sortOrder: raw.sortOrder ?? 0,
  };
}

export function mapCategories(raw: StrapiRawCategory[] | null | undefined): Category[] {
  if (!raw) return [];
  return raw.map(mapCategory);
}
