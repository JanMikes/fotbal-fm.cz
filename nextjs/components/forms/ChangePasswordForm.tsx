'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, ChangePasswordFormData } from '@/lib/validation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';

export default function ChangePasswordForm() {
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Heslo bylo úspěšně změněno');
        reset();
      } else {
        setError(result.error || 'Chyba při změně hesla');
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

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Měním heslo...' : 'Změnit heslo'}
      </Button>
    </form>
  );
}
