import { SOCIAL_NETWORKS, type SocialLink, type SocialNetwork } from '@/lib/types';
import type { StrapiRawSocialNetwork } from '../types';

const LABELS: Partial<Record<SocialNetwork, string>> = { Eshop: 'E-shop', Web: 'Web' };
/** Strapi caps the list at 5; the header has room for no more. */
export const MAX_SOCIAL_LINKS = 5;

function isSocialNetwork(value: string | null): value is SocialNetwork {
  return (SOCIAL_NETWORKS as readonly string[]).includes(value ?? '');
}

/** Only absolute http(s) URLs; an entry with an unknown network or a bad URL is dropped. */
function safeHref(url: string | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

export function mapSocialLinks(raw: StrapiRawSocialNetwork): SocialLink[] {
  return (raw.links ?? [])
    .flatMap((link) => {
      const href = safeHref(link.url);
      if (!href || !isSocialNetwork(link.network)) return [];
      return [{ network: link.network, href, label: LABELS[link.network] ?? link.network }];
    })
    .slice(0, MAX_SOCIAL_LINKS);
}
