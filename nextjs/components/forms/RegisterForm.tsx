'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormData } from '@/lib/validation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import { useUser } from '@/contexts/UserContext';

interface RegisterFormProps {
  secret: string;
}

export default function RegisterForm({ secret }: RegisterFormProps) {
  const router = useRouter();
  const { refreshUser } = useUser();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, secret }),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh user context to update navbar and auth state
        await refreshUser();
        router.push('/dashboard');
      } else {
        setError(result.error || 'Chyba při registraci');
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

      <FormField label="Jméno" error={errors.firstName?.message} required>
        <Input
          type="text"
          placeholder="Jméno"
          error={errors.firstName?.message}
          {...register('firstName')}
        />
      </FormField>

      <FormField label="Příjmení" error={errors.lastName?.message} required>
        <Input
          type="text"
          placeholder="Příjmení"
          error={errors.lastName?.message}
          {...register('lastName')}
        />
      </FormField>

      <FormField label="Funkce" error={errors.jobTitle?.message} required>
        <Input
          type="text"
          placeholder="Vaše pracovní pozice"
          error={errors.jobTitle?.message}
          {...register('jobTitle')}
        />
      </FormField>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Registruji...' : 'Zaregistrovat se'}
      </Button>
    </form>
  );
}
