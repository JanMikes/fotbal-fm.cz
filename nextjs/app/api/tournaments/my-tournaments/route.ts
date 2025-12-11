import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { TournamentService } from '@/lib/services';

export const GET = withAuth(async (
  request,
  { userId, jwt }
) => {
  addApiBreadcrumb('Getting user tournaments', { userId });

  const service = TournamentService.forUser(jwt);
  const result = await service.getByUser(userId);

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ tournaments: result.data });
});
