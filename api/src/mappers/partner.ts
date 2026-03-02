import { mapMedia, mapMediaArray } from '../lib/media.js';
import type { StrapiRawDynamicZoneComponent, StrapiRawPartner } from '../types/strapi.js';

export function mapPartnerSummary(raw: StrapiRawPartner) {
  return {
    documentId: raw.documentId,
    name: raw.name,
    slug: raw.slug,
    logo: mapMedia(raw.logo),
    description: raw.description ?? null,
    sortOrder: raw.sortOrder,
  };
}

export function mapPartnerDetail(raw: StrapiRawPartner) {
  return {
    ...mapPartnerSummary(raw),
    content: mapDynamicZone(raw.content),
    panel: mapDynamicZone(raw.panel ?? []),
  };
}

function mapDynamicZone(components: StrapiRawDynamicZoneComponent[]) {
  if (!components) return [];
  return components.map(mapDynamicZoneComponent).filter((c) => c !== null);
}

function mapDynamicZoneComponent(raw: StrapiRawDynamicZoneComponent) {
  const base = { id: raw.id, __component: raw.__component };

  switch (raw.__component) {
    case 'components.text':
      return { ...base, __component: 'components.text', text: (raw.text as string) ?? null };

    case 'components.heading':
      return {
        ...base,
        __component: 'components.heading',
        text: (raw.text as string) ?? null,
        type: (raw.type as string) ?? 'h2',
        anchor: (raw.anchor as string) ?? null,
      };

    case 'components.alert':
      return {
        ...base,
        __component: 'components.alert',
        type: (raw.type as string) ?? 'info',
        title: (raw.title as string) ?? null,
        text: (raw.text as string) ?? null,
      };

    case 'components.links-list':
      return {
        ...base,
        __component: 'components.links-list',
        links: mapTextLinks(raw.links),
        layout: (raw.layout as string) ?? 'Rows',
      };

    case 'components.video':
      return {
        ...base,
        __component: 'components.video',
        youtube_id: (raw.youtube_id as string) ?? null,
        aspect_ratio: (raw.aspect_ratio as string) ?? '16:9',
      };

    case 'components.feature-cards':
      return {
        ...base,
        __component: 'components.feature-cards',
        cards: mapCards(raw.cards),
        columns: (raw.columns as string) ?? '3',
        card_clickable: (raw.card_clickable as boolean) ?? false,
      };

    case 'components.banner-cards':
      return {
        ...base,
        __component: 'components.banner-cards',
        cards: mapCards(raw.cards),
      };

    case 'components.documents':
      return {
        ...base,
        __component: 'components.documents',
        documents: mapDocuments(raw.documents),
        columns: (raw.columns as string) ?? '3',
      };

    case 'components.partner-logos':
      return {
        ...base,
        __component: 'components.partner-logos',
        partners: mapPartnerLogos(raw.partners),
        grayscale: (raw.grayscale as boolean) ?? false,
        columns: (raw.columns as string) ?? '4',
      };

    case 'components.stats-highlights':
      return {
        ...base,
        __component: 'components.stats-highlights',
        items: mapSimpleItems(raw.items),
        columns: (raw.columns as string) ?? '4',
      };

    case 'components.timeline':
      return {
        ...base,
        __component: 'components.timeline',
        items: mapSimpleItems(raw.items),
      };

    case 'components.section-divider':
      return {
        ...base,
        __component: 'components.section-divider',
        spacing: (raw.spacing as string) ?? 'M',
        style: (raw.style as string) ?? 'solid',
      };

    case 'components.slider':
      return {
        ...base,
        __component: 'components.slider',
        slides: mapSlides(raw.slides),
        autoplay: (raw.autoplay as boolean) ?? false,
        autoplay_interval: (raw.autoplay_interval as number) ?? 5000,
      };

    case 'components.gallery-slider':
      return {
        ...base,
        __component: 'components.gallery-slider',
        photos: mapPhotos(raw.photos),
      };

    case 'components.photo-gallery':
      return {
        ...base,
        __component: 'components.photo-gallery',
        photos: mapPhotos(raw.photos),
        columns: (raw.columns as string) ?? '3',
      };

    case 'components.button-group':
      return {
        ...base,
        __component: 'components.button-group',
        buttons: mapButtons(raw.buttons),
        alignment: (raw.alignment as string) ?? 'L',
      };

    case 'components.contact-cards':
      return {
        ...base,
        __component: 'components.contact-cards',
        cards: mapContactCards(raw.cards),
      };

    case 'components.accordion-sections':
      return {
        ...base,
        __component: 'components.accordion-sections',
        sections: mapExpandableSections(raw.sections),
      };

    case 'components.badges':
      return {
        ...base,
        __component: 'components.badges',
        badges: mapBadges(raw.badges),
        alignment: (raw.alignment as string) ?? 'L',
      };

    case 'components.image':
      return {
        ...base,
        __component: 'components.image',
        image: mapMedia(raw.image as Parameters<typeof mapMedia>[0]),
      };

    case 'components.news-articles':
      return {
        ...base,
        __component: 'components.news-articles',
        categories: mapCategoriesFromRaw(raw.categories),
        limit: (raw.limit as number) ?? 6,
      };

    default:
      return null;
  }
}

