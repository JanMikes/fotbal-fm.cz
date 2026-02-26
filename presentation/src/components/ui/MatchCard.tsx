'use client';

import { clsx } from 'clsx';
import type { Match } from '@/lib/types';

interface MatchCardProps {
  match: Match;
  className?: string;
}

export default function MatchCard({ match, className }: MatchCardProps) {
  const isFinished = match.status === 'finished';
  const homeWon = isFinished && match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore;
  const awayWon = isFinished && match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore;

  return (
    <div
      className={clsx(
        'bg-white p-6 shadow-card card-lift',
        'border border-surface-light',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-surface-light">
        {match.round && (
          <span className="text-small text-primary/60 font-medium">
            {match.round}. kolo
          </span>
        )}
        <span className="text-small text-primary/60">
          {match.matchDate}
        </span>
      </div>

      {/* Teams & Score */}
      <div className="space-y-3">
        {/* Home Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface-light flex items-center justify-center overflow-hidden">
              <span className="text-xs font-bold text-primary/40">
                {match.homeTeam.substring(0, 2).toUpperCase()}
              </span>
            </div>
            <span className={clsx(
              'font-semibold transition-colors',
              homeWon ? 'text-primary' : 'text-primary/80'
            )}>
              {match.homeTeam}
            </span>
          </div>
          {isFinished && (
            <span className={clsx(
              'text-2xl font-bold number-display',
              homeWon ? 'text-primary' : 'text-primary/60'
            )}>
              {match.homeScore}
            </span>
          )}
        </div>

        {/* Score separator for upcoming matches */}
        {!isFinished && (
          <div className="flex items-center justify-center">
            <span className="text-2xl font-bold text-primary/20">vs</span>
          </div>
        )}

        {/* Score display for finished */}
        {isFinished && (
          <div className="flex items-center justify-center">
            <span className="text-primary/30 text-lg">:</span>
          </div>
        )}

        {/* Away Team */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface-light flex items-center justify-center overflow-hidden">
              <span className="text-xs font-bold text-primary/40">
                {match.awayTeam.substring(0, 2).toUpperCase()}
              </span>
            </div>
            <span className={clsx(
              'font-semibold transition-colors',
              awayWon ? 'text-primary' : 'text-primary/80'
            )}>
              {match.awayTeam}
            </span>
          </div>
          {isFinished && (
            <span className={clsx(
              'text-2xl font-bold number-display',
              awayWon ? 'text-primary' : 'text-primary/60'
            )}>
              {match.awayScore}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-surface-light flex items-center justify-between text-small text-primary/60">
        <span>{match.matchTime}</span>
        <span>{match.venue}</span>
      </div>
    </div>
  );
}
