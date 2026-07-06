import { NextRequest } from 'next/server';
import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
  parseListParams,
  combineFilters,
} from '@/lib/api';
import { MatchService } from '@/lib/services';

export const GET = withAuth(async (
  request: NextRequest,
  { jwt }
) => {
  const { searchParams } = new URL(request.url);
  const { page, pageSize, search, category } = parseListParams(searchParams);
  const matchFilter = searchParams.get('filter') === 'future' ? 'future' : 'played';

  addApiBreadcrumb('Listing matches', { category, search, page, pageSize, filter: matchFilter });

  const service = MatchService.forUser(jwt);

  const conditions: Record<string, unknown>[] = [];
  if (category) {
    conditions.push({ categories: { documentId: { $eq: category } } });
  }
  if (matchFilter === 'played') {
    conditions.push({
      homeScore: { $notNull: true },
      awayScore: { $notNull: true },
    });
  } else {
    conditions.push({
      $or: [
        { homeScore: { $null: true } },
        { awayScore: { $null: true } },
      ],
    });
  }
  if (search) {
    conditions.push({
      $or: [
        { homeTeam: { name: { $containsi: search } } },
        { awayTeam: { name: { $containsi: search } } },
        { competitionName: { $containsi: search } },
        { venue: { $containsi: search } },
      ],
    });
  }

  const result = await service.getPaginated({
    page,
    pageSize,
    sort: matchFilter === 'future'
      ? ['matchDate:asc', 'createdAt:asc']
      : ['matchDate:desc', 'createdAt:desc'],
    filters: combineFilters(conditions),
  });

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({
    matches: result.data.data,
    pagination: result.data.pagination,
  });
});
