import type { Footer, FooterLinkSection } from '@/lib/types';
import type { StrapiRawFooter, StrapiRawFooterLinkSection } from '../types';
import { resolveTextLink } from '../link-resolver';

function mapFooterLinkSection(raw: StrapiRawFooterLinkSection): FooterLinkSection {
  return {
    title: raw.title,
    links: (raw.links ?? [])
      .map(resolveTextLink)
      .filter((link): link is NonNullable<typeof link> => link !== null),
  };
}

export function mapFooter(raw: StrapiRawFooter): Footer {
  const sections = (raw.linkSections ?? [])
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(mapFooterLinkSection);

  const bottomLinks = (raw.bottomLinks ?? [])
    .map(resolveTextLink)
    .filter((link): link is NonNullable<typeof link> => link !== null);

  return {
    text: raw.text ?? null,
    address: raw.address ?? null,
    mail: raw.mail ?? null,
    phone: raw.phone ?? null,
    linkSections: sections,
    bottomLinks,
  };
}
