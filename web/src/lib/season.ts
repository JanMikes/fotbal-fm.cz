/**
 * Season helpers. A season is identified by its start year:
 * 2025 = season 2025/2026 (runs 1st July 2025 – 30th June 2026).
 */

/** Season start year for an ISO date (YYYY-MM-DD). July starts a new season. */
export function seasonFromDate(isoDate: string): number {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  return month >= 7 ? year : year - 1;
}

/** Season start year of today. */
export function currentSeasonStartYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Season of a match: the synced FAČR season when present, otherwise derived
 * from the match date (manually created matches have no season field).
 */
export function matchSeason(match: { season: number | null; rawMatchDate: string }): number {
  return match.season ?? seasonFromDate(match.rawMatchDate);
}

/** Display label, e.g. 2025 → "2025/2026". */
export function formatSeason(startYear: number): string {
  return `${startYear}/${startYear + 1}`;
}

/** Date window of a season as ISO dates [from, to] inclusive. */
export function seasonDateRange(startYear: number): [string, string] {
  return [`${startYear}-07-01`, `${startYear + 1}-06-30`];
}
