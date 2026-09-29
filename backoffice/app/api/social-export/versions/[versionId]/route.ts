import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, ApiErrors, addApiBreadcrumb } from '@/lib/api';
import { getSocialExportService } from '@/lib/services/social-export.service';
import { versionUpdateSchema } from '@/lib/social-export/schemas';
import { wboostErrorResponse } from '@/lib/social-export/route-responses';

/** The dynamic segment, read from the URL (withAuth hands handlers the auth context). */
function versionIdFrom(request: NextRequest): string {
  const parts = new URL(request.url).pathname.split('/');
  return decodeURIComponent(parts[parts.length - 1]);
}

/** One export version with its fill (loaded back into the editor). */
export const GET = withAuth(async (request: NextRequest) => {
  const versionId = versionIdFrom(request);
  addApiBreadcrumb('Loading social-export version', { versionId });

  const result = await getSocialExportService().getExportVersion(versionId);
  if (!result.success) {
    return wboostErrorResponse(result.error);
  }

  return apiSuccess({ version: result.data });
});

/** Rename / pin a version of the shared history. */
export const PATCH = withAuth(async (request: NextRequest) => {
  const versionId = versionIdFrom(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiErrors.badRequest('Neplatné tělo požadavku (očekáván JSON)');
  }

  const parsed = versionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.validationFailed(parsed.error.issues[0]?.message ?? 'Neplatná data požadavku');
  }

  addApiBreadcrumb('Updating social-export version', { versionId });

  const result = await getSocialExportService().updateExportVersion(versionId, parsed.data);
  if (!result.success) {
    return wboostErrorResponse(result.error);
  }

  return apiSuccess({ version: result.data });
});
