/**
 * Competition helpers for FAČR competition codes.
 */

/**
 * Cup competitions (MOL Cup, krajské poháry) are coded with a leading "Z" in
 * FAČR IS. They pull in every entrant of the round, so their tables dwarf the
 * league ones and must never outrank a league table on the category page.
 */
export function isCupCompetition(competitionCode: string, tournamentName: string | null): boolean {
  if (competitionCode.toUpperCase().startsWith('Z')) return true;
  const name = tournamentName?.toLowerCase() ?? '';
  return name.includes('cup') || name.includes('pohár');
}
