'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, UpdateProfileFormData } from '@/lib/validation';
import { useUser } from '@/contexts/UserContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import { useScrollToError } from '@/hooks/useScrollToError';
import { useUpdateProfile } from '@/hooks/api';

export default function ProfileForm() {
  const { user, refreshUser } = useUser();
  const [success, setSuccess] = useState<string>('');

  const { mutate, isLoading, error } = useUpdateProfile({
    onSuccess: async () => {
      setSuccess('Profil byl úspěšně aktualizován');
      await refreshUser();
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      jobTitle: user?.jobTitle || '',
    },
  });

  // Automatically scroll to the first error field
  useScrollToError(errors, { offset: 100 });

  const onSubmit = async (data: UpdateProfileFormData) => {
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
        {isLoading ? 'Ukládám...' : 'Uložit změny'}
      </Button>
    </form>
  );
}
