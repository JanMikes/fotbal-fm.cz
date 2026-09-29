/**
 * Zod schemas of the social-export API routes' request bodies. They live in
 * lib/ (not inline in the routes) so vitest can pin them: every object is
 * STRICT and the rich-text branch of the value union comes FIRST — a
 * non-strict `{ value?, hide? }` branch used to match ANY object and silently
 * strip `runs` / `fontFamily`, so rich formatting and font picks never
 * reached WBoost.
 */

import { z } from 'zod/v4';

export const listLineTypeSchema = z.enum(['p', 'ul', 'ol', 'cb', 'cbx']);

export const richRunSchema = z
  .object({
    text: z.string(),
    fontFamily: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    underline: z.boolean().optional(),
  })
  .strict()
  // Normalize to the full RichRunDTO shape (WBoost treats absent = null).
  .transform((run) => ({
    text: run.text,
    fontFamily: run.fontFamily ?? null,
    color: run.color ?? null,
    underline: run.underline === true,
  }));

export const renderInputValueSchema = z.union([
  z.string(),
  // Rich text — only valid for inputs with richText: true (WBoost enforces
  // that and answers a structured 400 we forward as-is).
  z
    .object({
      runs: z.array(richRunSchema),
      lines: z.array(listLineTypeSchema).optional(),
      hide: z.boolean().optional(),
      fontFamily: z.string().optional(),
    })
    .strict(),
  z
    .object({
      value: z.string().optional(),
      hide: z.boolean().optional(),
      fontFamily: z.string().optional(),
    })
    .strict(),
]);

export const renderImageValueSchema = z.union([
  z.string(),
  z
    .object({
      imageId: z.string().optional(),
      scale: z.number().optional(),
      offsetX: z.number().optional(),
      offsetY: z.number().optional(),
      offsetXRatio: z.number().optional(),
      offsetYRatio: z.number().optional(),
      rotation: z.number().optional(),
      hide: z.boolean().optional(),
    })
    .strict(),
]);

/** `preview` = unrecorded WebP for the screen (default), `export` = the recorded download. */
export const renderModeSchema = z.enum(['preview', 'export']);

export const renderRequestSchema = z
  .object({
    variantId: z.string().min(1),
    mode: renderModeSchema.optional(),
    inputs: z.record(z.string(), renderInputValueSchema),
    images: z.record(z.string(), renderImageValueSchema).optional(),
  })
  .strict();

const placementSchema = z
  .object({
    scale: z.number().optional(),
    offsetXRatio: z.number().optional(),
    offsetYRatio: z.number().optional(),
    rotation: z.number().optional(),
  })
  .strict();

export const groupRenderRequestSchema = z
  .object({
    groupId: z.string().min(1),
    /** Member dimension; required for `preview`, absent + `export` = the whole group as ZIP. */
    variantId: z.string().min(1).optional(),
    mode: renderModeSchema.optional(),
    inputs: z.record(z.string(), renderInputValueSchema),
    images: z.record(z.string(), renderImageValueSchema).optional(),
    placements: z.record(z.string(), z.record(z.string(), placementSchema)).optional(),
  })
  .strict();

const inputFieldStateSchema = z
  .object({
    value: z.string().max(10000),
    hidden: z.boolean(),
    runs: z.array(richRunSchema).nullable().optional(),
    lines: z.array(listLineTypeSchema).nullable().optional(),
    fontFamily: z.string().nullable().optional(),
  })
  .strict();

// The pan is stored as a fraction of the slot's frame. `offsetX`/`offsetY` are
// the pre-portable px form: still accepted so a client mid-deploy can save, and
// converted on read (applySavedState) against the slot's frame.
const imageSlotStateSchema = z
  .object({
    image: z.object({ id: z.string(), url: z.string() }).strict().nullable(),
    scale: z.number(),
    offsetXRatio: z.number().optional(),
    offsetYRatio: z.number().optional(),
    offsetX: z.number().optional(),
    offsetY: z.number().optional(),
    rotation: z.number(),
    hidden: z.boolean(),
  })
  .strict();

export const saveStateRequestSchema = z
  .object({
    matchId: z.string().min(1),
    templateId: z.string().min(1),
    /** The fill surface: a variant id, or a GROUP id for a group fill. */
    variantId: z.string().min(1),
    state: z
      .object({
        formState: z.record(z.string(), inputFieldStateSchema),
        imageState: z.record(z.string(), imageSlotStateSchema),
        /** Group fills: per-dimension image state (variantId → slotId → state). */
        dimensionImageStates: z
          .record(z.string(), z.record(z.string(), imageSlotStateSchema))
          .optional(),
      })
      .strict(),
  })
  .strict();

export const versionUpdateSchema = z
  .object({
    name: z.string().max(500).nullable().optional(),
    pinned: z.boolean().optional(),
  })
  .strict()
  .refine((body) => body.name !== undefined || body.pinned !== undefined, {
    message: 'Zadejte name nebo pinned',
  });
