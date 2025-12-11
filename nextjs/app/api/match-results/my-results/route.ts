import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { MatchResultService } from '@/lib/services';

export const GET = withAuth(async (
  request,
  { userId, jwt }
) => {
  addApiBreadcrumb('Getting user match results', { userId });

  const service = MatchResultService.forUser(jwt);
  const result = await service.getByUser(userId);

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ matchResults: result.data });
});
