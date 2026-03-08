'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Match } from '@/types/match';
import MatchResultCard from '@/components/MatchResultCard';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { Plus, Trophy } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Alert from '@/components/ui/Alert';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import CategoryFilter from '@/components/ui/CategoryFilter';

function MatchResultsPageContent() {
  const { user, loading: userLoading } = useRequireAuth();
  const searchParams = useSearchParams();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [matchFilter, setMatchFilter] = useState<'played' | 'future'>('played');
  const showSuccess = searchParams.get('success') === 'true';

  const fetchMatches = useCallback(async (category: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (category) {
        params.set('category', category);
      }
      const response = await fetch(`/api/matches/list?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Nepodařilo se načíst výsledky');
      }

      setMatches(data.data.matches);
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
    fetchMatches(selectedCategory);
  }, [user, selectedCategory, fetchMatches]);

  const filteredMatches = matches
    .filter((m) => {
      const isPlayed = m.homeScore !== null && m.awayScore !== null;
      return matchFilter === 'played' ? isPlayed : !isPlayed;
    })
    .sort((a, b) => {
      if (matchFilter === 'future') {
        return a.matchDate.localeCompare(b.matchDate);
      }
      return b.matchDate.localeCompare(a.matchDate);
    });

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
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

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CategoryFilter
            value={selectedCategory}
            onChange={handleCategoryChange}
          />
          <div className="flex w-full sm:w-auto rounded-lg border border-border overflow-hidden shrink-0">
            <button
              onClick={() => setMatchFilter('played')}
              className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium transition-colors ${
                matchFilter === 'played'
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:bg-surface-hover'
              }`}
            >
              Odehrané
            </button>
            <button
              onClick={() => setMatchFilter('future')}
              className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium transition-colors ${
                matchFilter === 'future'
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:bg-surface-hover'
              }`}
            >
              Budoucí
            </button>
          </div>
        </div>

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
        ) : filteredMatches.length === 0 && !error ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-surface-elevated rounded-full mb-4">
              <Trophy className="w-10 h-10 text-text-muted" />
            </div>
            <h2 className="text-2xl font-semibold text-text-primary mb-2">
              {matchFilter === 'future'
                ? 'Žádné budoucí zápasy'
                : selectedCategory
                  ? 'Žádné výsledky v této kategorii'
                  : 'Zatím žádné výsledky'}
            </h2>
            <p className="text-text-secondary mb-6">
              {matchFilter === 'played'
                ? 'Začněte zadáním prvního výsledku zápasu'
                : 'Zatím nejsou naplánované žádné zápasy'}
            </p>
            {matchFilter === 'played' && (
              <Link href="/zadat-vysledek">
                <Button variant="primary" size="lg">
                  <Plus className="w-5 h-5 mr-2" />
                  Přidat první výsledek
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredMatches.map((match) => (
              <MatchResultCard
                key={match.id}
                match={match}
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
