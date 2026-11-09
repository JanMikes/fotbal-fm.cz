/**
 * Shared response mapping of the social-export render routes (server-only).
 */

import { ApiErrors, apiError, apiBinary } from '@/lib/api';
import type { AppError } from '@/lib/core/errors';
import type { WboostRenderedFile } from '@/lib/infrastructure/wboost/client';
import { contentDisposition, encodeExportFilenameHeader } from '@/lib/social-export/download-filename';

/**
 * A failed WBoost call → our API error. 400 forwards the structured WBoost
 * body (code + inputId / imageInputId / containerId / variantId) as `details`
 * so the page can point at the offending field and dimension.
 */
export function wboostErrorResponse(error: AppError) {
  switch (error.statusCode) {
    case 400:
      return ApiErrors.badRequest(error.message, error.details);
    case 403:
      return ApiErrors.forbidden(error.message);
    case 404:
      return ApiErrors.notFound(error.message);
    case 503:
      return apiError(error.message, { status: 503, code: error.code, details: error.details });
    default:
      return ApiErrors.serverError(error.message);
  }
}

/**
 * Stream a rendered file back, keeping WBoost's content type + download
 * filename. The name is UTF-8 (Czech diacritics): headers carry it as
 * `filename*` + an ASCII fallback, and `X-Export-Filename` percent-encoded.
 */
export function renderedFileResponse(file: WboostRenderedFile) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (file.filename) {
    headers['Content-Disposition'] = contentDisposition(file.filename);
    headers['X-Export-Filename'] = encodeExportFilenameHeader(file.filename);
  }

  return apiBinary(file.body, { contentType: file.contentType, headers });
}
