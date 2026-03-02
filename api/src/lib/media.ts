import type { StrapiRawMedia } from '@fotbal-fm/strapi-client';

const PUBLIC_UPLOADS_URL = process.env.PUBLIC_UPLOADS_URL || 'http://localhost:8080';

export function resolveMediaUrl(url: string): string {
  if (url.startsWith('/uploads/')) {
    return `${PUBLIC_UPLOADS_URL}${url}`;
  }
  return url;
}

export interface MediaImage {
  url: string;
  alternativeText: string | null;
  width: number;
  height: number;
}

export function mapMedia(raw: StrapiRawMedia | null | undefined): MediaImage | null {
  if (!raw?.url) return null;
  return {
    url: resolveMediaUrl(raw.url),
    alternativeText: raw.alternativeText ?? null,
    width: raw.width ?? 0,
    height: raw.height ?? 0,
  };
}

export function mapMediaArray(raw: StrapiRawMedia[] | null | undefined): MediaImage[] {
  if (!raw) return [];
  return raw.map(mapMedia).filter((m): m is MediaImage => m !== null);
}
