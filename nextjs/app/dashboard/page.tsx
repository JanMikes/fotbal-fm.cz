'use client';

import Link from 'next/link';
import { useUser } from '@/contexts/UserContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function DashboardPage() {
  const { user, loading } = useUser();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return null; // Middleware will redirect
  }

  return (
    <div className="bg-background py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">Dashboard</h1>
          <p className="text-text-secondary">
            Vítejte zpět, {user.firstName}!
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card variant="elevated" className="md:col-span-2">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center text-white text-2xl font-bold">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-text-primary mb-4">
                  Vítejte zpět!
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-text-secondary">{user.firstName} {user.lastName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-text-secondary">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-text-secondary">{user.jobTitle}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card variant="elevated">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Rychlé akce</h2>
            <div className="space-y-3">
              <Link href="/zadat-vysledek" className="block">
                <Button className="w-full" variant="primary">
                  Zadat výsledek zápasu
                </Button>
              </Link>
              <Link href="/moje-vysledky" className="block">
                <Button className="w-full" variant="secondary">
                  Moje výsledky
                </Button>
              </Link>
              <Link href="/nastaveni" className="block">
                <Button className="w-full" variant="secondary">
                  Upravit profil
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
