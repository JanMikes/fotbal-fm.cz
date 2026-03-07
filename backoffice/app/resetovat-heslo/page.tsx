'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import ResetPasswordForm from '@/components/forms/ResetPasswordForm';
import Alert from '@/components/ui/Alert';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');

  if (!code) {
    return (
      <div className="flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md">
          <Card variant="elevated">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-text-primary mb-4">Neplatný odkaz</h1>
              <Alert variant="error">
                Odkaz pro obnovení hesla je neplatný nebo vypršel. Zkuste požádat o nový.
              </Alert>
              <div className="mt-6">
                <Link
                  href="/zapomenute-heslo"
                  className="text-primary hover:text-primary-hover font-medium transition-colors"
                >
                  Požádat o nový odkaz
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <Card variant="elevated">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-text-primary mb-2">Nové heslo</h1>
            <p className="text-text-secondary">Zadejte své nové heslo.</p>
          </div>
          <ResetPasswordForm code={code} />
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center bg-background pt-32">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-border border-t-primary mb-4"></div>
          <p className="text-text-secondary">Načítání...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
