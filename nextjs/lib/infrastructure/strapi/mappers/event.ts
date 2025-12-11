/**
 * Event mapper.
 * Transforms raw Strapi event data into domain Event type.
 */

import { Event, EventType } from '@/types/event';
import { StrapiRawEvent, strapiRawEventSchema } from '../types';
import {
  mapMediaToImages,
  mapMediaToFiles,
  mapUserInfo,
  extractUserId,
  nullToUndefined,
} from './shared';
import { ValidationError } from '@/lib/core/errors';

/**
 * Map raw Strapi event to domain Event
 */
export function mapEvent(raw: unknown): Event {
  // Validate raw data structure
  const parseResult = strapiRawEventSchema.safeParse(raw);

  if (!parseResult.success) {
    console.error('[mapEvent] Validation failed:', parseResult.error.issues);
    throw new ValidationError(
      'Neplatná data události ze Strapi',
      { zodErrors: parseResult.error.issues, raw }
    );
  }

  const data = parseResult.data;

  return {
    id: data.documentId,
    name: data.name,
    eventType: data.eventType as EventType,
    dateFrom: data.dateFrom,
    dateTo: nullToUndefined(data.dateTo),
    publishDate: nullToUndefined(data.publishDate),
    eventTime: nullToUndefined(data.eventTime),
    eventTimeTo: nullToUndefined(data.eventTimeTo),
    description: nullToUndefined(data.description),
    requiresPhotographer: data.requiresPhotographer ?? false,
    photos: mapMediaToImages(data.photos),
    files: mapMediaToFiles(data.files),
    authorId: extractUserId(data.author) ?? 0,
    author: mapUserInfo(data.author),
    modifiedBy: mapUserInfo(data.modifiedBy),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Map array of raw Strapi events
 */
export function mapEvents(rawArray: unknown[]): Event[] {
  return rawArray.map(mapEvent);
}

/**
 * Safe mapper that returns null on failure instead of throwing
 */
export function safeMapEvent(raw: unknown): Event | null {
  try {
    return mapEvent(raw);
  } catch (error) {
    console.error('[safeMapEvent] Failed to map event:', error);
    return null;
  }
}

/**
 * Map array with safe fallback - filters out invalid items
 */
export function safeMapEvents(rawArray: unknown[]): Event[] {
  return rawArray
    .map(safeMapEvent)
    .filter((item): item is Event => item !== null);
}
