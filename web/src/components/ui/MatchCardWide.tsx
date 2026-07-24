'use client';

import { clsx } from 'clsx';
import { MapPin } from 'lucide-react';
import type { Match } from '@/lib/types';
import TeamLogo from './TeamLogo';

const CZECH_DAYS_SHORT = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

function formatFullDate(rawDate: string): string {
  const date = new Date(rawDate + 'T00:00:00');
  const day = CZECH_DAYS_SHORT[date.getDay()];
  const dayNum = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day} ${dayNum}.${month}.${year}`;
}

interface MatchCardWideProps {
  match: Match;
  className?: string;
}

export default function MatchCardWide({ match, className }: MatchCardWideProps) {
  const isFinished = match.status === 'finished';
  const homeWon = isFinished && match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore;
  const awayWon = isFinished && match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore;

  return (
    <div
      className={clsx(
        'flex bg-white border border-surface-light overflow-hidden shadow-card',
        isFinished && 'opacity-80',
        className
      )}
    >
      {/* Left panel - category, round & date */}
      <div className="flex flex-col items-center justify-center bg-primary py-4 w-[120px] sm:w-[150px] shrink-0">
        {match.categoryName && (
          <span className="text-accent-light text-[11px] font-bold uppercase tracking-wider text-center leading-tight px-2 mb-2">
            {match.categoryName}
          </span>
        )}
        {match.round && (
          <span className="text-white font-semibold text-sm mb-2">
            {match.round}. kolo
          </span>
        )}
        <span className="text-[11px] text-accent-light font-medium border border-accent-light/60 rounded-full px-3 py-1 whitespace-nowrap">
          {formatFullDate(match.rawMatchDate)}
        </span>
        {match.matchTime && (
          <span className="text-accent text-sm font-semibold mt-1.5 sm:hidden">
            {match.matchTime}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 items-center px-4 md:px-6 py-4 gap-4 md:gap-6 min-w-0">
        {/* Time badge - desktop only (on mobile it's in the left panel) */}
        {match.matchTime && (
          <span className="bg-accent text-white text-sm font-medium rounded-full px-4 py-1.5 whitespace-nowrap shrink-0 hidden sm:block">
            {match.matchTime}
          </span>
        )}

        {/* Teams & scores */}
        <div className="flex-1 min-w-0">
          {/* Home team */}
          <div className="flex items-center gap-3">
            <TeamLogo
              name={match.homeTeam}
              logo={match.homeTeamLogo}
              size={36}
              className="w-9 h-9 flex items-center justify-center overflow-hidden shrink-0"
              bgClassName="bg-surface-light"
              fallbackClassName="text-xs font-bold text-primary/40"
            />
            {isFinished && (
              <span className={clsx(
                'text-xl md:text-2xl font-bold number-display shrink-0 w-8 md:w-10 text-center',
                homeWon ? 'text-primary' : 'text-primary/50'
              )}>
                {match.homeScore}
              </span>
            )}
            <span className={clsx(
              'font-bold text-base md:text-lg truncate',
              homeWon ? 'text-primary' : 'text-primary/80'
            )}>
              {match.homeTeam}
            </span>
          </div>

          {/* Away team */}
          <div className="flex items-center gap-3 mt-1">
            <TeamLogo
              name={match.awayTeam}
              logo={match.awayTeamLogo}
              size={36}
              className="w-9 h-9 flex items-center justify-center overflow-hidden shrink-0"
              bgClassName="bg-surface-light"
              fallbackClassName="text-xs font-bold text-primary/40"
            />
            {isFinished && (
              <span className={clsx(
                'text-xl md:text-2xl font-bold number-display shrink-0 w-8 md:w-10 text-center',
                awayWon ? 'text-primary' : 'text-primary/50'
              )}>
                {match.awayScore}
              </span>
            )}
            <span className={clsx(
              'font-semibold truncate',
              awayWon ? 'text-primary' : 'text-primary/70'
            )}>
              {match.awayTeam}
            </span>
          </div>

          {/* Venue - mobile only */}
          {match.venue && (
            <div className="flex items-center gap-1 mt-2 text-xs text-primary/50 md:hidden">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{match.venue}</span>
            </div>
          )}
        </div>

        {/* Right side - venue */}
        {match.venue && (
          <div className="text-sm text-primary/50 text-right shrink-0 hidden md:flex md:items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {match.venue}
          </div>
        )}
      </div>
    </div>
  );
}
