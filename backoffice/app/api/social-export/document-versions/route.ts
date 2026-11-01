import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, ApiErrors, addApiBreadcrumb } from '@/lib/api';
import { getSocialExportService } from '@/lib/services/social-export.service';
import { wboostErrorResponse } from '@/lib/social-export/route-responses';

/** The shared WBoost export history of a multi-page document (`?documentId=`). Pinned first. */
export const GET = withAuth(async (request: NextRequest) => {
  const documentId = new URL(request.url).searchParams.get('documentId');
  if (!documentId) {
    return ApiErrors.badRequest('Chybí parametr documentId');
  }

  addApiBreadcrumb('Listing document export versions', { documentId });

  const result = await getSocialExportService().listDocumentExportVersions(documentId);
  if (!result.success) {
    return wboostErrorResponse(result.error);
  }

  return apiSuccess({ versions: result.data });
});
