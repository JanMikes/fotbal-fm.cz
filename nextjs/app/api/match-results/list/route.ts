import { NextRequest } from 'next/server';
import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { MatchResultService } from '@/lib/services';

export const GET = withAuth(async (
  request: NextRequest,
  { userId, jwt }
) => {
  const { searchParams } = new URL(request.url);
  const onlyMine = searchParams.get('onlyMine') === 'true';

  addApiBreadcrumb('Listing match results', { onlyMine, userId });

  const service = MatchResultService.forUser(jwt);
  const result = await service.getAll(onlyMine ? userId : undefined);

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ matchResults: result.data });
});
