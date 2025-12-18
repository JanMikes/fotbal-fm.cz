import { MatchResult } from '@/types/match-result';
import Card from '@/components/ui/Card';
import { Calendar, Edit, Image, User } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';

interface MatchResultCardProps {
  matchResult: MatchResult;
  currentUserId?: number;
}

export default function MatchResultCard({ matchResult, currentUserId }: MatchResultCardProps) {
  const isOwner = currentUserId && matchResult.authorId === currentUserId;

  const matchDate = new Date(matchResult.matchDate);
  const formattedDate = matchDate.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });

  return (
    <Card variant="elevated">
      <div className="space-y-4">
        {/* TOP: Actions & Date */}
        <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Link href={`/vysledek/${matchResult.id}`} className="flex-1 md:flex-none">
              <Button variant="secondary" size="sm" className="w-full md:w-auto">Detail</Button>
            </Link>
            {isOwner && (
              <Link href={`/upravit-vysledek/${matchResult.id}`} className="flex-1 md:flex-none">
                <Button variant="secondary" size="sm" className="w-full md:w-auto">
                  <Edit className="w-4 h-4 mr-1" />
                  Upravit
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Category Badges */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex flex-wrap gap-1.5">
            {matchResult.categories?.length > 0 ? (
              matchResult.categories.map((category) => (
                <span
                  key={category.id}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-accent/20 text-accent"
                >
                  {category.name}
                </span>
              ))
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-surface-hover text-text-muted">
                Bez kategorie
              </span>
            )}
          </div>
          <span className="flex items-center gap-1.5 text-text-muted">
            <Image className="w-4 h-4" />
            Fotografie {matchResult.images.length}
          </span>
        </div>

        {/* Match Score */}
        <div className="flex items-center justify-between">
          <div className="flex-1 text-right">
            <h3 className="text-sm md:text-lg font-medium md:font-semibold text-text-primary">
              {matchResult.homeTeam}
            </h3>
          </div>

          <div className="mx-2 md:mx-4">
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary/30 rounded-lg md:rounded-xl px-3 py-1 md:px-4 md:py-2">
              <div className="text-xl md:text-2xl font-bold text-text-primary text-center tracking-wider">
                {matchResult.homeScore} : {matchResult.awayScore}
              </div>
            </div>
          </div>

          <div className="flex-1">
            <h3 className="text-sm md:text-lg font-medium md:font-semibold text-text-primary">
              {matchResult.awayTeam}
            </h3>
          </div>
        </div>

        {/* Last updated info */}
        <div className="flex items-center gap-1.5 text-xs text-text-muted pt-2 border-t border-border">
          <User className="w-3 h-3" />
          <span>
            {matchResult.modifiedBy
              ? `${matchResult.modifiedBy.firstName} ${matchResult.modifiedBy.lastName}`
              : matchResult.author
                ? `${matchResult.author.firstName} ${matchResult.author.lastName}`
                : 'Neznámý'}
          </span>
          <span className="mx-1">•</span>
          <span>
            {new Date(matchResult.updatedAt).toLocaleDateString('cs-CZ', {
              day: 'numeric',
              month: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </Card>
  );
}
