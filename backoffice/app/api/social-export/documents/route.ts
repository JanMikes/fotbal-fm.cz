import { withAuth, apiSuccess, ApiErrors, apiError, addApiBreadcrumb } from '@/lib/api';
import { getSocialExportService } from '@/lib/services/social-export.service';

/** The project's multi-page documents (pages + shared fields). */
export const GET = withAuth(async () => {
  addApiBreadcrumb('Fetching social-export documents');

  const result = await getSocialExportService().getDocuments();

  if (!result.success) {
    const { error } = result;
    if (error.statusCode === 503) {
      return apiError(error.message, { status: 503, code: error.code });
    }
    return ApiErrors.serverError(error.message);
  }

  return apiSuccess({ documents: result.data });
});
