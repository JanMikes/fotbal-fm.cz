'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Tournament } from '@/types/tournament';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { ArrowLeft, Calendar, MapPin, Edit, Users, Trophy } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Alert from '@/components/ui/Alert';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import LastUpdatedInfo from '@/components/ui/LastUpdatedInfo';
import CommentSection from '@/components/CommentSection';
import ImageGallery from '@/components/ui/ImageGallery';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TournamentDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: userLoading } = useRequireAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchTournament = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tournaments/${id}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Nepodařilo se načíst turnaj');
        }

        setTournament(data.tournament);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Nepodařilo se načíst turnaj');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTournament();
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

  if (!tournament) {
    return null;
  }

  const dateFrom = new Date(tournament.dateFrom);
  const formattedDateFrom = dateFrom.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formattedDateTo = tournament.dateTo
    ? new Date(tournament.dateTo).toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const isOwner = user.id === tournament.authorId;

  return (
    <div className="bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/turnaje">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zpět na turnaje
            </Button>
          </Link>
          {isOwner && (
            <div className="flex gap-2">
              <Link href={`/novy-turnajovy-zapas?tournamentId=${tournament.id}`}>
                <Button variant="secondary" size="sm">
                  <Users className="w-4 h-4 mr-2" />
                  Přidat zápas
                </Button>
              </Link>
              <Link href={`/upravit-turnaj/${tournament.id}`}>
                <Button variant="secondary" size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  Upravit
                </Button>
              </Link>
            </div>
          )}
        </div>

        <Card variant="elevated">
          <div className="space-y-6">
            {/* Author & Timestamp Info */}
            <div className="flex items-center justify-between text-sm text-text-muted">
              <div className="flex items-center gap-4">
                {tournament.author && (
                  <span>
                    Autor: <span className="font-medium text-text-secondary">{tournament.author.firstName} {tournament.author.lastName}</span>
                  </span>
                )}
                <LastUpdatedInfo
                  updatedBy={tournament.modifiedBy}
                  author={tournament.author}
                  updatedAt={tournament.updatedAt}
                />
              </div>
            </div>

            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">
                {tournament.name}
              </h1>
              <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium bg-accent/20 text-accent">
                {tournament.category}
              </span>
            </div>

            {/* Date & Location */}
            <div className="flex flex-wrap gap-6 text-text-secondary">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-text-muted" />
                <span>
                  {formattedDateFrom}
                  {formattedDateTo && ` - ${formattedDateTo}`}
                </span>
              </div>
              {tournament.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-text-muted" />
                  <span>{tournament.location}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {tournament.description && (
              <div className="pt-6 border-t border-border">
                <p className="text-sm font-medium text-text-label mb-3">
                  Popis / Report:
                </p>
                <p className="text-text-secondary whitespace-pre-line leading-relaxed">
                  {tournament.description}
                </p>
              </div>
            )}

            {/* Photos */}
            {tournament.photos && tournament.photos.length > 0 && (
              <div className="pt-6 border-t border-border">
                <p className="text-sm font-medium text-text-label mb-4">
                  Fotografie ({tournament.photos.length}):
                </p>
                <ImageGallery images={tournament.photos} />
              </div>
            )}

            {/* Matches */}
            {tournament.matches && tournament.matches.length > 0 && (
              <div className="pt-6 border-t border-border">
                <p className="text-sm font-medium text-text-label mb-4">
                  Zápasy ({tournament.matches.length}):
                </p>
                <div className="space-y-3">
                  {tournament.matches.map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between p-4 bg-surface-elevated rounded-lg border border-border"
                    >
                      <span className="font-medium text-text-primary">{match.homeTeam}</span>
                      <div className="px-4 py-1 bg-primary/10 rounded-lg">
                        <span className="font-bold text-primary">
                          {match.homeScore} : {match.awayScore}
                        </span>
                      </div>
                      <span className="font-medium text-text-primary">{match.awayTeam}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Players / Awards */}
            {tournament.players && tournament.players.length > 0 && (
              <div className="pt-6 border-t border-border">
                <p className="text-sm font-medium text-text-label mb-4">
                  Ocenění hráčů ({tournament.players.length}):
                </p>
                <div className="space-y-3">
                  {tournament.players.map((player, index) => (
                    <div
                      key={player.id || index}
                      className="flex items-center gap-4 p-4 bg-surface-elevated rounded-lg border border-border"
                    >
                      <Trophy className="w-5 h-5 text-accent flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-text-muted">{player.title}</p>
                        <p className="font-medium text-text-primary">{player.playerName}</p>
                      </div>
                    </div>
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
              entityType="tournament"
              entityId={tournament.id}
              currentUserId={user.id}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
