'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, ChangePasswordFormData } from '@/lib/validation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import { useScrollToError } from '@/hooks/useScrollToError';
import { useChangePassword } from '@/hooks/api';

export default function ChangePasswordForm() {
  const [success, setSuccess] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const { mutate, isLoading, error } = useChangePassword({
    onSuccess: () => {
      setSuccess('Heslo bylo úspěšně změněno');
      reset();
    },
  });

  // Automatically scroll to the first error field
  useScrollToError(errors, { offset: 100 });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setSuccess('');
    await mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <Alert variant="error">{error}</Alert>
      )}

      {success && (
        <Alert variant="success">{success}</Alert>
      )}

      <FormField label="Současné heslo" error={errors.currentPassword?.message} required>
        <Input
          type="password"
          placeholder="••••••••"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
      </FormField>

      <FormField label="Nové heslo" error={errors.newPassword?.message} required>
        <Input
          type="password"
          placeholder="••••••••"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
      </FormField>

      <FormField label="Potvrzení nového hesla" error={errors.confirmPassword?.message} required>
        <Input
          type="password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
      </FormField>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Měním heslo...' : 'Změnit heslo'}
      </Button>
    </form>
  );
}
