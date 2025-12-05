'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Event } from '@/types/event';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, Camera, Edit } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Alert from '@/components/ui/Alert';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import LastUpdatedInfo from '@/components/ui/LastUpdatedInfo';
import CommentSection from '@/components/CommentSection';
import ImageGallery from '@/components/ui/ImageGallery';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EventDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: userLoading } = useRequireAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchEvent = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/events/${id}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Nepodařilo se načíst událost');
        }

        setEvent(data.event);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Nepodařilo se načíst událost');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [user, id]);

  if (userLoading || loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="bg-background py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Alert variant="error">{error}</Alert>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zpět
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  const dateFrom = new Date(event.dateFrom);
  const formattedDateFrom = dateFrom.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formattedDateTo = event.dateTo
    ? new Date(event.dateTo).toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const eventTypeLabel = event.eventType === 'nadcházející' ? 'Nadcházející' : 'Proběhlá';
  const eventTypeColor = event.eventType === 'nadcházející'
    ? 'bg-primary/20 text-primary'
    : 'bg-success/20 text-success';

  const isOwner = user.id === event.authorId;

  return (
    <div className="bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/udalosti">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zpět na události
            </Button>
          </Link>
          {isOwner && (
            <Link href={`/upravit-udalost/${event.id}`}>
              <Button variant="secondary" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Upravit
              </Button>
            </Link>
          )}
        </div>

        <Card variant="elevated">
          <div className="space-y-6">
            {/* Author & Timestamp Info */}
            <div className="flex items-center justify-between text-sm text-text-muted">
              <div className="flex items-center gap-4">
                {event.author && (
                  <span>
                    Autor: <span className="font-medium text-text-secondary">{event.author.firstName} {event.author.lastName}</span>
                  </span>
                )}
                <LastUpdatedInfo
                  updatedBy={event.modifiedBy}
                  author={event.author}
                  updatedAt={event.updatedAt}
                />
              </div>
            </div>

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-text-primary mb-2">
                  {event.name}
                </h1>
                <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-medium ${eventTypeColor}`}>
                  {eventTypeLabel}
                </span>
              </div>
              {event.requiresPhotographer && (
                <div className="flex items-center gap-2 text-warning bg-warning/10 px-3 py-2 rounded-lg">
                  <Camera className="w-5 h-5" />
                  <span className="text-sm font-medium">Požadován fotograf</span>
                </div>
              )}
            </div>

            {/* Date & Time */}
            <div className="flex flex-wrap gap-6 text-text-secondary">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-text-muted" />
                <span>
                  {formattedDateFrom}
                  {formattedDateTo && ` - ${formattedDateTo}`}
                </span>
              </div>
              {event.eventTime && (
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-text-muted" />
                  <span>{event.eventTime}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div className="pt-6 border-t border-border">
                <p className="text-sm font-medium text-text-label mb-3">
                  Popis:
                </p>
                <p className="text-text-secondary whitespace-pre-line leading-relaxed">
                  {event.description}
                </p>
              </div>
            )}

            {/* Photos */}
            {event.photos && event.photos.length > 0 && (
              <div className="pt-6 border-t border-border">
                <p className="text-sm font-medium text-text-label mb-4">
                  Fotografie ({event.photos.length}):
                </p>
                <ImageGallery images={event.photos} />
              </div>
            )}

            {/* Files */}
            {event.files && event.files.length > 0 && (
              <div className="pt-6 border-t border-border">
                <p className="text-sm font-medium text-text-label mb-4">
                  Soubory ({event.files.length}):
                </p>
                <div className="space-y-2">
                  {event.files.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-surface-elevated rounded-lg border border-border hover:border-primary transition-colors"
                    >
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <span className="text-xs font-bold text-primary uppercase">
                          {file.ext?.replace('.', '') || 'FILE'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">{file.name}</p>
                        <p className="text-xs text-text-muted">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

          </div>
        </Card>

        {/* Comments Section */}
        <div className="mt-8">
          <Card variant="elevated">
            <CommentSection
              entityType="event"
              entityId={event.id}
              currentUserId={user.id}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
