import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { MatchService } from '@/lib/services';

export const GET = withAuth(async (
  request,
  { userId, jwt }
) => {
  addApiBreadcrumb('Getting user matches', { userId });

  const service = MatchService.forUser(jwt);
  const result = await service.getByUser(userId);

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ matches: result.data });
});
