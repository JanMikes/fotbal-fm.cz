'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { MatchResult } from '@/types/match-result';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { ArrowLeft, Calendar, Edit } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Alert from '@/components/ui/Alert';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import LastUpdatedInfo from '@/components/ui/LastUpdatedInfo';
import CommentSection from '@/components/CommentSection';
import ImageGallery from '@/components/ui/ImageGallery';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MatchResultDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: userLoading } = useRequireAuth();
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchMatchResult = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/match-results/${id}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Nepodařilo se načíst výsledek');
        }

        setMatchResult(data.matchResult);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Nepodařilo se načíst výsledek');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMatchResult();
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

  if (!matchResult) {
    return null;
  }

  const matchDate = new Date(matchResult.createdAt);
  const formattedDate = matchDate.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isOwner = user.id === matchResult.authorId;

  return (
    <div className="bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/vysledky">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zpět na výsledky
            </Button>
          </Link>
          {isOwner && (
            <Link href={`/upravit-vysledek/${matchResult.id}`}>
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
                {matchResult.author && (
                  <span className="font-medium text-text-secondary">{matchResult.author.firstName} {matchResult.author.lastName}</span>
                )}
                <LastUpdatedInfo
                  updatedBy={matchResult.modifiedBy}
                  author={matchResult.author}
                  updatedAt={matchResult.updatedAt}
                />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{formattedDate}</span>
              </div>
            </div>

            {/* Category Badge */}
            <div className="text-center">
              <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium bg-accent/20 text-accent">
                {matchResult.category}
              </span>
            </div>

            {/* Match Score */}
            <div className="flex items-center justify-between">
              <div className="flex-1 text-right">
                <h3 className="text-sm md:text-xl font-medium md:font-semibold text-text-primary">
                  {matchResult.homeTeam}
                </h3>
              </div>

              <div className="mx-2 md:mx-6">
                <div className="bg-gradient-to-br from-primary/10 to-accent/10 border-2 border-primary/30 rounded-lg md:rounded-2xl px-3 py-1 md:px-8 md:py-4 shadow-lg shadow-primary/10">
                  <div className="text-xl md:text-5xl font-bold text-text-primary text-center tracking-wider">
                    {matchResult.homeScore} : {matchResult.awayScore}
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-sm md:text-xl font-medium md:font-semibold text-text-primary">
                  {matchResult.awayTeam}
                </h3>
              </div>
            </div>

            {/* Goalscorers */}
            {(matchResult.homeGoalscorers || matchResult.awayGoalscorers) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border">
                <div className="text-right md:pr-6">
                  {matchResult.homeGoalscorers && (
                    <div>
                      <p className="text-sm font-medium text-text-label mb-2">
                        Střelci domácích:
                      </p>
                      <p className="text-text-secondary whitespace-pre-line">
                        {matchResult.homeGoalscorers}
                      </p>
                    </div>
                  )}
                </div>
                <div className="md:pl-6">
                  {matchResult.awayGoalscorers && (
                    <div>
                      <p className="text-sm font-medium text-text-label mb-2">
                        Střelci hostů:
                      </p>
                      <p className="text-text-secondary whitespace-pre-line">
                        {matchResult.awayGoalscorers}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Match Report */}
            {matchResult.matchReport && (
              <div className="pt-6 border-t border-border">
                <p className="text-sm font-medium text-text-label mb-3">
                  Zpráva ze zápasu:
                </p>
                <p className="text-text-secondary whitespace-pre-line leading-relaxed">
                  {matchResult.matchReport}
                </p>
              </div>
            )}

            {/* Images */}
            {matchResult.images.length > 0 && (
              <div className="pt-6 border-t border-border">
                <p className="text-sm font-medium text-text-label mb-4">
                  Fotografie ({matchResult.images.length}):
                </p>
                <ImageGallery images={matchResult.images} />
              </div>
            )}

          </div>
        </Card>

        {/* Comments Section */}
        <div className="mt-8">
          <Card variant="elevated">
            <CommentSection
              entityType="matchResult"
              entityId={matchResult.id}
              currentUserId={user.id}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
