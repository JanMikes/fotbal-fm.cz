'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import Card from '@/components/ui/Card';
import LoginForm from '@/components/forms/LoginForm';

export default function LoginPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-background pt-32">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-border border-t-primary mb-4"></div>
          <p className="text-text-secondary">Načítání...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect
  }

  return (
    <div className="flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <Card variant="elevated">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-text-primary mb-2">Přihlášení</h1>
            <p className="text-text-secondary">Vítejte zpět</p>
          </div>
          <LoginForm />
          <div className="mt-8 text-center text-sm text-text-secondary">
            Nemáte účet?{' '}
            <Link
              href="/registrace"
              className="text-primary hover:text-primary-hover font-medium transition-colors"
            >
              Zaregistrujte se
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
