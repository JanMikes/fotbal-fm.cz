import { Tournament } from '@/types/tournament';
import Card from '@/components/ui/Card';
import { Calendar, MapPin, Edit, Image, User, Trophy } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';

interface TournamentCardProps {
  tournament: Tournament;
  currentUserId?: number;
}

export default function TournamentCard({ tournament, currentUserId }: TournamentCardProps) {
  const isOwner = currentUserId && tournament.authorId === currentUserId;
  const dateFrom = new Date(tournament.dateFrom);
  const formattedDateFrom = dateFrom.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });

  const formattedDateTo = tournament.dateTo
    ? new Date(tournament.dateTo).toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <Card variant="elevated">
      <div className="space-y-3">
        {/* TOP: Actions & Date */}
        <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Calendar className="w-4 h-4" />
            <span>
              {formattedDateFrom}
              {formattedDateTo && ` - ${formattedDateTo}`}
            </span>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Link href={`/turnaj/${tournament.id}`} className="flex-1 md:flex-none">
              <Button variant="secondary" size="sm" className="w-full md:w-auto">Detail</Button>
            </Link>
            {isOwner && (
              <Link href={`/upravit-turnaj/${tournament.id}`} className="flex-1 md:flex-none">
                <Button variant="secondary" size="sm" className="w-full md:w-auto">
                  <Edit className="w-4 h-4 mr-1" />
                  Upravit
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Category & counts */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent/20 text-accent">
            {tournament.category}
          </span>
          <div className="flex items-center gap-4 text-text-muted">
            <span className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4" />
              Zápasy {tournament.matches?.length ?? 0}
            </span>
            <span className="flex items-center gap-1.5">
              <Image className="w-4 h-4" />
              Fotografie {tournament.photos?.length ?? 0}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-text-primary">
          {tournament.name}
        </h3>

        {/* Location */}
        {tournament.location && (
          <div className="flex items-center gap-1.5 text-sm text-text-secondary">
            <MapPin className="w-4 h-4 text-text-muted" />
            <span>{tournament.location}</span>
          </div>
        )}

        {/* Last updated info */}
        <div className="flex items-center gap-1.5 text-xs text-text-muted pt-2 border-t border-border">
          <User className="w-3 h-3" />
          <span>
            {tournament.modifiedBy
              ? `${tournament.modifiedBy.firstName} ${tournament.modifiedBy.lastName}`
              : tournament.author
                ? `${tournament.author.firstName} ${tournament.author.lastName}`
                : 'Neznámý'}
          </span>
          <span className="mx-1">•</span>
          <span>
            {new Date(tournament.updatedAt).toLocaleDateString('cs-CZ', {
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
