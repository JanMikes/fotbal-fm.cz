import { Match } from '@/types/match';
import Card from '@/components/ui/Card';
import { Calendar, Edit, Image as ImageIcon, User, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import TeamLogo from '@/components/ui/TeamLogo';

interface MatchResultCardProps {
  match: Match;
}

export default function MatchResultCard({ match }: MatchResultCardProps) {
  const matchDate = new Date(match.matchDate);
  const formattedDate = matchDate.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const isFuture = match.homeScore === null || match.awayScore === null;

  return (
    <Card variant="elevated" className={isFuture ? 'opacity-80' : ''}>
      <div className="space-y-4">
        {/* TOP: Actions & Date */}
        <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Link href={`/vysledek/${match.id}`} className="flex-1 md:flex-none">
              <Button variant="secondary" size="sm" className="w-full md:w-auto">Detail</Button>
            </Link>
            <Link href={`/vysledek/${match.id}#komentare`} className="flex-1 md:flex-none">
              <Button variant="secondary" size="sm" className="w-full md:w-auto">
                <MessageCircle className="w-4 h-4 mr-1" />
                Okomentovat
              </Button>
            </Link>
            <Link href={`/upravit-vysledek/${match.id}`} className="flex-1 md:flex-none">
              <Button variant="secondary" size="sm" className="w-full md:w-auto">
                <Edit className="w-4 h-4 mr-1" />
                Upravit
              </Button>
            </Link>
          </div>
        </div>

        {/* Category Badges */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex flex-wrap gap-1.5">
            {match.categories?.length > 0 ? (
              match.categories.map((category) => (
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
            <ImageIcon className="w-4 h-4" />
            Fotografie {match.images.length}
          </span>
        </div>

        {/* Tournament name */}
        {match.tournamentName && (
          <p className="text-xs text-text-muted">{match.tournamentName}</p>
        )}

        {/* Match Score */}
        <div className="flex items-center justify-between">
          <div className="flex-1 flex items-center justify-end gap-2">
            <h3 className="text-sm md:text-lg font-medium md:font-semibold text-text-primary text-right">
              {match.homeTeam}
            </h3>
            <TeamLogo name={match.homeTeam} logo={match.homeTeamLogo} size={28} />
          </div>

          <div className="mx-2 md:mx-4">
            {isFuture ? (
              <div className="px-3 py-1 md:px-4 md:py-2">
                <div className="text-lg md:text-xl font-medium text-text-muted text-center tracking-wider">
                  vs
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary/30 rounded-lg md:rounded-xl px-3 py-1 md:px-4 md:py-2">
                <div className="text-xl md:text-2xl font-bold text-text-primary text-center tracking-wider">
                  {match.homeScore} : {match.awayScore}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 flex items-center gap-2">
            <TeamLogo name={match.awayTeam} logo={match.awayTeamLogo} size={28} />
            <h3 className="text-sm md:text-lg font-medium md:font-semibold text-text-primary">
              {match.awayTeam}
            </h3>
          </div>
        </div>

        {/* Last updated info */}
        <div className="flex items-center gap-1.5 text-xs text-text-muted pt-2 border-t border-border">
          <User className="w-3 h-3" />
          <span>
            {match.modifiedBy
              ? `${match.modifiedBy.firstName} ${match.modifiedBy.lastName}`
              : match.author
                ? `${match.author.firstName} ${match.author.lastName}`
                : 'Neznámý'}
          </span>
          <span className="mx-1">•</span>
          <span>
            {new Date(match.updatedAt).toLocaleDateString('cs-CZ', {
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
