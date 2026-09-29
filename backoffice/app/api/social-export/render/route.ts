import { NextRequest } from 'next/server';
import { withAuth, ApiErrors, addApiBreadcrumb } from '@/lib/api';
import { getSocialExportService } from '@/lib/services/social-export.service';
import { renderRequestSchema } from '@/lib/social-export/schemas';
import { renderedFileResponse, wboostErrorResponse } from '@/lib/social-export/route-responses';

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

  const { variantId, inputs, images, mode } = parsed.data;

  const service = getSocialExportService();
  const result = await service.renderVariant(variantId, inputs, images, mode ?? 'preview');

  if (!result.success) {
    return wboostErrorResponse(result.error);
  }

  return renderedFileResponse(result.data);
});
