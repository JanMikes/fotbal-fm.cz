'use client';

import Card from '@/components/ui/Card';
import EventForm from '@/components/forms/EventForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function NewEventPage() {
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
            Vytvořit novou událost
          </h1>
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
            <p className="text-amber-800 text-sm">
              Tato sekce slouží k zadávání všech klubových událostí a aktivit, které nepatří do sekcí Výsledky ani Turnaje.
              Vyplňuj ji vždy, když se jedná o cokoliv jiného než soutěžní zápas nebo turnaj.
            </p>
            <p className="text-amber-700 text-sm mt-2">
              Patří sem zejména přátelská utkání, mimořádné a přípravné zápasy, přestupy a změny v kádru,
              zajímavosti a novinky z klubu, charitativní a komunitní akce, reprezentační a výběrové akce hráčů
              a další aktivity spojené s klubem, které chceme komunikovat navenek.
            </p>
            <p className="text-amber-900 text-sm font-semibold mt-2 flex items-start gap-2">
              <span className="text-amber-500">⚠️</span>
              <span>Soutěžní zápasy a turnaje vždy zadávej do příslušných sekcí.</span>
            </p>
          </div>
        </div>

        <Card>
          <EventForm />
        </Card>
      </div>
    </div>
  );
}
