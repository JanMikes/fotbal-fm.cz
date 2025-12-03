'use client';

import Card from '@/components/ui/Card';
import TournamentForm from '@/components/forms/TournamentForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function NewTournamentPage() {
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
            Nový turnaj
          </h1>
          <p className="text-text-secondary">
            Vyplňte formulář pro vytvoření nového turnaje
          </p>
        </div>

        <Card>
          <TournamentForm />
        </Card>
      </div>
    </div>
  );
}
