import type { FooterLinkSection } from '@/lib/types';
import type { StrapiRawFooterLinkSection } from '../types';
import { resolveTextLink } from '../link-resolver';

export function mapFooterLinkSection(raw: StrapiRawFooterLinkSection): FooterLinkSection {
  return {
    documentId: raw.documentId,
    title: raw.title,
    links: (raw.links ?? [])
      .map(resolveTextLink)
      .filter((link): link is NonNullable<typeof link> => link !== null),
  };
}
