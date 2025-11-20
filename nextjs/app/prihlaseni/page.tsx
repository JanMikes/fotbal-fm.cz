'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';
import LoginForm from '@/components/forms/LoginForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function LoginPage() {
  const { user, loading } = useRequireAuth({
    redirectIfAuthenticated: true,
    authenticatedRedirectTo: '/dashboard',
  });

  if (loading) {
    return <LoadingSpinner />;
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
