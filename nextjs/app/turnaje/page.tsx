'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tournament } from '@/types/tournament';
import TournamentCard from '@/components/TournamentCard';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { Plus, Trophy } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Alert from '@/components/ui/Alert';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import FilterToggle from '@/components/ui/FilterToggle';

function TournamentsPageContent() {
  const { user, loading: userLoading } = useRequireAuth();
  const searchParams = useSearchParams();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const showSuccess = searchParams.get('success') === 'true';

  const fetchTournaments = useCallback(async (onlyMine: boolean) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tournaments/list?onlyMine=${onlyMine}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Nepodařilo se načíst turnaje');
      }

      setTournaments(data.tournaments);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Nepodařilo se načíst turnaje');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchTournaments(showOnlyMine);
  }, [user, showOnlyMine, fetchTournaments]);

  const handleFilterChange = (value: boolean) => {
    setShowOnlyMine(value);
  };

  if (userLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="bg-background py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              Turnaje
            </h1>
            <p className="text-text-secondary">
              Přehled všech turnajů
            </p>
          </div>

          <Link href="/novy-turnaj">
            <Button variant="primary" size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Nový turnaj
            </Button>
          </Link>
        </div>

        {!loading && tournaments.length > 0 && (
          <div className="mb-6">
            <FilterToggle
              storageKey="filter_showOnlyMine_turnaje"
              onChange={handleFilterChange}
            />
          </div>
        )}

        {showSuccess && (
          <div className="mb-6">
            <Alert variant="success">Turnaj byl úspěšně uložen!</Alert>
          </div>
        )}

        {error && (
          <div className="mb-6">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : tournaments.length === 0 && !error ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-surface-elevated rounded-full mb-4">
              <Trophy className="w-10 h-10 text-text-muted" />
            </div>
            <h2 className="text-2xl font-semibold text-text-primary mb-2">
              {showOnlyMine ? 'Nemáte žádné turnaje' : 'Zatím žádné turnaje'}
            </h2>
            <p className="text-text-secondary mb-6">
              Začněte vytvořením prvního turnaje
            </p>
            <Link href="/novy-turnaj">
              <Button variant="primary" size="lg">
                <Plus className="w-5 h-5 mr-2" />
                Přidat první turnaj
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {tournaments.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                currentUserId={user.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TournamentsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center bg-background pt-32">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="text-text-secondary">Načítání...</p>
        </div>
      </div>
    }>
      <TournamentsPageContent />
    </Suspense>
  );
}
