import type { NewsArticleType } from '@/lib/types';
import type { StrapiRawNewsArticleType } from '../types';

export function mapNewsArticleType(
  raw: StrapiRawNewsArticleType | null | undefined,
): NewsArticleType | null {
  if (!raw) return null;
  return {
    documentId: raw.documentId,
    name: raw.name,
    slug: raw.slug,
  };
}
