/**
 * Deterministic news-article composition from matches and tournaments.
 * Pure functions: the same input always produces the same markdown output.
 * The result prefills the article form; the editor can adjust it before saving.
 *
 * The markdown is rendered on the public web with `marked` (breaks: true),
 * so single newlines inside a block become <br>.
 */

import { Match } from '@/types/match';
import { Tournament } from '@/types/tournament';

export interface ComposedArticle {
  title: string;
  description: string;
}

/** 'YYYY-MM-DD' -> 'D. M. YYYY' (no Date parsing, no timezone surprises) */
function formatCzechDate(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return '';
  return `${day}. ${month}. ${year}`;
}

/** 'HH:mm:ss.SSS' | 'HH:mm' -> 'HH:mm' */
function formatTime(time: string | undefined): string {
  if (!time) return '';
  return time.slice(0, 5);
}

function formatScore(home: number | null, away: number | null): string {
  if (home === null || away === null) return '';
  return `${home}:${away}`;
}

/** Join non-empty parts into one line with a middle dot separator */
function metaLine(parts: Array<string | undefined>): string {
  const filled = parts.filter((p): p is string => Boolean(p && p.trim()));
  return filled.length > 0 ? `*${filled.join(' · ')}*` : '';
}

/** Join non-empty blocks with blank lines between them */
function joinBlocks(blocks: Array<string | undefined>): string {
  return blocks.filter((b): b is string => Boolean(b && b.trim())).join('\n\n');
}

export function composeMatchArticle(match: Match): ComposedArticle {
  const score = formatScore(match.homeScore, match.awayScore);
  const title = score
    ? `${match.homeTeam} – ${match.awayTeam} ${score}`
    : `${match.homeTeam} – ${match.awayTeam}`;

  const dateWithTime = [formatCzechDate(match.matchDate), formatTime(match.matchTime)]
    .filter(Boolean)
    .join(' ');

  const scoreLine = score
    ? `**${match.homeTeam} – ${match.awayTeam} ${score}**`
    : `**${match.homeTeam} – ${match.awayTeam}**`;

  const meta = metaLine([
    match.competitionName,
    match.round !== undefined ? `${match.round}. kolo` : undefined,
    // FAČR sync sets tournamentName equal to competitionName; skip the duplicate
    match.tournamentName !== match.competitionName ? match.tournamentName : undefined,
    dateWithTime,
    match.venue,
  ]);

  const facts = joinBlocks([
    match.homeGoalscorers ? `**Branky ${match.homeTeam}:** ${match.homeGoalscorers}` : undefined,
    match.awayGoalscorers ? `**Branky ${match.awayTeam}:** ${match.awayGoalscorers}` : undefined,
    match.lineup ? `**Sestava:**\n${match.lineup}` : undefined,
  ]);

  const description = joinBlocks([
    scoreLine,
    meta,
    match.matchReport,
    facts ? `---\n\n${facts}` : undefined,
    match.imagesUrl ? `[Fotogalerie](${match.imagesUrl})` : undefined,
  ]);

  return { title, description };
}

/** Stable ordering: by date, then by creation time, then by id */
function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort(
    (a, b) =>
      (a.matchDate || '').localeCompare(b.matchDate || '') ||
      (a.createdAt || '').localeCompare(b.createdAt || '') ||
      a.id.localeCompare(b.id)
  );
}

function composeTournamentMatchLine(match: Match): string {
  const score = formatScore(match.homeScore, match.awayScore);
  const resultLine = score
    ? `**${match.homeTeam} – ${match.awayTeam}** ${score}`
    : `**${match.homeTeam} – ${match.awayTeam}**`;

  const scorers = [match.homeGoalscorers, match.awayGoalscorers]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(' – ');

  return scorers ? `${resultLine}\n*Branky: ${scorers}*` : resultLine;
}

export function composeTournamentArticle(tournament: Tournament): ComposedArticle {
  const title = tournament.name;

  const dateFrom = formatCzechDate(tournament.dateFrom);
  const dateTo = formatCzechDate(tournament.dateTo);
  const dateRange = dateFrom && dateTo && dateTo !== dateFrom
    ? `${dateFrom} – ${dateTo}`
    : dateFrom || dateTo;

  const meta = metaLine([
    dateRange,
    tournament.location,
    tournament.season !== undefined ? `Sezóna ${tournament.season}` : undefined,
  ]);

  const matches = sortMatches(tournament.matches ?? []);
  const results = matches.length > 0
    ? `#### Výsledky\n\n${matches.map(composeTournamentMatchLine).join('\n\n')}`
    : '';

  const awards = tournament.players && tournament.players.length > 0
    ? `#### Ocenění\n\n${tournament.players
        .map((p) => `- **${p.title}:** ${p.playerName}`)
        .join('\n')}`
    : '';

  const description = joinBlocks([
    meta,
    tournament.description,
    results,
    awards,
    tournament.imagesUrl ? `[Fotogalerie](${tournament.imagesUrl})` : undefined,
  ]);

  return { title, description };
}
