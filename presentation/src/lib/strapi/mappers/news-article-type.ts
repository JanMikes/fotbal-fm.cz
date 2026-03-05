import type { NewsArticleType } from '@/lib/types';
import type { StrapiRawNewsArticleType } from '../types';

export function mapNewsArticleTypes(
  raw: StrapiRawNewsArticleType[] | null | undefined,
): NewsArticleType[] {
  if (!raw) return [];
  return raw.map((item) => ({
    documentId: item.documentId,
    name: item.name,
    slug: item.slug,
  }));
}
