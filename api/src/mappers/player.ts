import { markdownToHtml } from '../lib/markdown.js';
import { mapMedia } from '../lib/media.js';
import type { StrapiRawPlayer } from '../types/strapi.js';
import { mapCategories } from './shared.js';

export function mapPlayer(raw: StrapiRawPlayer) {
  return {
    documentId: raw.documentId,
    name: raw.name,
    slug: raw.slug ?? null,
    type: raw.type,
    number: raw.number ?? null,
    position: raw.position ?? null,
    positionText: raw.positionText ?? null,
    bio: raw.bio ? markdownToHtml(raw.bio) : null,
    photo: mapMedia(raw.photo),
    instagram: raw.instagram ?? null,
    twitter: raw.twitter ?? null,
    facebook: raw.facebook ?? null,
    dateOfBirth: raw.dateOfBirth ?? null,
    nationality: raw.nationality ?? null,
    isActive: raw.isActive ?? false,
    categories: mapCategories(raw.categories),
  };
}
