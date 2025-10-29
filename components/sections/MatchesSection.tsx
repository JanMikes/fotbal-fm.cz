import MatchCard from '../ui/MatchCard';
import type { MatchesData } from '@/types';

interface MatchesSectionProps {
  matchesData: MatchesData;
}

export default function MatchesSection({ matchesData }: MatchesSectionProps) {
  const { lastMatch, upcomingMatches } = matchesData;

  // Show first upcoming match alongside last match if available
  const firstUpcoming = upcomingMatches[0];
  const remainingUpcoming = upcomingMatches.slice(1);

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-4xl font-bold text-primary mb-10 text-center">
          Zápasy
        </h2>

        <div className="space-y-12">
          {/* Last Match + Next Match */}
          {(lastMatch || firstUpcoming) && (
            <div>
              <h3 className="text-2xl font-semibold text-gray-800 mb-6">
                Poslední zápas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {lastMatch && <MatchCard match={lastMatch} isLast={true} />}
                {firstUpcoming && <MatchCard match={firstUpcoming} />}
              </div>
            </div>
          )}

          {/* Remaining Upcoming Matches */}
          {remainingUpcoming.length > 0 && (
            <div>
              <h3 className="text-2xl font-semibold text-gray-800 mb-6">
                Další nadcházející zápasy
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {remainingUpcoming.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
