import { NextRequest } from 'next/server';
import { withAuth, ApiErrors, addApiBreadcrumb } from '@/lib/api';
import { getSocialExportService } from '@/lib/services/social-export.service';
import { documentRenderRequestSchema } from '@/lib/social-export/schemas';
import { renderedFileResponse, wboostErrorResponse } from '@/lib/social-export/route-responses';

/**
 * Render a multi-page document fill through WBoost: `preview` one page
 * (WebP, unrecorded) or `export` the whole document as ONE file — PDF
 * (`pdf-screen` / print `pdf`) or a ZIP of PNGs (`png`). The response keeps
 * WBoost's download filename; a 400 forwards its `pageId`.
 */
export const POST = withAuth(async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiErrors.badRequest('Neplatné tělo požadavku (očekáván JSON)');
  }

  const parsed = documentRenderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.validationFailed(parsed.error.issues[0]?.message ?? 'Neplatná data požadavku');
  }

  const { documentId, mode, pageId, format, fields, pages } = parsed.data;

  addApiBreadcrumb('Rendering social-export document', { documentId, pageId, mode, format });

  const result = await getSocialExportService().renderDocument(
    documentId,
    mode === 'preview' ? (pageId ?? null) : null,
    { fields, pages },
    format
  );

  if (!result.success) {
    return wboostErrorResponse(result.error);
  }

  return renderedFileResponse(result.data);
});
