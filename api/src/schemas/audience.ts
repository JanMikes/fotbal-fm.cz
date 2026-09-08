import { z } from '@hono/zod-openapi';

export const AudienceCategorySchema = z
  .object({
    documentId: z.string(),
    slug: z.string().openapi({ example: 'rodice-u12' }),
    name: z.string().openapi({ example: 'Rodiče U12' }),
    description: z.string().nullable(),
    sortOrder: z.number(),
    /** false = only a deep link or an admin can add it; the user can still remove it. */
    selectable: z.boolean(),
  })
  .openapi('AudienceCategory');

export const DeepLinkSchema = z
  .object({
    code: z.string().openapi({ example: '7K3M9PQ2' }),
    url: z.string().openapi({ example: 'https://fotbal-fm.cz/a/7K3M9PQ2' }),
    name: z.string().openapi({ example: 'Pozvánka od janmikes' }),
    active: z.boolean(),
    expiresAt: z.string().nullable(),
    audienceCategories: z.array(AudienceCategorySchema),
  })
  .openapi('DeepLink');

export const DeepLinkInvalidReasonSchema = z.enum(['not_found', 'inactive', 'expired', 'rate_limited', 'error']);

export const DeepLinkClaimResultSchema = z
  .object({
    code: z.string(),
    /** true when the link was valid and its categories are now on the account. */
    claimed: z.boolean(),
    /** true when this user had already claimed this link before (no-op). */
    alreadyClaimed: z.boolean(),
    reason: DeepLinkInvalidReasonSchema.optional(),
    /** Categories the link added in this call (empty when already present). */
    addedAudienceCategories: z.array(AudienceCategorySchema),
    /** The user's full list after the claim. */
    audienceCategories: z.array(AudienceCategorySchema),
  })
  .openapi('DeepLinkClaimResult');

export const ErrorSchema = z.object({
  error: z.string(),
  reason: DeepLinkInvalidReasonSchema.optional(),
});
