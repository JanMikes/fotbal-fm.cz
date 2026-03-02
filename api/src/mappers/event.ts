import { mapMediaArray } from '../lib/media.js';
import type { StrapiRawEvent } from '../types/strapi.js';
import { mapCategories } from './shared.js';

export function mapEvent(raw: StrapiRawEvent) {
  return {
    documentId: raw.documentId,
    name: raw.name,
    eventType: raw.eventType,
    dateFrom: raw.dateFrom,
    dateTo: raw.dateTo ?? null,
    eventTime: raw.eventTime ?? null,
    eventTimeTo: raw.eventTimeTo ?? null,
    description: raw.description ?? null,
    photos: mapMediaArray(raw.photos),
    categories: mapCategories(raw.categories),
  };
}
