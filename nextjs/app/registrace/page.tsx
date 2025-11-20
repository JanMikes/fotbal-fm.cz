'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Lock } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import RegisterForm from '@/components/forms/RegisterForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRequireAuth } from '@/hooks/useRequireAuth';

function RegisterPageContent() {
  const { user, loading } = useRequireAuth({
    redirectIfAuthenticated: true,
    authenticatedRedirectTo: '/dashboard',
  });
  const searchParams = useSearchParams();
  const [secret, setSecret] = useState<string | null>(null);
  const [secretValid, setSecretValid] = useState<boolean | null>(null);
  const [validating, setValidating] = useState(true);
  const [secretInput, setSecretInput] = useState('');

  useEffect(() => {
    const validateSecret = async () => {
      const secretParam = searchParams.get('secret');
      setSecret(secretParam);

      if (!secretParam) {
        setSecretValid(false);
        setValidating(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/validate-secret', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ secret: secretParam }),
        });

        const result = await response.json();
        setSecretValid(result.valid);
      } catch (error) {
        setSecretValid(false);
      } finally {
        setValidating(false);
      }
    };

    validateSecret();
  }, [searchParams]);

  if (loading || validating) {
    return <LoadingSpinner />;
  }

  if (user) {
    return null; // Will redirect
  }

  // If secret is invalid or not provided, show access denied
  if (!secretValid) {
    const handleSecretSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (secretInput.trim()) {
        router.push(`/registrace?secret=${encodeURIComponent(secretInput.trim())}`);
      }
    };

    return (
      <div className="flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md">
          <Card variant="elevated">
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <Lock className="w-16 h-16 text-text-secondary" />
              </div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">Přístup odepřen</h1>
              <p className="text-text-secondary mb-6">
                {!secret
                  ? 'Pro registraci je vyžadován registrační kód.'
                  : 'Neplatný registrační kód.'}
              </p>

              <form onSubmit={handleSecretSubmit} className="space-y-4 mb-6">
                <Input
                  type="text"
                  placeholder="Zadejte registrační kód"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  autoFocus
                />
                <Button type="submit" variant="primary" className="w-full">
                  Pokračovat
                </Button>
              </form>

              <div className="text-sm text-text-secondary">
                Už máte účet?{' '}
                <Link
                  href="/prihlaseni"
                  className="text-primary hover:text-primary-hover font-medium transition-colors"
                >
                  Přihlaste se
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
            <h1 className="text-3xl font-bold text-text-primary mb-2">Registrace</h1>
            <p className="text-text-secondary">Vytvořte si nový účet</p>
          </div>
          <RegisterForm secret={secret!} />
          <div className="mt-8 text-center text-sm text-text-secondary">
            Už máte účet?{' '}
            <Link
              href="/prihlaseni"
              className="text-primary hover:text-primary-hover font-medium transition-colors"
            >
              Přihlaste se
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center bg-background pt-32">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-border border-t-primary mb-4"></div>
          <p className="text-text-secondary">Načítání...</p>
        </div>
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}
