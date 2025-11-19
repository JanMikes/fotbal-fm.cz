import { MatchResult } from '@/types/match-result';
import Card from '@/components/ui/Card';
import { Calendar, User } from 'lucide-react';

interface MatchResultCardProps {
  matchResult: MatchResult;
}

export default function MatchResultCard({ matchResult }: MatchResultCardProps) {
  const matchDate = new Date(matchResult.createdAt);
  const formattedDate = matchDate.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';

  return (
    <Card variant="elevated">
      <div className="space-y-4">
        {/* Match Score */}
        <div className="flex items-center justify-between">
          <div className="flex-1 text-right">
            <h3 className="text-lg font-semibold text-text-primary">
              {matchResult.homeTeam}
            </h3>
          </div>

          <div className="mx-6 text-center">
            <div className="text-3xl font-bold text-primary">
              {matchResult.homeScore} : {matchResult.awayScore}
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-text-primary">
              {matchResult.awayTeam}
            </h3>
          </div>
        </div>

        {/* Goalscorers */}
        {(matchResult.homeGoalscorers || matchResult.awayGoalscorers) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
            <div className="text-right md:pr-4">
              {matchResult.homeGoalscorers && (
                <div>
                  <p className="text-sm font-medium text-text-label mb-1">
                    Střelci:
                  </p>
                  <p className="text-sm text-text-secondary whitespace-pre-line">
                    {matchResult.homeGoalscorers}
                  </p>
                </div>
              )}
            </div>
            <div className="md:pl-4">
              {matchResult.awayGoalscorers && (
                <div>
                  <p className="text-sm font-medium text-text-label mb-1">
                    Střelci:
                  </p>
                  <p className="text-sm text-text-secondary whitespace-pre-line">
                    {matchResult.awayGoalscorers}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Match Report */}
        {matchResult.matchReport && (
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-medium text-text-label mb-2">
              Zpráva ze zápasu:
            </p>
            <p className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
              {matchResult.matchReport}
            </p>
          </div>
        )}

        {/* Images */}
        {matchResult.images.length > 0 && (
          <div className="pt-4 border-t border-border">
            <p className="text-sm font-medium text-text-label mb-3">
              Fotografie ({matchResult.images.length}):
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {matchResult.images.map((image, index) => (
                <a
                  key={image.id}
                  href={`${STRAPI_URL}${image.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <img
                    src={
                      image.formats.thumbnail
                        ? `${STRAPI_URL}${image.formats.thumbnail.url}`
                        : `${STRAPI_URL}${image.url}`
                    }
                    alt={image.alternativeText || `Fotografie ${index + 1}`}
                    className="w-full h-24 object-cover rounded-lg border-2 border-border group-hover:border-primary transition-all duration-200 group-hover:shadow-lg group-hover:shadow-primary/20"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between pt-4 border-t border-border text-sm text-text-muted">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
