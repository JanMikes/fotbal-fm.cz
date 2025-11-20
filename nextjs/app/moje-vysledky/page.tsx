'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { MatchResult } from '@/types/match-result';
import MatchResultCard from '@/components/MatchResultCard';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { Plus, Trophy } from 'lucide-react';

function MyMatchResultsPageContent() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const showSuccess = searchParams.get('success') === 'true';

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/prihlaseni');
    }
  }, [user, userLoading, router]);

  useEffect(() => {
    if (!user) return;

    const fetchMatchResults = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/match-results/my-results');
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Nepodařilo se načíst výsledky');
        }

        setMatchResults(data.matchResults);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Nepodařilo se načíst výsledky');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMatchResults();
  }, [user]);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center bg-background pt-32">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="text-text-secondary">Načítání...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Middleware will redirect
  }

  return (
    <div className="bg-background py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              Moje výsledky zápasů
            </h1>
            <p className="text-text-secondary">
              Přehled všech vámi zadaných výsledků
            </p>
          </div>

          <Link href="/zadat-vysledek">
            <Button variant="primary" size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Přidat výsledek
            </Button>
          </Link>
        </div>

        {showSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            Výsledek zápasu byl úspěšně vytvořen!
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {matchResults.length === 0 && !error && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-surface-elevated rounded-full mb-4">
              <Trophy className="w-10 h-10 text-text-muted" />
            </div>
            <h2 className="text-2xl font-semibold text-text-primary mb-2">
              Zatím žádné výsledky
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
        )}

        {matchResults.length > 0 && (
          <div className="space-y-6">
            {matchResults.map((matchResult) => (
              <MatchResultCard key={matchResult.id} matchResult={matchResult} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyMatchResultsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center bg-background pt-32">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="text-text-secondary">Načítání...</p>
        </div>
      </div>
    }>
      <MyMatchResultsPageContent />
    </Suspense>
  );
}
