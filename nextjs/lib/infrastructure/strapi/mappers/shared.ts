/**
 * Shared mapper utilities for Strapi responses.
 * Handles common patterns like media mapping, user info extraction, and URL transformation.
 */

import { StrapiImage, StrapiFile, UserInfo } from '@/types/match-result';
import { StrapiRawUserInfo } from '../types';
import { getPublicUploadsUrl } from '@/lib/config';

/**
 * Minimal media interface that works with both TypeScript types and Zod inferred types
 */
interface RawMediaLike {
  id: number;
  name: string;
  alternativeText?: string | null;
  caption?: string | null;
  width?: number;
  height?: number;
  formats?: {
    thumbnail?: { url: string; width: number; height: number };
    small?: { url: string; width: number; height: number };
    medium?: { url: string; width: number; height: number };
    large?: { url: string; width: number; height: number };
  } | null;
  url: string;
  previewUrl?: string | null;
  provider: string;
  size: number;
  ext: string;
  mime: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// URL Transformation
// =============================================================================

/**
 * Transform image URL to use the public uploads URL (nginx)
 * This ensures images are served via nginx with proper cache headers
 */
export function transformImageUrl(url: string): string {
  if (url.startsWith('/uploads/')) {
    return `${getPublicUploadsUrl()}${url}`;
  }
  return url;
}

/**
 * Transform all URLs in image formats object
 */
export function transformImageFormats(formats: RawMediaLike['formats']): StrapiImage['formats'] {
  if (!formats) return {};

  const transformed: StrapiImage['formats'] = {};

  if (formats.thumbnail) {
    transformed.thumbnail = {
      url: transformImageUrl(formats.thumbnail.url),
      width: formats.thumbnail.width,
      height: formats.thumbnail.height,
    };
  }
  if (formats.small) {
    transformed.small = {
      url: transformImageUrl(formats.small.url),
      width: formats.small.width,
      height: formats.small.height,
    };
  }
  if (formats.medium) {
    transformed.medium = {
      url: transformImageUrl(formats.medium.url),
      width: formats.medium.width,
      height: formats.medium.height,
    };
  }
  if (formats.large) {
    transformed.large = {
      url: transformImageUrl(formats.large.url),
      width: formats.large.width,
      height: formats.large.height,
    };
  }

  return transformed;
}

// =============================================================================
// Media Mapping
// =============================================================================

/**
 * Map a single raw media item to StrapiImage
 */
export function mapRawMediaToImage(media: RawMediaLike): StrapiImage {
  return {
    id: media.id,
    name: media.name,
    alternativeText: media.alternativeText ?? null,
    caption: media.caption ?? null,
    width: media.width ?? 0,
    height: media.height ?? 0,
    formats: transformImageFormats(media.formats),
    url: transformImageUrl(media.url),
    previewUrl: media.previewUrl ?? null,
    provider: media.provider,
    size: media.size,
    ext: media.ext,
    mime: media.mime,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
  };
}

/**
 * Map a single raw media item to StrapiFile
 */
export function mapRawMediaToFile(media: RawMediaLike): StrapiFile {
  return {
    id: media.id,
    name: media.name,
    alternativeText: media.alternativeText ?? null,
    caption: media.caption ?? null,
    url: transformImageUrl(media.url),
    previewUrl: media.previewUrl ?? null,
    provider: media.provider,
    size: media.size,
    ext: media.ext,
    mime: media.mime,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
  };
}

/**
 * Map raw media array to StrapiImage array
 * Handles both flattened and nested Strapi response structures
 */
export function mapMediaToImages(media: RawMediaLike[] | undefined | null): StrapiImage[] {
  if (!media || !Array.isArray(media)) {
    return [];
  }
  return media.map(mapRawMediaToImage);
}

/**
 * Map raw media array to StrapiFile array
 * Handles both flattened and nested Strapi response structures
 */
export function mapMediaToFiles(media: RawMediaLike[] | undefined | null): StrapiFile[] {
  if (!media || !Array.isArray(media)) {
    return [];
  }
  return media.map(mapRawMediaToFile);
}

// =============================================================================
// User Info Mapping
// =============================================================================

/**
 * Extract user info from various Strapi response structures
 * Handles both flattened and nested formats
 */
export function mapUserInfo(
  userData: StrapiRawUserInfo | { data?: StrapiRawUserInfo | null } | undefined | null
): UserInfo | undefined {
  if (!userData) return undefined;

  // Handle nested structure: { data: { id, firstname, lastname, email } }
  if ('data' in userData) {
    const nested = userData.data;
    if (!nested) return undefined;
    return {
      id: nested.id,
      firstName: nested.firstname ?? '',
      lastName: nested.lastname ?? '',
      email: nested.email,
    };
  }

  // Handle flattened structure: { id, firstname, lastname, email }
  const raw = userData as StrapiRawUserInfo;
  if (!raw.id) return undefined;

  return {
    id: raw.id,
    firstName: raw.firstname ?? '',
    lastName: raw.lastname ?? '',
    email: raw.email,
  };
}

/**
 * Extract user ID from various Strapi response structures
 */
export function extractUserId(
  userData: StrapiRawUserInfo | { data?: StrapiRawUserInfo | null } | undefined | null
): number | undefined {
  if (!userData) return undefined;

  // Handle nested structure
  if ('data' in userData) {
    return userData.data?.id;
  }

  // Handle flattened structure
  return (userData as StrapiRawUserInfo).id;
}

// =============================================================================
// Null Coalescing Helpers
// =============================================================================

/**
 * Convert null to undefined for optional string fields
 */
export function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

/**
 * Convert empty string or null to undefined
 */
export function emptyToUndefined(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  return value;
}
