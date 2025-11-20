'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, LoginFormData } from '@/lib/validation';
import { useUser } from '@/contexts/UserContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import { useScrollToError } from '@/hooks/useScrollToError';

export default function LoginForm() {
  const router = useRouter();
  const { refreshUser } = useUser();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Automatically scroll to the first error field
  useScrollToError(errors, { offset: 100 });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh user context to update the UI immediately
        await refreshUser();
        router.push('/dashboard');
      } else {
        setError(result.error || 'Chyba při přihlašování');
      }
    } catch (err) {
      setError('Nastala neočekávaná chyba');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="error">{error}</Alert>
      )}

      <FormField label="Email" error={errors.email?.message} required>
        <Input
          type="email"
          placeholder="vas@email.cz"
          error={errors.email?.message}
          {...register('email')}
        />
      </FormField>

      <FormField label="Heslo" error={errors.password?.message} required>
        <Input
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
      </FormField>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Přihlašuji...' : 'Přihlásit se'}
      </Button>
    </form>
  );
}
