'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Tournament } from '@/types/tournament';
import TournamentForm from '@/components/forms/TournamentForm';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { ArrowLeft } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Alert from '@/components/ui/Alert';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import * as Sentry from "@sentry/nextjs";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditTournamentPage({ params }: PageProps) {
  // Defensive check for params - capture to Sentry if undefined
  if (!params) {
    console.error('[EditTournamentPage] CRITICAL: params is undefined');
    Sentry.captureMessage('EditTournamentPage received undefined params', {
      level: 'error',
    });
    throw new Error('Edit tournament page received undefined params');
  }

  // Wrap use() in try-catch to capture any async resolution errors
  let id: string;
  try {
    const resolvedParams = use(params);
    id = resolvedParams.id;
    console.log('[EditTournamentPage] Resolved params:', { id, params: resolvedParams });
  } catch (err) {
    console.error('[EditTournamentPage] CRITICAL: Error resolving params:', err);
    Sentry.captureException(err, {
      tags: { component: 'EditTournamentPage', phase: 'params_resolution' },
      extra: { params: String(params) },
    });
    throw err;
  }

  // Add breadcrumb for page load with resolved ID
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: 'EditTournamentPage loaded',
    level: 'info',
    data: { id },
  });

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

        // Check ownership
        if (data.tournament.authorId !== user.id) {
          setError('Nemáte oprávnění upravit tento záznam');
          return;
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
            Upravit turnaj
          </h1>
          <p className="text-text-secondary">
            Upravte údaje o turnaji
          </p>
        </div>

        <Card>
          <TournamentForm
            mode="edit"
            initialData={tournament}
            recordId={tournament.id}
          />
        </Card>
      </div>
    </div>
  );
}
