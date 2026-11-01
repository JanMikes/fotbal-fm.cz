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

/** Shape inputId → `#rrggbb` ("" = designed colour). WBoost validates against the shape's options. */
const shapeColorsSchema = z.record(z.string(), z.string().max(16));

/** `preview` = unrecorded WebP for the screen (default), `export` = the recorded download. */
export const renderModeSchema = z.enum(['preview', 'export']);

export const renderRequestSchema = z
  .object({
    variantId: z.string().min(1),
    mode: renderModeSchema.optional(),
    inputs: z.record(z.string(), renderInputValueSchema),
    images: z.record(z.string(), renderImageValueSchema).optional(),
    shapeColors: shapeColorsSchema.optional(),
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
    shapeColors: shapeColorsSchema.optional(),
  })
  .strict();

/** One page's own fill in a document body (the single-variant render body). */
const documentPageFillSchema = z
  .object({
    inputs: z.record(z.string(), renderInputValueSchema).optional(),
    images: z.record(z.string(), renderImageValueSchema).optional(),
    shapeColors: shapeColorsSchema.optional(),
  })
  .strict();

/** A shared field value: text → string, image → image id or `{ imageId?, hide? }`. */
const documentFieldValueSchema = z.union([
  // Text: string / rich `{runs}` / `{value?, hide?, fontFamily?}` (a page's own
  // hide / font for a bound input are kept unless the field value sets them).
  renderInputValueSchema,
  z.object({ imageId: z.string().optional(), hide: z.boolean().optional() }).strict(),
]);

export const documentExportFormatSchema = z.enum(['pdf-screen', 'pdf', 'png']);

export const documentRenderRequestSchema = z
  .object({
    documentId: z.string().min(1),
    mode: renderModeSchema,
    /** Required for `preview` (the page to render); ignored by `export`. */
    pageId: z.string().min(1).optional(),
    /** `export` only; defaults to `pdf-screen`. */
    format: documentExportFormatSchema.optional(),
    fields: z.record(z.string(), documentFieldValueSchema),
    pages: z.record(z.string(), documentPageFillSchema),
  })
  .strict()
  .refine((body) => body.mode !== 'preview' || body.pageId !== undefined, {
    message: 'Náhled dokumentu vyžaduje pageId',
  });

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
        /** Recolourable shapes: shape inputId → `#rrggbb` (shared by every dimension). */
        shapeColors: shapeColorsSchema.optional(),
        /** Multi-page document fills: per-page state (pageId → …) + the shared text values. */
        document: z
          .object({
            pages: z.record(
              z.string(),
              z
                .object({
                  formState: z.record(z.string(), inputFieldStateSchema),
                  imageState: z.record(z.string(), imageSlotStateSchema),
                  shapeColors: shapeColorsSchema.optional(),
                })
                .strict()
            ),
            /** Shared TEXT field id → its state (older records: a plain string). */
            sharedText: z.record(z.string(), z.union([z.string().max(10000), inputFieldStateSchema])),
            /** Shared SHAPE field id → `#rrggbb`. */
            sharedShapes: shapeColorsSchema.optional(),
          })
          .strict()
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
