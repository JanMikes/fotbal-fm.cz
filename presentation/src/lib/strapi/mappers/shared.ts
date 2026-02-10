import { config } from '@/lib/config';
import type { MediaImage } from '@/lib/types';
import type { StrapiRawMedia } from '../types';

export function transformImageUrl(url: string): string {
  if (url.startsWith('/uploads/')) {
    return `${config.publicUploadsUrl}${url}`;
  }
  return url;
}

export function mapMedia(raw: StrapiRawMedia | null | undefined): MediaImage | null {
  if (!raw?.url) return null;
  return {
    url: transformImageUrl(raw.url),
    alternativeText: raw.alternativeText,
    width: raw.width,
    height: raw.height,
  };
}

export function mapMediaArray(raw: StrapiRawMedia[] | null | undefined): MediaImage[] {
  if (!raw) return [];
  return raw.map(mapMedia).filter((m): m is MediaImage => m !== null);
}
