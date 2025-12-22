'use client';

import Card from '@/components/ui/Card';
import MatchResultForm from '@/components/forms/MatchResultForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function AddMatchResultPage() {
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
            Zadat výsledek zápasu
          </h1>
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
            <p className="text-amber-800 text-sm">
              Tato sekce slouží výhradně pro zadání jednoho konkrétního zápasu.
              Vyplňuj pouze tehdy, pokud tým odehrál samostatné utkání (ligové, přípravné nebo přátelské).
            </p>
            <p className="text-amber-900 text-sm font-semibold mt-2 flex items-start gap-2">
              <span className="text-amber-500">⚠️</span>
              <span>
                <strong>Důležité:</strong> Pokud tým odehrál více zápasů v jednom dni (např. turnaj, miniliga apod.),
                zadávej výhradně přes sekci turnaje, kde se výsledky jednotlivých zápasů zapisují souhrnně ke konkrétnímu dni/turnaji.
              </span>
            </p>
          </div>
        </div>

        <Card>
          <MatchResultForm />
        </Card>
      </div>
    </div>
  );
}
