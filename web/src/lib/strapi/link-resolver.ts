import type { ResolvedLink, ResolvedTextLink } from '@/lib/types';
import type { StrapiRawLink, StrapiRawTextLink } from './types';
import { transformImageUrl } from './mappers/shared';
import { config } from '@/lib/config';

function resolveUrl(url: string): { href: string; external: boolean } {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { href: url, external: false };
  }

  if (config.siteUrl) {
    try {
      const siteOrigin = new URL(config.siteUrl).origin;
      const parsed = new URL(url);
      if (parsed.origin === siteOrigin) {
        return { href: parsed.pathname + parsed.search + parsed.hash, external: false };
      }
    } catch {
      // invalid URL, treat as external
    }
  }

  return { href: url, external: true };
}

export function resolveLink(raw: StrapiRawLink | null | undefined): ResolvedLink | null {
  if (!raw) return null;

  // Priority: page slug > url > file > anchor
  if (raw.page?.slug) {
    const anchor = raw.anchor ? `#${raw.anchor}` : '';
    return { href: `/${raw.page.slug}${anchor}`, external: false };
  }

  if (raw.url) {
    return resolveUrl(raw.url);
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
