/**
 * Match-data prefill for the social-export form.
 *
 * Two consumers, ONE source of truth (the alias map below):
 *  1. `extractMatchPrefill` — auto-fills template inputs whose `name` matches a
 *     known Czech alias (diacritics- and case-insensitive, exact normalized match).
 *  2. `getMatchChips` — the clickable "insert" chips shown above the form, so any
 *     input (matched or not) can be filled by hand.
 *
 * To support a new WBoost input name, just add an alias to FIELD_ALIASES.
 * This module is client-safe (no server imports).
 */

import type { Match } from '@/types/match';
import type { TemplateInputDTO } from './api-types';

/** Canonical match fields that can be inserted into a template. */
export type MatchFieldKey =
  | 'home_team'
  | 'away_team'
  | 'score'
  | 'home_score'
  | 'away_score'
  | 'date'
  | 'time'
  | 'datetime'
  | 'competition'
  | 'category'
  | 'venue'
  | 'round'
  | 'home_scorers'
  | 'away_scorers'
  | 'lineup'
  | 'match_report'
  | 'tournament'
  | 'season'
  | 'period'
  | 'organizing_body'
  | 'competition_code'
  | 'facr_id'
  | 'author'
  | 'images_url';

/** Display label (Czech) shown on the insert chip for each field. */
export const FIELD_LABELS: Record<MatchFieldKey, string> = {
  home_team: 'Domácí',
  away_team: 'Hosté',
  score: 'Skóre',
  home_score: 'Skóre domácí',
  away_score: 'Skóre hosté',
  date: 'Datum',
  time: 'Čas',
  datetime: 'Datum a čas',
  competition: 'Soutěž',
  category: 'Kategorie',
  venue: 'Místo',
  round: 'Kolo',
  home_scorers: 'Střelci domácí',
  away_scorers: 'Střelci hosté',
  lineup: 'Sestava',
  match_report: 'Komentář trenéra',
  tournament: 'Turnaj',
  season: 'Sezóna',
  period: 'Část sezóny',
  organizing_body: 'Řídící orgán',
  competition_code: 'Kód soutěže',
  facr_id: 'FAČR ID',
  author: 'Autor',
  images_url: 'Odkaz na fotky',
};

/**
 * Accepted WBoost input names per field. Match your template input names to one
 * of these (the first entry is the recommended name). Deliberately
 * non-overlapping after normalization, so no input maps to two fields.
 */
export const FIELD_ALIASES: Record<MatchFieldKey, string[]> = {
  home_team: ['Domácí', 'Domácí tým', 'Domácí mužstvo', 'Domácí klub', 'Náš tým'],
  away_team: ['Hosté', 'Hostující tým', 'Hostující', 'Soupeř'],
  score: ['Skóre', 'Výsledek', 'Konečný výsledek'],
  home_score: ['Skóre domácí', 'Góly domácí', 'Domácí skóre', 'Domácí góly'],
  away_score: ['Skóre hosté', 'Góly hosté', 'Skóre hostů', 'Góly hostů'],
  date: ['Datum', 'Datum zápasu', 'Den'],
  time: ['Čas', 'Výkop', 'Čas výkopu', 'Začátek'],
  datetime: ['Datum a čas', 'Termín'],
  competition: ['Soutěž', 'Liga'],
  category: ['Kategorie'],
  venue: ['Místo', 'Stadion', 'Hřiště', 'Místo konání'],
  round: ['Kolo', 'Číslo kola'],
  home_scorers: ['Střelci domácí', 'Střelci domácích'],
  away_scorers: ['Střelci hosté', 'Střelci hostů'],
  lineup: ['Sestava', 'Nominace', 'Soupiska'],
  match_report: ['Komentář trenéra', 'Zápis o utkání', 'Komentář', 'Hodnocení trenéra', 'Zápis'],
  tournament: ['Turnaj', 'Název turnaje'],
  season: ['Sezóna', 'Ročník'],
  period: ['Část sezóny', 'Část', 'Půlsezóna', 'Období'],
  organizing_body: ['Řídící orgán', 'Pořadatel', 'Svaz'],
  competition_code: ['Kód soutěže', 'Kód'],
  facr_id: ['FAČR ID', 'FAČR', 'ID zápasu'],
  author: ['Autor', 'Zapsal'],
  images_url: ['Odkaz na fotky', 'Odkaz na fotogalerii', 'Fotogalerie', 'URL fotek'],
};

