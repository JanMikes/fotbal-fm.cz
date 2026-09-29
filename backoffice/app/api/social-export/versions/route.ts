import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, ApiErrors, addApiBreadcrumb } from '@/lib/api';
import { getSocialExportService } from '@/lib/services/social-export.service';
import { wboostErrorResponse } from '@/lib/social-export/route-responses';

/**
 * The shared WBoost export history of a fill surface:
 * `?groupId=` (synchronized templates) or `?variantId=`. Pinned first.
 */
export const GET = withAuth(async (request: NextRequest) => {
  const params = new URL(request.url).searchParams;
  const groupId = params.get('groupId');
  const variantId = params.get('variantId');

  if (!groupId && !variantId) {
    return ApiErrors.badRequest('Chybí parametr groupId nebo variantId');
  }

  addApiBreadcrumb('Listing social-export versions', { groupId, variantId });

  const result = await getSocialExportService().listExportVersions(
    groupId ? { groupId } : { variantId: variantId as string }
  );

  if (!result.success) {
    return wboostErrorResponse(result.error);
  }

  return apiSuccess({ versions: result.data });
});
