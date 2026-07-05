'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Match } from '@/types/match';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import NewsArticleForm from '@/components/forms/NewsArticleForm';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { composeMatchArticle } from '@/lib/news-article/compose';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MatchNewsArticlePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: userLoading } = useRequireAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchMatch = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/matches/${id}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Nepodařilo se načíst výsledek');
        }

        setMatch(data.data.match);
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

    fetchMatch();
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

  if (!match) {
    return null;
  }

  const composed = composeMatchArticle(match);

  return (
    <div className="bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <Link href={`/vysledek/${match.id}`}>
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zpět na zápas
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Napsat aktualitu
          </h1>
          <p className="text-text-secondary">
            Aktualita je předvyplněná daty ze zápasu {match.homeTeam} – {match.awayTeam}.
            Po publikaci se objeví na webu v sekci novinek.
          </p>
        </div>

        <Card>
          <NewsArticleForm
            initialTitle={composed.title}
            initialDescription={composed.description}
            initialCategoryIds={match.categories?.map((c) => c.id) ?? []}
            sourceImages={match.images ?? []}
            sourceFileIds={match.files?.map((f) => f.id) ?? []}
            sourceMediaLabel="Převzít fotografie a přílohy ze zápasu"
            backHref={`/vysledek/${match.id}`}
            backLabel="Zpět na zápas"
          />
        </Card>
      </div>
    </div>
  );
}
