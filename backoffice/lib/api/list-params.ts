/**
 * Query param parsing for paginated list endpoints.
 */

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

export interface ListParams {
  page: number;
  pageSize: number;
  search: string | null;
  category: string | null;
}

/**
 * Parse common list query params (page, pageSize, search, category)
 * with safe defaults and bounds.
 */
export function parseListParams(searchParams: URLSearchParams): ListParams {
  const rawPage = Number.parseInt(searchParams.get('page') ?? '', 10);
  const rawPageSize = Number.parseInt(searchParams.get('pageSize') ?? '', 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.min(rawPageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  const search = searchParams.get('search')?.trim() || null;
  const category = searchParams.get('category') || null;

  return { page, pageSize, search, category };
}

/**
 * Combine filter conditions into a single Strapi filter object.
 * Multiple conditions are joined with $and so that conditions
 * containing $or don't overwrite each other.
 */
export function combineFilters(
  conditions: Record<string, unknown>[]
): Record<string, unknown> | undefined {
  if (conditions.length === 0) {
    return undefined;
  }
  if (conditions.length === 1) {
    return conditions[0];
  }
  return { $and: conditions };
}
