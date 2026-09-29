import { NextRequest } from 'next/server';
import { withAuth, ApiErrors, addApiBreadcrumb } from '@/lib/api';
import { getSocialExportService } from '@/lib/services/social-export.service';
import { groupRenderRequestSchema } from '@/lib/social-export/schemas';
import { renderedFileResponse, wboostErrorResponse } from '@/lib/social-export/route-responses';

/**
 * Render a template GROUP fill through WBoost: `preview` one member dimension
 * (WebP), `export` one dimension (PNG) or — without `variantId` — every
 * dimension as one ZIP. The response keeps WBoost's download filename.
 */
export const POST = withAuth(async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiErrors.badRequest('Neplatné tělo požadavku (očekáván JSON)');
  }

  const parsed = groupRenderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.validationFailed(parsed.error.issues[0]?.message ?? 'Neplatná data požadavku');
  }

  const { groupId, variantId, inputs, images, placements, mode } = parsed.data;
  const renderMode = mode ?? 'preview';

  if (renderMode === 'preview' && !variantId) {
    return ApiErrors.badRequest('Náhled skupiny vyžaduje variantId');
  }

  addApiBreadcrumb('Rendering social-export group', { groupId, variantId, mode: renderMode });

  const result = await getSocialExportService().renderGroup(
    groupId,
    variantId ?? null,
    { inputs, images, placements },
    renderMode
  );

  if (!result.success) {
    return wboostErrorResponse(result.error);
  }

  return renderedFileResponse(result.data);
});
