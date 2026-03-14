import type { Footer, FooterLinkSection, FooterPartner, FooterPartnerSection } from '@/lib/types';
import type { StrapiRawFooter, StrapiRawFooterLinkSection, StrapiRawFooterPartner, StrapiRawFooterPartnerSection } from '../types';
import { resolveTextLink } from '../link-resolver';
import { mapMedia } from './shared';

function mapFooterLinkSection(raw: StrapiRawFooterLinkSection): FooterLinkSection {
  return {
    title: raw.title,
    links: (raw.links ?? [])
      .map(resolveTextLink)
      .filter((link): link is NonNullable<typeof link> => link !== null),
  };
}

function mapFooterPartner(raw: StrapiRawFooterPartner): FooterPartner {
  return {
    name: raw.name,
    logo: mapMedia(raw.logo),
    link: raw.link ?? null,
  };
}

function mapFooterPartnerSection(raw: StrapiRawFooterPartnerSection): FooterPartnerSection {
  return {
    title: raw.title,
    partners: (raw.partners ?? []).map(mapFooterPartner),
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
    partnerSections: (raw.partnerSections ?? []).map(mapFooterPartnerSection),
  };
}
