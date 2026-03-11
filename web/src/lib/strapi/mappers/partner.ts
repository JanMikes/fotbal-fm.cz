import type { Partner, PartnerDetail } from '@/lib/types';
import type { StrapiRawPartner } from '../types';
import { mapMedia } from './shared';
import { mapDynamicZone } from './page';

export function mapPartner(raw: StrapiRawPartner): Partner {
  return {
    documentId: raw.documentId,
    name: raw.name,
    slug: raw.slug,
    logo: mapMedia(raw.logo),
    description: raw.description ?? null,
    sortOrder: raw.sortOrder ?? 0,
    partnerCategory: raw.partnerCategory ? { name: raw.partnerCategory.name } : null,
  };
}

export function mapPartnerDetail(raw: StrapiRawPartner): PartnerDetail {
  return {
    ...mapPartner(raw),
    content: mapDynamicZone(raw.content ?? []),
    panel: mapDynamicZone(raw.panel ?? []),
  };
}
