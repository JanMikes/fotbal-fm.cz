import { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { withAuth, ApiErrors, apiError, apiBinary, addApiBreadcrumb } from '@/lib/api';
import { getSocialExportService } from '@/lib/services/social-export.service';

const richRunSchema = z
  .object({
    text: z.string(),
    fontFamily: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    underline: z.boolean().optional(),
  })
  // Normalize to the full RichRunDTO shape (WBoost treats absent = null).
  .transform((run) => ({
    text: run.text,
    fontFamily: run.fontFamily ?? null,
    color: run.color ?? null,
    underline: run.underline === true,
  }));

const renderInputValueSchema = z.union([
  z.string(),
  z.object({
    value: z.string().optional(),
    hide: z.boolean().optional(),
  }),
  // Rich text — only valid for inputs with richText: true (WBoost enforces
  // that and answers a structured 400 we forward as-is).
  z.object({
    runs: z.array(richRunSchema),
    hide: z.boolean().optional(),
  }),
]);

const renderImageValueSchema = z.union([
  z.string(),
  z.object({
    imageId: z.string().optional(),
    scale: z.number().optional(),
    offsetX: z.number().optional(),
    offsetY: z.number().optional(),
    offsetXRatio: z.number().optional(),
    offsetYRatio: z.number().optional(),
    rotation: z.number().optional(),
    hide: z.boolean().optional(),
  }),
]);

const renderRequestSchema = z.object({
  variantId: z.string().min(1),
  inputs: z.record(z.string(), renderInputValueSchema),
  images: z.record(z.string(), renderImageValueSchema).optional(),
});

export const POST = withAuth(async (request: NextRequest) => {
  addApiBreadcrumb('Rendering social-export variant');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiErrors.badRequest('Neplatné tělo požadavku (očekáván JSON)');
  }

  const parsed = renderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.validationFailed(parsed.error.issues[0]?.message ?? 'Neplatná data požadavku');
  }

  const { variantId, inputs, images } = parsed.data;

  const service = getSocialExportService();
  const result = await service.renderVariant(variantId, inputs, images);

  if (!result.success) {
    const { error } = result;
    switch (error.statusCode) {
      case 400:
        // Forward the structured WBoost details (e.g. container_overflow with
        // the offending containerId) so the page can highlight the fields.
        return ApiErrors.badRequest(error.message, error.details);
      case 403:
        return ApiErrors.forbidden(error.message);
      case 404:
        return ApiErrors.notFound(error.message);
      case 503:
        return apiError(error.message, { status: 503, code: error.code });
      default:
        return ApiErrors.serverError(error.message);
    }
  }

  return apiBinary(result.data, {
    contentType: 'image/png',
    headers: { 'Cache-Control': 'no-store' },
  });
});
