import { NextRequest } from 'next/server';
import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { EventService } from '@/lib/services';

export const GET = withAuth(async (
  request: NextRequest,
  { userId, jwt }
) => {
  const { searchParams } = new URL(request.url);
  const onlyMine = searchParams.get('onlyMine') === 'true';

  addApiBreadcrumb('Listing events', { onlyMine, userId });

  const service = EventService.forUser(jwt);
  const result = await service.getAll(onlyMine ? userId : undefined);

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ events: result.data });
});
