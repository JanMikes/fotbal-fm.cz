'use client';

import Card from '@/components/ui/Card';
import TournamentMatchForm from '@/components/forms/TournamentMatchForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function NewTournamentMatchPage() {
  const { user, loading } = useRequireAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return null; // Middleware will redirect
  }

  return (
    <div className="bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Nový turnajový zápas
          </h1>
          <p className="text-text-secondary">
            Vyplňte formulář pro přidání zápasu k turnaji
          </p>
        </div>

        <Card>
          <TournamentMatchForm />
        </Card>
      </div>
    </div>
  );
}
