import { NextRequest } from 'next/server';
import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
  parseListParams,
  combineFilters,
} from '@/lib/api';
import { TournamentService } from '@/lib/services';

export const GET = withAuth(async (
  request: NextRequest,
  { jwt }
) => {
  const { searchParams } = new URL(request.url);
  const { page, pageSize, search, category } = parseListParams(searchParams);

  addApiBreadcrumb('Listing tournaments', { category, search, page, pageSize });

  const service = TournamentService.forUser(jwt);

  const conditions: Record<string, unknown>[] = [];
  if (category) {
    conditions.push({ categories: { documentId: { $eq: category } } });
  }
  if (search) {
    conditions.push({
      $or: [
        { name: { $containsi: search } },
        { location: { $containsi: search } },
        { description: { $containsi: search } },
      ],
    });
  }

  const result = await service.getPaginated({
    page,
    pageSize,
    filters: combineFilters(conditions),
  });

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({
    tournaments: result.data.data,
    pagination: result.data.pagination,
  });
});
