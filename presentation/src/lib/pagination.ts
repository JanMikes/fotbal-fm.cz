/**
 * Generate visible page numbers with ellipsis markers.
 * Always shows first page, last page, and pages around current.
 */
export function generatePageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 1) return [];

  const pages: (number | 'ellipsis')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }
  return pages;
}

/**
 * Build page href with optional query parameter.
 * Page 1 returns clean baseHref without query params.
 */
export function buildPageHref(baseHref: string, page: number, paramName = 'stranka'): string {
  return page === 1 ? baseHref : `${baseHref}?${paramName}=${page}`;
}

/**
 * Parse page number from search param value.
 * Returns 1 for undefined, empty, non-numeric, zero, or negative values.
 */
export function parsePageNumber(value: string | string[] | undefined): number {
  if (value === undefined || Array.isArray(value)) return 1;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}
