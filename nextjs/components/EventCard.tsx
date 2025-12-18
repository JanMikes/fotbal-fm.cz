import { Event } from '@/types/event';
import Card from '@/components/ui/Card';
import { Calendar, Clock, Camera, Edit, Image, User } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';

interface EventCardProps {
  event: Event;
  currentUserId?: number;
}

export default function EventCard({ event, currentUserId }: EventCardProps) {
  const isOwner = currentUserId && event.authorId === currentUserId;
  const dateFrom = new Date(event.dateFrom);
  const formattedDateFrom = dateFrom.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });

  const formattedDateTo = event.dateTo
    ? new Date(event.dateTo).toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
      })
    : null;

  const eventTypeLabel = event.eventType === 'nadcházející' ? 'Nadcházející' : 'Proběhlá';
  const eventTypeColor = event.eventType === 'nadcházející'
    ? 'bg-primary/20 text-primary'
    : 'bg-success/20 text-success';

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
            {event.eventTime && (
              <>
                <Clock className="w-4 h-4 ml-2" />
                <span>{event.eventTime}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Link href={`/udalost/${event.id}`} className="flex-1 md:flex-none">
              <Button variant="secondary" size="sm" className="w-full md:w-auto">Detail</Button>
            </Link>
            {isOwner && (
              <Link href={`/upravit-udalost/${event.id}`} className="flex-1 md:flex-none">
                <Button variant="secondary" size="sm" className="w-full md:w-auto">
                  <Edit className="w-4 h-4 mr-1" />
                  Upravit
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-text-primary">
          {event.name}
        </h3>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${eventTypeColor}`}>
            {eventTypeLabel}
          </span>
          {event.categories && event.categories.length > 0 && (
            event.categories.map((cat) => (
              <span
                key={cat.id}
                className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent/20 text-accent"
              >
                {cat.name}
              </span>
            ))
          )}
          {event.requiresPhotographer && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/20 text-warning">
              <Camera className="w-3 h-3" />
              <span className="text-xs font-medium">Fotograf</span>
            </div>
          )}
        </div>

        {/* Photo count */}
        <div className="flex items-center text-sm">
          <span className="flex items-center gap-1.5 text-text-muted">
            <Image className="w-4 h-4" />
            Fotografie {event.photos?.length ?? 0}
          </span>
        </div>

        {/* Last updated info */}
        <div className="flex items-center gap-1.5 text-xs text-text-muted pt-2 border-t border-border">
          <User className="w-3 h-3" />
          <span>
            {event.modifiedBy
              ? `${event.modifiedBy.firstName} ${event.modifiedBy.lastName}`
              : event.author
                ? `${event.author.firstName} ${event.author.lastName}`
                : 'Neznámý'}
          </span>
          <span className="mx-1">•</span>
          <span>
            {new Date(event.updatedAt).toLocaleDateString('cs-CZ', {
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
