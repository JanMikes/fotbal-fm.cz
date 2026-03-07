import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { getAuthService } from '@/lib/services';

export const GET = withAuth(async (
  request,
  { jwt }
) => {
  addApiBreadcrumb('Getting current user');

  const authService = getAuthService();
  const result = await authService.getCurrentUser(jwt);

  if (!result.success) {
    if (result.error.statusCode === 401) {
      return ApiErrors.unauthorized(result.error.message);
    }
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ user: result.data });
});
