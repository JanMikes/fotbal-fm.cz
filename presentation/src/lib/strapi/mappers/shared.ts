import { config } from '@/lib/config';
import type { MediaFile, MediaImage } from '@/lib/types';
import type { StrapiRawMedia } from '../types';

export function transformImageUrl(url: string): string {
  if (url.startsWith('/uploads/')) {
    return `${config.publicUploadsUrl}${url}`;
  }
  return url;
}

export function transformContentUrls(html: string): string {
  return html.replace(/(src|href)="(\/uploads\/[^"]+)"/g, (_match, attr, path) => {
    return `${attr}="${config.publicUploadsUrl}${path}"`;
  });
}

export function mapMedia(raw: StrapiRawMedia | null | undefined): MediaImage | null {
  if (!raw?.url) return null;
  return {
    url: transformImageUrl(raw.url),
    alternativeText: raw.alternativeText ?? null,
    width: raw.width ?? 0,
    height: raw.height ?? 0,
  };
}

export function mapMediaArray(raw: StrapiRawMedia[] | null | undefined): MediaImage[] {
  if (!raw) return [];
  return raw.map(mapMedia).filter((m): m is MediaImage => m !== null);
}

export function mapFile(raw: StrapiRawMedia): MediaFile {
  return {
    url: transformImageUrl(raw.url),
    name: raw.name || raw.url.split('/').pop() || 'File',
  };
}

export function mapFileArray(raw: StrapiRawMedia[] | null | undefined): MediaFile[] {
  if (!raw) return [];
  return raw.map(mapFile);
}
