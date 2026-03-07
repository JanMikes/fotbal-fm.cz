import type { Player } from '@/lib/types';
import type { StrapiRawPlayer } from '../types';
import { mapMedia, slugify } from './shared';
import { mapCategories } from './category';

export function mapPlayer(raw: StrapiRawPlayer): Player {
  return {
    documentId: raw.documentId,
    name: raw.name,
    slug: raw.slug || slugify(raw.name),
    type: raw.type,
    number: raw.number,
    sortOrder: raw.sortOrder ?? 0,
    position: raw.position,
    positionText: raw.positionText,
    bio: raw.bio,
    photo: mapMedia(raw.photo),
    instagram: raw.instagram,
    twitter: raw.twitter,
    facebook: raw.facebook,
    categories: mapCategories(raw.categories),
    facrId: raw.facrId,
    dateOfBirth: raw.dateOfBirth,
    nationality: raw.nationality,
    isActive: raw.isActive ?? true,
  };
}
