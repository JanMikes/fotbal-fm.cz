'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { MatchResult } from '@/types/match-result';
import MatchResultCard from '@/components/MatchResultCard';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { Plus, Trophy } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Alert from '@/components/ui/Alert';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import FilterToggle from '@/components/ui/FilterToggle';

function MatchResultsPageContent() {
  const { user, loading: userLoading } = useRequireAuth();
  const searchParams = useSearchParams();
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const showSuccess = searchParams.get('success') === 'true';

  const fetchMatchResults = useCallback(async (onlyMine: boolean) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/match-results/list?onlyMine=${onlyMine}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Nepodařilo se načíst výsledky');
      }

      setMatchResults(data.data.matchResults);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Nepodařilo se načíst výsledky');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchMatchResults(showOnlyMine);
  }, [user, showOnlyMine, fetchMatchResults]);

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
              Výsledky zápasů
            </h1>
            <p className="text-text-secondary">
              Přehled všech výsledků zápasů
            </p>
          </div>

          <Link href="/zadat-vysledek">
            <Button variant="primary" size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Přidat výsledek
            </Button>
          </Link>
        </div>

        {!loading && matchResults.length > 0 && (
          <div className="mb-6">
            <FilterToggle
              storageKey="filter_showOnlyMine_vysledky"
              onChange={handleFilterChange}
            />
          </div>
        )}

        {showSuccess && (
          <div className="mb-6">
            <Alert variant="success">Výsledek zápasu byl úspěšně uložen!</Alert>
          </div>
        )}

        {error && (
          <div className="mb-6">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : matchResults.length === 0 && !error ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-surface-elevated rounded-full mb-4">
              <Trophy className="w-10 h-10 text-text-muted" />
            </div>
            <h2 className="text-2xl font-semibold text-text-primary mb-2">
              {showOnlyMine ? 'Nemáte žádné výsledky' : 'Zatím žádné výsledky'}
            </h2>
            <p className="text-text-secondary mb-6">
              Začněte zadáním prvního výsledku zápasu
            </p>
            <Link href="/zadat-vysledek">
              <Button variant="primary" size="lg">
                <Plus className="w-5 h-5 mr-2" />
                Přidat první výsledek
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {matchResults.map((matchResult) => (
              <MatchResultCard
                key={matchResult.id}
                matchResult={matchResult}
                currentUserId={user.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MatchResultsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center bg-background pt-32">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="text-text-secondary">Načítání...</p>
        </div>
      </div>
    }>
      <MatchResultsPageContent />
    </Suspense>
  );
}
