'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { MatchResult } from '@/types/match-result';
import MatchResultForm from '@/components/forms/MatchResultForm';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { ArrowLeft } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Alert from '@/components/ui/Alert';
import { useRequireAuth } from '@/hooks/useRequireAuth';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditMatchResultPage({ params }: PageProps) {
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

        // Check ownership
        if (data.data.matchResult.authorId !== user.id) {
          setError('Nemáte oprávnění upravit tento záznam');
          return;
        }

        setMatchResult(data.data.matchResult);
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

  return (
    <div className="bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <Button variant="secondary" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Upravit výsledek zápasu
          </h1>
          <p className="text-text-secondary">
            Upravte údaje o výsledku zápasu
          </p>
        </div>

        <Card>
          <MatchResultForm
            mode="edit"
            initialData={matchResult}
            recordId={matchResult.id}
          />
        </Card>
      </div>
    </div>
  );
}
