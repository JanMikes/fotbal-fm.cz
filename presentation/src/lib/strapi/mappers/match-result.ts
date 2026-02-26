import type { Match } from '@/lib/types';
import type { StrapiRawMatchResult } from '../types';

const CZECH_DAYS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

function formatCzechDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = CZECH_DAYS[date.getDay()];
  const dayNum = date.getDate();
  const month = date.getMonth() + 1;
  return `${day} ${dayNum}. ${month}.`;
}

export function mapMatchResult(raw: StrapiRawMatchResult): Match {
  const hasScore = raw.homeScore !== null && raw.awayScore !== null;

  return {
    id: raw.id,
    homeTeam: raw.homeTeam,
    awayTeam: raw.awayTeam,
    homeScore: raw.homeScore,
    awayScore: raw.awayScore,
    matchDate: formatCzechDate(raw.matchDate),
    matchTime: raw.matchTime ?? '',
    venue: raw.venue ?? '',
    round: raw.round,
    competitionName: raw.competitionName ?? '',
    status: hasScore ? 'finished' : 'upcoming',
  };
}
