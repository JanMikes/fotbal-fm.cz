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
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
            <p className="text-amber-800 text-sm">
              Tato sekce slouží k zadávání turnajů a akcí, při kterých tým odehraje více utkání v jeden den
              (nebo v rámci jedné akce) proti různým soupeřům.
            </p>
            <p className="text-amber-700 text-sm mt-2">
              Do této sekce nejprve založ turnaj jako celek a následně pod něj zadávej jednotlivé zápasy a jejich výsledky.
              Sekce Turnaje se používá vždy tehdy, kdy nejde o jedno samostatné soutěžní utkání.
            </p>
            <p className="text-amber-900 text-sm font-semibold mt-2 flex items-start gap-2">
              <span className="text-amber-500">⚠️</span>
              <span>Naopak jednotlivý soutěžní zápas patří do sekce Výsledky.</span>
            </p>
          </div>
        </div>

        <Card>
          <TournamentForm />
        </Card>
      </div>
    </div>
  );
}
