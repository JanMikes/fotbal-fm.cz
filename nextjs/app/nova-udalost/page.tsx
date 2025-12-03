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
            Nová událost
          </h1>
          <p className="text-text-secondary">
            Vyplňte formulář pro vytvoření nové události
          </p>
        </div>

        <Card>
          <EventForm />
        </Card>
      </div>
    </div>
  );
}
