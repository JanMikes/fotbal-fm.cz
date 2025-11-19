'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import Card from '@/components/ui/Card';
import MatchResultForm from '@/components/forms/MatchResultForm';

export default function AddMatchResultPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/prihlaseni');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-text-secondary">Načítání...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Middleware will redirect
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Zadat výsledek zápasu
          </h1>
          <p className="text-text-secondary">
            Vyplňte formulář pro zadání výsledku fotbalového zápasu
          </p>
        </div>

        <Card>
          <MatchResultForm />
        </Card>
      </div>
    </div>
  );
}