/** Order in which chips are presented. */
const CHIP_ORDER: MatchFieldKey[] = [
  'home_team',
  'away_team',
  'score',
  'home_score',
  'away_score',
  'date',
  'time',
  'datetime',
  'competition',
  'category',
  'venue',
  'round',
  'home_scorers',
  'away_scorers',
  'lineup',
  'match_report',
  'tournament',
  'season',
  'period',
  'organizing_body',
  'competition_code',
  'facr_id',
  'author',
  'images_url',
];

/**
 * Normalize a name for matching: lowercase, strip diacritics, collapse any
 * non-alphanumeric run to a single space, trim. e.g. "Skóre domácí" → "skore domaci".
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // strip combining marks (diacritics) left by NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** normalized alias -> field key (built once). First definition wins on collision. */
const ALIAS_LOOKUP: Map<string, MatchFieldKey> = (() => {
  const map = new Map<string, MatchFieldKey>();
  for (const key of Object.keys(FIELD_ALIASES) as MatchFieldKey[]) {
    for (const alias of FIELD_ALIASES[key]) {
      const norm = normalizeName(alias);
      if (!map.has(norm)) {
        map.set(norm, key);
      }
    }
  }
  return map;
})();

function formatDate(matchDate: string): string {
  const parts = matchDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return '';
  }
  const [year, month, day] = parts;
  return `${day}. ${month}. ${year}`;
}

function formatTime(matchTime?: string): string {
  if (!matchTime) return '';
  return matchTime.slice(0, 5);
}

/** Resolve the string value for a given match field, or '' when not available. */
export function getMatchFieldValue(match: Match, key: MatchFieldKey): string {
  switch (key) {
    case 'home_team':
      return match.homeTeam ?? '';
    case 'away_team':
      return match.awayTeam ?? '';
    case 'score':
      return match.homeScore != null && match.awayScore != null
        ? `${match.homeScore} : ${match.awayScore}`
        : '';
    case 'home_score':
      return match.homeScore != null ? String(match.homeScore) : '';
    case 'away_score':
      return match.awayScore != null ? String(match.awayScore) : '';
    case 'date':
      return formatDate(match.matchDate);
    case 'time':
      return formatTime(match.matchTime);
    case 'datetime': {
      const date = formatDate(match.matchDate);
      const time = formatTime(match.matchTime);
      return time ? `${date} ${time}`.trim() : date;
    }
    case 'competition':
      return match.competitionName ?? '';
    case 'category':
      return (match.categories ?? []).map((c) => c.name).filter(Boolean).join(', ');
    case 'venue':
      return match.venue ?? '';
    case 'round':
      return match.round != null ? String(match.round) : '';
    case 'home_scorers':
      return match.homeGoalscorers ?? '';
    case 'away_scorers':
      return match.awayGoalscorers ?? '';
    case 'lineup':
      return match.lineup ?? '';
    case 'match_report':
      return match.matchReport ?? '';
    case 'tournament':
      return match.tournamentName ?? '';
    case 'season':
      return match.season != null ? String(match.season) : '';
    case 'period':
      // Strapi stores this lowercase ('podzim'/'jaro'); capitalize for display.
      return match.period ? match.period.charAt(0).toUpperCase() + match.period.slice(1) : '';
    case 'organizing_body':
      return match.organizingBody ?? '';
    case 'competition_code':
      return match.competitionCode ?? '';
    case 'facr_id':
      return match.facrId ?? '';
    case 'author':
      return match.author ? `${match.author.firstName} ${match.author.lastName}`.trim() : '';
    case 'images_url':
      return match.imagesUrl ?? '';
    default:
      return '';
  }
}

export interface MatchChip {
  /** The match field this chip inserts. */
  key: MatchFieldKey;
  /** Czech label shown on the chip. */
  label: string;
  /** The value inserted into the focused field. */
  value: string;
}

/** Build the clickable insert chips for a match (only fields with a value). */
export function getMatchChips(match: Match): MatchChip[] {
  const chips: MatchChip[] = [];
  for (const key of CHIP_ORDER) {
    const value = getMatchFieldValue(match, key);
    if (value) {
      chips.push({ key, label: FIELD_LABELS[key], value });
    }
  }
  return chips;
}

/**
 * Auto-map: for each editable input whose `name` matches an alias, produce
 * `{ [inputId]: value }`. Skips locked inputs, inputs with no name, names that
 * don't match an alias, and fields whose match value is empty.
 */
export function extractMatchPrefill(
  match: Match,
  inputs: TemplateInputDTO[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const input of inputs) {
    if (input.locked || !input.name) continue;
    const fieldKey = ALIAS_LOOKUP.get(normalizeName(input.name));
    if (!fieldKey) continue;
    const value = getMatchFieldValue(match, fieldKey);
    if (value) {
      result[input.id] = value;
    }
  }
  return result;
}
