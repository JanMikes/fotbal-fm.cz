import type { BreadcrumbItem, DynamicZoneComponent, Page } from '@/lib/types';
import type { StrapiRawDynamicZoneComponent, StrapiRawPage, StrapiRawPageParent } from '../types';
import { resolveTextLink } from '../link-resolver';
import { mapMedia } from './shared';
import { mapCategory } from './category';

function buildBreadcrumbs(parent: StrapiRawPageParent | null | undefined, currentTitle: string, currentSlug: string): BreadcrumbItem[] {
  const chain: BreadcrumbItem[] = [];
  let node = parent;
  while (node) {
    chain.push({ label: node.title, href: `/${node.slug}` });
    node = node.parent;
  }
  chain.reverse();
  chain.push({ label: currentTitle, href: `/${currentSlug}` });
  return chain;
}

export function mapPage(raw: StrapiRawPage): Page {
  return {
    documentId: raw.documentId,
    title: raw.title,
    slug: raw.slug,
    metaDescription: raw.meta_description ?? null,
    breadcrumbs: buildBreadcrumbs(raw.parent, raw.title, raw.slug),
    content: mapDynamicZone(raw.content),
    sidebar: mapDynamicZone(raw.sidebar ?? []),
  };
}

export function mapDynamicZone(components: StrapiRawDynamicZoneComponent[]): DynamicZoneComponent[] {
  if (!components) return [];
  return components.map(mapDynamicZoneComponent).filter((c): c is DynamicZoneComponent => c !== null);
}

function mapDynamicZoneComponent(raw: StrapiRawDynamicZoneComponent): DynamicZoneComponent | null {
  const base = { id: raw.id, __component: raw.__component };

  switch (raw.__component) {
    case 'components.text':
      return { ...base, __component: 'components.text', text: (raw.text as string) ?? null };

    case 'components.heading':
      return {
        ...base,
        __component: 'components.heading',
        text: (raw.text as string) ?? null,
        type: (raw.type as 'h2' | 'h3' | 'h4' | 'h5' | 'h6') ?? 'h2',
        anchor: (raw.anchor as string) ?? null,
      };

    case 'components.alert':
      return {
        ...base,
        __component: 'components.alert',
        type: (raw.type as 'info' | 'success' | 'warning' | 'error') ?? 'info',
        title: (raw.title as string) ?? null,
        text: (raw.text as string) ?? null,
      };

    case 'components.links-list':
      return {
        ...base,
        __component: 'components.links-list',
        links: mapTextLinks(raw.links),
        layout: (raw.layout as 'Grid' | 'Rows') ?? 'Rows',
      };

    case 'components.video':
      return {
        ...base,
        __component: 'components.video',
        youtube_id: (raw.youtube_id as string) ?? null,
        aspect_ratio: (raw.aspect_ratio as '16:9' | '4:3' | '1:1') ?? '16:9',
      };

    case 'components.feature-cards':
      return {
        ...base,
        __component: 'components.feature-cards',
        cards: mapCards(raw.cards),
        columns: (raw.columns as '2' | '3' | '4') ?? '3',
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
        columns: (raw.columns as '1' | '2' | '3') ?? '3',
      };

    case 'components.partner-logos':
      return {
        ...base,
        __component: 'components.partner-logos',
        partners: mapPartners(raw.partners),
        grayscale: (raw.grayscale as boolean) ?? false,
        columns: (raw.columns as '2' | '3' | '4' | '5' | '6') ?? '4',
      };

    case 'components.stats-highlights':
      return {
        ...base,
        __component: 'components.stats-highlights',
        items: mapSimpleItems(raw.items),
        columns: (raw.columns as '2' | '3' | '4') ?? '4',
      };

    case 'components.timeline':
      return {
        ...base,
        __component: 'components.timeline',
        items: mapSimpleItems(raw.items),
        collapsible: (raw.collapsible as boolean) ?? false,
        style: (raw.style as 'style1' | 'style2') ?? 'style1',
      };

    case 'components.section-divider':
      return {
        ...base,
        __component: 'components.section-divider',
        spacing: (raw.spacing as 'S' | 'M' | 'L') ?? 'M',
        style: (raw.style as 'solid' | 'dashed' | 'dotted') ?? 'solid',
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
        columns: (raw.columns as '2' | '3' | '4') ?? '3',
      };

    case 'components.button-group':
      return {
        ...base,
        __component: 'components.button-group',
        buttons: mapButtons(raw.buttons),
        alignment: (raw.alignment as 'L' | 'C' | 'R') ?? 'L',
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

    case 'components.popup':
      return {
        ...base,
        __component: 'components.popup',
        title: (raw.title as string) ?? null,
        description: (raw.description as string) ?? null,
        link: resolveTextLink(raw.link as Parameters<typeof resolveTextLink>[0]),
        rememberDismissal: (raw.rememberDismissal as boolean) ?? false,
      };

    case 'components.badges':
      return {
        ...base,
        __component: 'components.badges',
        badges: mapBadges(raw.badges),
        alignment: (raw.alignment as 'L' | 'C' | 'R') ?? 'L',
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
        categories: Array.isArray(raw.categories) ? raw.categories.map(mapCategory) : [],
        newsArticleType: raw.news_article_type
          ? { documentId: (raw.news_article_type as Record<string, string>).documentId, name: (raw.news_article_type as Record<string, string>).name, slug: (raw.news_article_type as Record<string, string>).slug }
          : null,
        limit: (raw.limit as number) ?? 6,
        show_all_link: resolveTextLink(raw.show_all_link as Parameters<typeof resolveTextLink>[0]),
      };

    default:
      return null;
  }
}

// Helper mappers

function mapTextLinks(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((l) => resolveTextLink(l)).filter((l) => l !== null);
}

function mapCards(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => ({
    icon: mapMedia(c.icon),
    title: c.title ?? null,
    description: c.description ?? null,
    link: resolveTextLink(c.link),
  }));
}

function mapDocuments(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((d) => ({
    name: d.name ?? null,
    file: mapMedia(d.file),
  }));
}

function mapPartners(raw: unknown) {
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
    link: resolveTextLink(s.link),
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
    link: resolveTextLink(b.link),
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
