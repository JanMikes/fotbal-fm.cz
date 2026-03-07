import { NextRequest } from 'next/server';
import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { TournamentService } from '@/lib/services';

export const GET = withAuth(async (
  request: NextRequest,
  { jwt }
) => {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  addApiBreadcrumb('Listing tournaments', { category });

  const service = TournamentService.forUser(jwt);

  const filters: Record<string, unknown> = {};
  if (category) {
    filters.categories = { documentId: { $eq: category } };
  }

  const result = await service.getAll(undefined, Object.keys(filters).length > 0 ? filters : undefined);

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ tournaments: result.data });
});
