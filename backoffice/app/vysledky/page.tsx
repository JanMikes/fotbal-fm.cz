'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Match } from '@/types/match';
import { PaginationMeta } from '@/types/api';
import MatchResultCard from '@/components/MatchResultCard';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { Plus, Trophy } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Alert from '@/components/ui/Alert';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import CategoryFilter from '@/components/ui/CategoryFilter';
import SearchInput from '@/components/ui/SearchInput';
import Pagination from '@/components/ui/Pagination';

const PAGE_SIZE = 10;

function MatchResultsPageContent() {
  const { user, loading: userLoading } = useRequireAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [matches, setMatches] = useState<Match[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showSuccess = searchParams.get('success') === 'true';
  const showNetworkWarning = searchParams.get('warning') === 'network';

  const selectedCategory = searchParams.get('category') ?? '';
  const search = searchParams.get('search') ?? '';
  const matchFilter = searchParams.get('filter') === 'future' ? 'future' : 'played';
  const parsedPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchMatches = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          filter: matchFilter,
        });
        if (selectedCategory) {
          params.set('category', selectedCategory);
        }
        if (search) {
          params.set('search', search);
        }

        const response = await fetch(`/api/matches/list?${params.toString()}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Nepodařilo se načíst výsledky');
        }
        if (cancelled) return;

        setMatches(data.data.matches);
        setPagination(data.data.pagination ?? null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Nepodařilo se načíst výsledky');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMatches();
    return () => {
      cancelled = true;
    };
  }, [user, selectedCategory, search, matchFilter, page]);

  // If filters narrowed the results below the current page, jump back to page 1
  useEffect(() => {
    if (pagination && pagination.pageCount > 0 && page > pagination.pageCount) {
      updateParams({ page: null });
    }
  }, [pagination, page, updateParams]);

  const handleCategoryChange = (categoryId: string) => {
    updateParams({ category: categoryId || null, page: null });
  };

  const handleSearchChange = (value: string) => {
    updateParams({ search: value || null, page: null });
  };

  const handleFilterChange = (filter: 'played' | 'future') => {
    updateParams({ filter: filter === 'played' ? null : filter, page: null });
  };

  const handlePageChange = (nextPage: number) => {
    updateParams({ page: nextPage > 1 ? String(nextPage) : null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CategoryFilter
              value={selectedCategory}
              onChange={handleCategoryChange}
            />
            <div className="flex w-full sm:w-auto rounded-lg border border-border overflow-hidden shrink-0">
              <button
                onClick={() => handleFilterChange('played')}
                className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium transition-colors ${
                  matchFilter === 'played'
                    ? 'bg-primary text-white'
                    : 'bg-surface text-text-secondary hover:bg-surface-hover'
                }`}
              >
                Odehrané
              </button>
              <button
                onClick={() => handleFilterChange('future')}
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
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Hledat podle týmu, soutěže nebo místa…"
            className="max-w-md"
          />
        </div>

        {showSuccess && (
          <div className="mb-6">
            <Alert variant="success">Výsledek zápasu byl úspěšně uložen!</Alert>
          </div>
        )}

        {showNetworkWarning && (
          <div className="mb-6">
            <Alert variant="warning">
              Při ukládání došlo k problému s připojením. Zápas byl pravděpodobně uložen — zkontrolujte seznam níže před opětovným zadáním.
            </Alert>
          </div>
        )}

        {error && (
          <div className="mb-6">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : matches.length === 0 && !error ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-surface-elevated rounded-full mb-4">
              <Trophy className="w-10 h-10 text-text-muted" />
            </div>
            <h2 className="text-2xl font-semibold text-text-primary mb-2">
              {search
                ? 'Žádné zápasy neodpovídají hledání'
                : matchFilter === 'future'
                  ? 'Žádné budoucí zápasy'
                  : selectedCategory
                    ? 'Žádné výsledky v této kategorii'
                    : 'Zatím žádné výsledky'}
            </h2>
            <p className="text-text-secondary mb-6">
              {search
                ? 'Zkuste upravit hledaný výraz nebo filtry'
                : matchFilter === 'played'
                  ? 'Začněte zadáním prvního výsledku zápasu'
                  : 'Zatím nejsou naplánované žádné zápasy'}
            </p>
            {matchFilter === 'played' && !search && (
              <Link href="/zadat-vysledek">
                <Button variant="primary" size="lg">
                  <Plus className="w-5 h-5 mr-2" />
                  Přidat první výsledek
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {matches.map((match) => (
                <MatchResultCard
                  key={match.id}
                  match={match}
                />
              ))}
            </div>
            {pagination && (
              <Pagination
                page={pagination.page}
                pageCount={pagination.pageCount}
                total={pagination.total}
                onPageChange={handlePageChange}
              />
            )}
          </>
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
