'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Tournament } from '@/types/tournament';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import NewsArticleForm from '@/components/forms/NewsArticleForm';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { composeTournamentArticle } from '@/lib/news-article/compose';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TournamentNewsArticlePage({ params }: PageProps) {
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

        setTournament(data.data.tournament);
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

  const composed = composeTournamentArticle(tournament);

  return (
    <div className="bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <Link href={`/turnaj/${tournament.id}`}>
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Zpět na turnaj
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Napsat aktualitu
          </h1>
          <p className="text-text-secondary">
            Aktualita je předvyplněná daty z turnaje {tournament.name} včetně
            všech zapsaných zápasů a ocenění. Po publikaci se objeví na webu v sekci novinek.
          </p>
        </div>

        <Card>
          <NewsArticleForm
            initialTitle={composed.title}
            initialDescription={composed.description}
            initialCategoryIds={tournament.categories?.map((c) => c.id) ?? []}
            sourceImages={tournament.photos ?? []}
            sourceMediaLabel="Převzít fotografie z turnaje"
            backHref={`/turnaj/${tournament.id}`}
            backLabel="Zpět na turnaj"
          />
        </Card>
      </div>
    </div>
  );
}
