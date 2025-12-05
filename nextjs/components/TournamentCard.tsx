import { Tournament } from '@/types/tournament';
import Card from '@/components/ui/Card';
import { Calendar, MapPin, Edit, Image, User } from 'lucide-react';
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
        {/* TOP: Date & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Calendar className="w-4 h-4" />
            <span>
              {formattedDateFrom}
              {formattedDateTo && ` - ${formattedDateTo}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/turnaj/${tournament.id}`}>
              <Button variant="secondary" size="sm">Detail</Button>
            </Link>
            {isOwner && (
              <Link href={`/upravit-turnaj/${tournament.id}`}>
                <Button variant="secondary" size="sm">
                  <Edit className="w-4 h-4 mr-1" />
                  Upravit
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-text-primary">
          {tournament.name}
        </h3>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-accent/20 text-accent">
            {tournament.category}
          </span>
          {tournament.location && (
            <div className="flex items-center gap-1.5 text-text-secondary">
              <MapPin className="w-4 h-4 text-text-muted" />
              <span>{tournament.location}</span>
            </div>
          )}
          {tournament.photos && tournament.photos.length > 0 && (
            <span className="flex items-center gap-1.5 text-text-muted">
              <Image className="w-4 h-4" />
              Fotografie {tournament.photos.length}
            </span>
          )}
        </div>

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
