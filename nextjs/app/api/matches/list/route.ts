import { NextRequest } from 'next/server';
import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { MatchService } from '@/lib/services';

export const GET = withAuth(async (
  request: NextRequest,
  { jwt }
) => {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  addApiBreadcrumb('Listing matches', { category });

  const service = MatchService.forUser(jwt);

  const filters: Record<string, unknown> = {};
  if (category) {
    filters.categories = { documentId: { $eq: category } };
  }

  const result = await service.getAll(undefined, Object.keys(filters).length > 0 ? filters : undefined);

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ matches: result.data });
});
