'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, ForgotPasswordFormData } from '@/lib/validation';
import { useForgotPassword } from '@/hooks/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';

export default function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);

  const { mutate, isLoading, error } = useForgotPassword({
    onSuccess: () => setSent(true),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    await mutate(data);
  };

  if (sent) {
    return (
      <Alert variant="success">
        Pokud zadaný email existuje v našem systému, odeslali jsme na něj odkaz pro obnovení hesla. Zkontrolujte svou emailovou schránku.
      </Alert>
    );
  }

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

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Odesílám...' : 'Odeslat odkaz pro obnovení hesla'}
      </Button>
    </form>
  );
}
