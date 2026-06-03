import { withAuth, apiSuccess, ApiErrors, apiError, addApiBreadcrumb } from '@/lib/api';
import { getSocialExportService } from '@/lib/services/social-export.service';

export const GET = withAuth(async () => {
  addApiBreadcrumb('Fetching social-export templates');

  const service = getSocialExportService();
  const result = await service.getTemplates();

  if (!result.success) {
    const { error } = result;
    if (error.statusCode === 503) {
      return apiError(error.message, { status: 503, code: error.code });
    }
    return ApiErrors.serverError(error.message);
  }

  return apiSuccess({ templates: result.data });
});
