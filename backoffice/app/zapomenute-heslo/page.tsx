'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';
import ForgotPasswordForm from '@/components/forms/ForgotPasswordForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRequireAuth } from '@/hooks/useRequireAuth';

export default function ForgotPasswordPage() {
  const { user, loading } = useRequireAuth({
    redirectIfAuthenticated: true,
    authenticatedRedirectTo: '/dashboard',
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (user) {
    return null;
  }

  return (
    <div className="flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <Card variant="elevated">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-text-primary mb-2">Zapomenuté heslo</h1>
            <p className="text-text-secondary">
              Zadejte svůj email a my vám pošleme odkaz pro obnovení hesla.
            </p>
          </div>
          <ForgotPasswordForm />
          <div className="mt-8 text-center text-sm text-text-secondary">
            <Link
              href="/prihlaseni"
              className="text-primary hover:text-primary-hover font-medium transition-colors"
            >
              Zpět na přihlášení
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
