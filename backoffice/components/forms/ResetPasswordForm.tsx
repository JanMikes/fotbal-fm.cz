'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, ResetPasswordFormData } from '@/lib/validation';
import { useResetPassword } from '@/hooks/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import { useScrollToError } from '@/hooks/useScrollToError';

interface ResetPasswordFormProps {
  code: string;
}

export default function ResetPasswordForm({ code }: ResetPasswordFormProps) {
  const router = useRouter();
  const [success, setSuccess] = useState(false);

  const { mutate, isLoading, error } = useResetPassword({
    onSuccess: () => setSuccess(true),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { code },
  });

  useScrollToError(errors, { offset: 100 });

  const onSubmit = async (data: ResetPasswordFormData) => {
    await mutate(data);
  };

  if (success) {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          Heslo bylo úspěšně změněno. Nyní se můžete přihlásit.
        </Alert>
        <Button
          onClick={() => router.push('/prihlaseni')}
          className="w-full"
        >
          Přejít na přihlášení
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="error">{error}</Alert>
      )}

      <input type="hidden" {...register('code')} />

      <FormField label="Nové heslo" error={errors.password?.message} required>
        <Input
          type="password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
      </FormField>

      <FormField label="Potvrzení hesla" error={errors.passwordConfirmation?.message} required>
        <Input
          type="password"
          placeholder="••••••••"
          error={errors.passwordConfirmation?.message}
          {...register('passwordConfirmation')}
        />
      </FormField>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Ukládám...' : 'Nastavit nové heslo'}
      </Button>
    </form>
  );
}
