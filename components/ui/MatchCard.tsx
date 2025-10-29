import { Calendar, MapPin } from 'lucide-react';
import type { Match } from '@/types';

interface MatchCardProps {
  match: Match;
  isLast?: boolean;
}

export default function MatchCard({ match, isLast = false }: MatchCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'long',
    });
  };

  const hasScore = match.homeScore !== undefined && match.awayScore !== undefined;

  return (
    <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow p-6 border border-gray-100">
      {/* Competition Info */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-secondary">
          {match.competition}
        </span>
        {match.round && (
          <span className="text-sm text-gray-500">{match.round}</span>
        )}
      </div>

      {/* Teams and Score */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-xl font-bold text-primary">FM</span>
          </div>
          <p className="font-semibold text-sm md:text-base text-gray-800">
            {match.homeTeam}
          </p>
        </div>

        <div className="flex-shrink-0 px-4">
          {hasScore ? (
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {match.homeScore} : {match.awayScore}
              </div>
              {isLast && (
                <span className="text-xs text-gray-500 mt-1 block">Konečný výsledek</span>
              )}
            </div>
          ) : (
            <div className="text-2xl font-bold text-gray-300">VS</div>
          )}
        </div>

        <div className="flex-1 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-xl font-bold text-gray-400">?</span>
          </div>
          <p className="font-semibold text-sm md:text-base text-gray-800">
            {match.awayTeam}
          </p>
        </div>
      </div>

      {/* Date and Location */}
      <div className="pt-4 border-t border-gray-100 space-y-2">
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4 text-secondary" />
          <span>{formatDate(match.date)} v {match.time}</span>
        </div>
        {match.location && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 text-secondary" />
            <span>{match.location}</span>
          </div>
        )}
      </div>
    </div>
  );
}
