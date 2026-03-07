import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { EventService } from '@/lib/services';

export const GET = withAuth(async (
  request,
  { userId, jwt }
) => {
  addApiBreadcrumb('Getting user events', { userId });

  const service = EventService.forUser(jwt);
  const result = await service.getByUser(userId);

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ events: result.data });
});
