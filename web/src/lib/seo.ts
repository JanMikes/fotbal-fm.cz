import type { Metadata } from 'next';
import { config } from '@/lib/config';

export const SITE_NAME = 'FK Frýdek-Místek';
export const SITE_URL = config.siteUrl || 'https://www.fotbal-fm.cz';

export const SITE_DESCRIPTION =
  'Oficiální web Fotbalu Frýdek-Místek (FK Frýdek-Místek), známého také jako Válcovny nebo Lipina. ' +
  'Sledujte A-tým, B-tým, mládež, výsledky, program zápasů, vstupenky, permanentky i klubové novinky.';

/** Google typically truncates the snippet around here. */
const MAX_DESCRIPTION_LENGTH = 160;

/**
 * Turns editor-written content (HTML or markdown) into a plain-text meta description,
 * cut at a word boundary. Falls back when the source is empty after stripping.
 */
export function toDescription(raw: string | null | undefined, fallback: string): string {
  const text = (raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return fallback;
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text;

  const cut = text.slice(0, MAX_DESCRIPTION_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = lastSpace > MAX_DESCRIPTION_LENGTH / 2 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/[\s.,;:–—-]+$/, '')}…`;
}

interface PageMetadataOptions {
  /** Page title without the site suffix — the suffix is appended here. */
  title: string;
  description: string;
  /** Canonical path, e.g. `/novinky` (resolved against metadataBase). */
  path: string;
  image?: string | null;
  type?: 'website' | 'article' | 'profile';
  noIndex?: boolean;
}

/**
 * Single source of truth for per-page metadata: title, unique description,
 * canonical URL and matching Open Graph / Twitter tags.
 *
 * Next.js replaces the whole `openGraph` object when a page defines one, so every
 * page must emit its own — inheriting the layout's would re-use the site description.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  type = 'website',
  noIndex = false,
}: PageMetadataOptions): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      locale: 'cs_CZ',
      siteName: SITE_NAME,
      url: path,
      title: fullTitle,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
