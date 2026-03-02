import { z } from '@hono/zod-openapi';
import { MediaImageSchema, CategorySchema } from './shared.js';

export const PlayerSchema = z.object({
  documentId: z.string(),
  name: z.string(),
  slug: z.string().nullable(),
  type: z.enum(['hráč', 'realizační tým']),
  number: z.number().nullable(),
  position: z.enum(['brankář', 'obránce', 'záložník', 'útočník']).nullable(),
  positionText: z.string().nullable(),
  bio: z.string().nullable(),
  photo: MediaImageSchema.nullable(),
  instagram: z.string().nullable(),
  twitter: z.string().nullable(),
  facebook: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  nationality: z.string().nullable(),
  isActive: z.boolean(),
  categories: z.array(CategorySchema),
});
