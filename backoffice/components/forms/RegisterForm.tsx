'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, RegisterFormData } from '@/lib/validation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import { useUser } from '@/contexts/UserContext';
import { useScrollToError } from '@/hooks/useScrollToError';
import { useMutation } from '@/hooks/api';
import { User } from '@/types/user';

interface RegisterFormProps {
  secret: string;
}

interface RegisterResponse {
  user: User;
}

export default function RegisterForm({ secret }: RegisterFormProps) {
  const router = useRouter();
  const { refreshUser } = useUser();

  const { mutate, isLoading, error } = useMutation<RegisterResponse, RegisterFormData & { secret: string }>({
    endpoint: '/api/auth/register',
    method: 'POST',
    transformVariables: (data) => JSON.stringify(data),
    onSuccess: async () => {
      // Refresh user context to update navbar and auth state
      await refreshUser();
      router.push('/dashboard');
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  // Automatically scroll to the first error field
  useScrollToError(errors, { offset: 100 });

  const onSubmit = async (data: RegisterFormData) => {
    await mutate({ ...data, secret });
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

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Registruji...' : 'Zaregistrovat se'}
      </Button>
    </form>
  );
}
