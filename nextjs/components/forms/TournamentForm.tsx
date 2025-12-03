'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tournamentSchema, TournamentFormData } from '@/lib/validation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import ImageUpload from '@/components/ui/ImageUpload';
import DatePicker from '@/components/ui/DatePicker';
import MarkdownEditor from '@/components/ui/MarkdownEditor';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useScrollToError } from '@/hooks/useScrollToError';
import { Tournament } from '@/types/tournament';

interface TournamentFormProps {
  mode?: 'create' | 'edit';
  initialData?: Tournament;
  recordId?: string;
}

export default function TournamentForm({
  mode = 'create',
  initialData,
  recordId,
}: TournamentFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<FileList | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<TournamentFormData>({
    resolver: zodResolver(tournamentSchema),
    mode: 'onSubmit',
    defaultValues: initialData
      ? {
          name: initialData.name,
          description: initialData.description || '',
          location: initialData.location || '',
          dateFrom: initialData.dateFrom,
          dateTo: initialData.dateTo || '',
          category: initialData.category,
          imagesUrl: initialData.imagesUrl || '',
        }
      : undefined,
  });

  const description = watch('description');

  useScrollToError(errors, { offset: 100 });

  const onSubmit = async (data: TournamentFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'edit' && recordId) {
        // Update existing record
        const response = await fetch(`/api/tournaments/${recordId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Nepodařilo se aktualizovat turnaj');
        }

        router.push(`/turnaj/${recordId}?success=true`);
      } else {
        // Create new record
        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('dateFrom', data.dateFrom);
        formData.append('category', data.category);

        if (data.description) {
          formData.append('description', data.description);
        }
        if (data.location) {
          formData.append('location', data.location);
        }
        if (data.dateTo) {
          formData.append('dateTo', data.dateTo);
        }
        if (data.imagesUrl) {
          formData.append('imagesUrl', data.imagesUrl);
        }

        if (photos) {
          Array.from(photos).forEach((photo) => {
            formData.append('photos', photo);
          });
        }

        const response = await fetch('/api/tournaments/create', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Nepodařilo se vytvořit turnaj');
        }

        router.push('/turnaje?success=true');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(mode === 'edit' ? 'Nepodařilo se aktualizovat turnaj' : 'Nepodařilo se vytvořit turnaj');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <LoadingSpinner
            fullscreen={false}
            message={mode === 'edit' ? 'Ukládání změn...' : 'Vytvářím turnaj...'}
            size="lg"
          />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && <Alert variant="error">{error}</Alert>}

        <FormField
          label="Název turnaje"
          error={errors.name?.message}
          required
        >
          <Input
            {...register('name')}
            placeholder="Název turnaje"
            error={errors.name?.message}
          />
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Kategorie"
            error={errors.category?.message}
            required
          >
            <select
              {...register('category')}
              className={`w-full px-4 py-2.5 bg-surface border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 ${
                errors.category ? 'border-danger' : 'border-border hover:border-border-light'
              }`}
            >
              <option value="">Vyberte kategorii</option>
              <option value="Žáci">Žáci</option>
              <option value="Dorost">Dorost</option>
            </select>
          </FormField>

          <FormField
            label="Místo konání"
            error={errors.location?.message}
          >
            <Input
              {...register('location')}
              placeholder="Město, stadion..."
              error={errors.location?.message}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Datum od"
            error={errors.dateFrom?.message}
            required
          >
            <DatePicker
              {...register('dateFrom')}
              error={errors.dateFrom?.message}
            />
          </FormField>

          <FormField
            label="Datum do"
            error={errors.dateTo?.message}
            hint="Volitelné - pro vícedenní turnaje"
          >
            <DatePicker
              {...register('dateTo')}
              error={errors.dateTo?.message}
            />
          </FormField>
        </div>

        <FormField
          label="Popis / Report"
          error={errors.description?.message}
          hint="Popis turnaje nebo report po skončení"
        >
          <MarkdownEditor
            value={description || ''}
            onChange={(e) => setValue('description', e.target.value)}
            placeholder="Popis turnaje..."
            rows={6}
            error={errors.description?.message}
          />
        </FormField>

        <FormField
          label="Fotografie"
          hint="Můžete nahrát fotografie z turnaje"
        >
          <ImageUpload onChange={setPhotos} />
        </FormField>

        <FormField
          label="URL k externím fotografiím"
          error={errors.imagesUrl?.message}
          hint="Volitelné - odkaz na fotogalerii z externího zdroje"
        >
          <Input
            {...register('imagesUrl')}
            type="url"
            placeholder="https://..."
            error={errors.imagesUrl?.message}
          />
        </FormField>

        <div className="flex gap-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Ukládání...' : mode === 'edit' ? 'Uložit změny' : 'Vytvořit turnaj'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => router.back()}
            disabled={isLoading}
          >
            Zrušit
          </Button>
        </div>
      </form>
    </>
  );
}
