import type { DeepLink, DeepLinkStatus } from '@/lib/types';
import type { StrapiRawDeepLink } from '../types';

export function deepLinkStatus(raw: Pick<StrapiRawDeepLink, 'active' | 'expiresAt'>, now: Date = new Date()): DeepLinkStatus {
  if (raw.active === false) return 'inactive';
  if (raw.expiresAt && new Date(raw.expiresAt).getTime() <= now.getTime()) return 'expired';
  return 'valid';
}

export function mapDeepLink(raw: StrapiRawDeepLink, now: Date = new Date()): DeepLink {
  const categories = [...(raw.audienceCategories ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'cs'),
  );
  return {
    code: raw.code,
    url: raw.url,
    name: raw.name,
    status: deepLinkStatus(raw, now),
    audienceCategories: categories.map((c) => ({ slug: c.slug, name: c.name, description: c.description ?? null })),
  };
}
