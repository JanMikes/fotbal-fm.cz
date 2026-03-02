import type { ResolvedLink, ResolvedTextLink } from '@/lib/types';
import type { StrapiRawLink, StrapiRawTextLink } from './types';
import { transformImageUrl } from './mappers/shared';

export function resolveLink(raw: StrapiRawLink | null | undefined): ResolvedLink | null {
  if (!raw) return null;

  // Priority: page slug > url > file > anchor
  if (raw.page?.slug) {
    const anchor = raw.anchor ? `#${raw.anchor}` : '';
    return { href: `/${raw.page.slug}${anchor}`, external: false };
  }

  if (raw.url) {
    const isExternal = raw.url.startsWith('http://') || raw.url.startsWith('https://');
    return { href: raw.url, external: isExternal };
  }

  if (raw.file?.url) {
    return { href: transformImageUrl(raw.file.url), external: false };
  }

  if (raw.anchor) {
    return { href: `#${raw.anchor}`, external: false };
  }

  return null;
}

export function resolveTextLink(raw: StrapiRawTextLink | null | undefined): ResolvedTextLink | null {
  if (!raw) return null;

  const resolved = resolveLink(raw);
  if (!resolved) return null;

  return {
    ...resolved,
    text: raw.text || '',
    disabled: raw.disabled ?? false,
  };
}
