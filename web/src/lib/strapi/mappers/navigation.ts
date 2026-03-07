import type { NavigationItem } from '@/lib/types';
import type { StrapiRawNavigation } from '../types';
import { resolveLink } from '../link-resolver';

export function mapNavigation(raw: StrapiRawNavigation): NavigationItem | null {
  const resolved = resolveLink(raw.link);
  if (!resolved) return null;

  return {
    title: raw.title,
    href: resolved.href,
    external: resolved.external,
  };
}
