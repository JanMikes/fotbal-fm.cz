import { z } from '@hono/zod-openapi';
import { MediaImageSchema } from './shared.js';

export const PartnerCategorySchema = z.object({
  name: z.string(),
});

export const PartnerSummarySchema = z.object({
  documentId: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: MediaImageSchema.nullable(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  partnerCategory: PartnerCategorySchema.nullable(),
});

// Dynamic zone component schemas
const DynamicZoneBaseSchema = z.object({
  id: z.number(),
  __component: z.string(),
});

export const DynamicZoneComponentSchema = DynamicZoneBaseSchema.passthrough();

export const PartnerDetailSchema = PartnerSummarySchema.extend({
  content: z.array(DynamicZoneComponentSchema),
  panel: z.array(DynamicZoneComponentSchema),
});
