import type { CategoryGroup } from '@/lib/types';
import type { StrapiRawCategoryGroup } from '../types';
import { mapCategory } from './category';

export function mapCategoryGroup(raw: StrapiRawCategoryGroup): CategoryGroup {
  const categories = (raw.categories ?? [])
    .filter((c) => !c.hidden)
    .sort((a, b) => (a.sortOrderInGroup ?? 0) - (b.sortOrderInGroup ?? 0))
    .map(mapCategory);

  return {
    documentId: raw.documentId,
    name: raw.name,
    slug: raw.slug,
    sortOrder: raw.sortOrder ?? 0,
    categories,
    firstCategorySlug: categories[0]?.slug ?? '',
  };
}
