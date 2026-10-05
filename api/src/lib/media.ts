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

/**
 * Detect the image type from magic bytes. Returns null for anything that is
 * not an image we recognise — e.g. the HTML page an expired session or a
 * redirect returns instead of a photo, which must never be uploaded.
 */
export function detectImageType(buffer: Buffer): { mime: string; ext: string } | null {
  const hex = buffer.subarray(0, 4).toString('hex');
  if (hex.startsWith('ffd8ff')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (hex === '89504e47') return { mime: 'image/png', ext: 'png' };
  if (hex.startsWith('474946')) return { mime: 'image/gif', ext: 'gif' };
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}
