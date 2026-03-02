import { z } from '@hono/zod-openapi';
import { MediaImageSchema, CategorySchema } from './shared.js';

export const EventSchema = z.object({
  documentId: z.string(),
  name: z.string(),
  eventType: z.enum(['nadcházející', 'proběhlá']),
  dateFrom: z.string(),
  dateTo: z.string().nullable(),
  eventTime: z.string().nullable(),
  eventTimeTo: z.string().nullable(),
  description: z.string().nullable(),
  photos: z.array(MediaImageSchema),
  categories: z.array(CategorySchema),
});
