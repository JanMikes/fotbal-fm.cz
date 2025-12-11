'use client';

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
import { useLogin } from '@/hooks/api';

export default function LoginForm() {
  const router = useRouter();
  const { refreshUser } = useUser();

  const { mutate, isLoading, error } = useLogin({
    onSuccess: async () => {
      // Refresh user context to update the UI immediately
      await refreshUser();
      router.push('/dashboard');
    },
  });

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
    await mutate(data);
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

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Přihlašuji...' : 'Přihlásit se'}
      </Button>
    </form>
  );
}