// Helper functions for dynamic zone mapping

function mapLink(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const page = r.page as { slug: string } | null;
  const file = r.file as Parameters<typeof mapMedia>[0];
  const url = r.url as string | null;
  const anchor = r.anchor as string | null;

  let href: string | null = null;
  let external = false;

  if (page?.slug) {
    href = `/${page.slug}`;
  } else if (url) {
    href = url;
    external = url.startsWith('http');
  } else if (file) {
    const mapped = mapMedia(file);
    if (mapped) {
      href = mapped.url;
      external = true;
    }
  } else if (anchor) {
    href = `#${anchor}`;
  }

  return href ? { href, external } : null;
}

function mapTextLink(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const link = mapLink(r);
  if (!link) return null;
  return {
    ...link,
    text: (r.text as string) ?? '',
    disabled: (r.disabled as boolean) ?? false,
  };
}

function mapTextLinks(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map(mapTextLink).filter((l) => l !== null);
}

function mapCards(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => ({
    title: c.title ?? null,
    description: c.description ?? null,
    link: mapTextLink(c.link),
  }));
}

function mapDocuments(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((d) => ({
    name: d.name ?? null,
    file: mapMedia(d.file),
  }));
}

function mapPartnerLogos(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => ({
    name: p.name ?? null,
    logo: mapMedia(p.logo),
    url: p.url ?? null,
  }));
}

function mapSimpleItems(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((i) => ({
    number: i.number ?? null,
    title: i.title ?? null,
    description: i.description ?? null,
  }));
}

function mapSlides(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => ({
    title: s.title ?? null,
    description: s.description ?? null,
    link: mapTextLink(s.link),
    image: mapMedia(s.image),
    background_image: mapMedia(s.background_image),
  }));
}

function mapPhotos(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => ({
    image: mapMedia(p.image),
  }));
}

function mapButtons(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((b) => ({
    link: mapTextLink(b.link),
    variant: b.variant ?? 'Primary',
    size: b.size ?? 'M',
  }));
}

function mapContactCards(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => ({
    name: c.name ?? '',
    role: c.role ?? null,
    phone: c.phone ?? null,
    email: c.email ?? null,
    photo: mapMedia(c.photo),
  }));
}

function mapExpandableSections(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => ({
    title: s.title ?? null,
    description: s.description ?? null,
    default_open: s.default_open ?? false,
    files: mapDocuments(s.files),
    photos: mapPhotos(s.photos),
  }));
}

function mapBadges(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((b) => ({
    label: b.label ?? '',
    variant: b.variant ?? 'default',
    size: b.size ?? 'M',
  }));
}

function mapCategoriesFromRaw(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => ({
    documentId: c.documentId,
    name: c.name,
    slug: c.slug,
  }));
}
