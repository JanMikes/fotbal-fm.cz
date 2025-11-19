'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, UpdateProfileFormData } from '@/lib/validation';
import { useUser } from '@/contexts/UserContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';

export default function ProfileForm() {
  const { user, refreshUser } = useUser();
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState(false);

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

  const onSubmit = async (data: UpdateProfileFormData) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess('Profil byl úspěšně aktualizován');
        await refreshUser();
      } else {
        setError(result.error || 'Chyba při aktualizaci profilu');
      }
    } catch (err) {
      setError('Nastala neočekávaná chyba');
      console.error('Update profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
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

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Ukládám...' : 'Uložit změny'}
      </Button>
    </form>
  );
}
