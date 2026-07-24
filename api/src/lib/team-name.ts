/**
 * FAČR names our club differently in each competition: "Frýdek-Místek",
 * "FK FM A", "FK F-M U19", "FK Frýdek Místek U8", "FK Frýdek-Místek 1921",
 * "FK Frýdek-Místek z.s.", … This module maps all these variants to one
 * canonical name so the web shows a single consistent club name.
 */

export const CLUB_CANONICAL_NAME = 'FK Frýdek-Místek';

/**
 * Normalize a FAČR team name: our club's variants become the canonical
 * "FK Frýdek-Místek", keeping the squad suffix (A/B/C, U8–U19) that
 * distinguishes our teams from each other. Anything else — other clubs,
 * or joint squads like "F-M/Nošovice-Lhoty" — is returned unchanged.
 */
export function normalizeClubTeamName(name: string): string {
  const compact = name.trim().replace(/\s+/g, ' ');
  const base = compact.match(/^(?:FK )?(?:Frýdek[ -]?Místek|F-M|FM)(?<rest>$|[ ,].*)/iu);
  if (!base?.groups) return name;

  // Drop legal-entity decorations FAČR appends to the club name
  const rest = base.groups.rest
    .replace(/\b(?:z\.?\s?s\.?|a\.?\s?s\.?|1921)/giu, ' ')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (rest === '') return CLUB_CANONICAL_NAME;

  const squad = rest.match(/^(?<letter>[ABC])$|^U-?(?<age>\d{1,2})$/iu);
  if (!squad?.groups) return name;

  return squad.groups.letter
    ? `${CLUB_CANONICAL_NAME} ${squad.groups.letter.toUpperCase()}`
    : `${CLUB_CANONICAL_NAME} U${squad.groups.age}`;
}
