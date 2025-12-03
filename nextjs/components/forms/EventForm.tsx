'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { eventSchema, EventFormData } from '@/lib/validation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import ImageUpload from '@/components/ui/ImageUpload';
import FileUpload from '@/components/ui/FileUpload';
import DatePicker from '@/components/ui/DatePicker';
import TimePicker from '@/components/ui/TimePicker';
import MarkdownEditor from '@/components/ui/MarkdownEditor';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useScrollToError } from '@/hooks/useScrollToError';
import { Event } from '@/types/event';

interface EventFormProps {
  mode?: 'create' | 'edit';
  initialData?: Event;
  recordId?: number;
}

export default function EventForm({
  mode = 'create',
  initialData,
  recordId,
}: EventFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<FileList | null>(null);
  const [files, setFiles] = useState<FileList | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    mode: 'onSubmit',
    defaultValues: initialData
      ? {
          name: initialData.name,
          eventType: initialData.eventType,
          dateFrom: initialData.dateFrom,
          dateTo: initialData.dateTo || '',
          publishDate: initialData.publishDate || '',
          eventTime: initialData.eventTime || '',
          description: initialData.description || '',
          requiresPhotographer: initialData.requiresPhotographer || false,
        }
      : {
          requiresPhotographer: false,
        },
  });

  const description = watch('description');

  useScrollToError(errors, { offset: 100 });

  const onSubmit = async (data: EventFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'edit' && recordId) {
        // Update existing record
        const response = await fetch(`/api/events/${recordId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Nepodařilo se aktualizovat událost');
        }

        router.push(`/udalost/${recordId}?success=true`);
      } else {
        // Create new record
        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('eventType', data.eventType);
        formData.append('dateFrom', data.dateFrom);

        if (data.dateTo) {
          formData.append('dateTo', data.dateTo);
        }
        if (data.publishDate) {
          formData.append('publishDate', data.publishDate);
        }
        if (data.eventTime) {
          formData.append('eventTime', data.eventTime);
        }
        if (data.description) {
          formData.append('description', data.description);
        }
        formData.append('requiresPhotographer', String(data.requiresPhotographer || false));

        if (photos) {
          Array.from(photos).forEach((photo) => {
            formData.append('photos', photo);
          });
        }

        if (files) {
          Array.from(files).forEach((file) => {
            formData.append('files', file);
          });
        }

        const response = await fetch('/api/events/create', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Nepodařilo se vytvořit událost');
        }

        router.push('/udalosti?success=true');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(mode === 'edit' ? 'Nepodařilo se aktualizovat událost' : 'Nepodařilo se vytvořit událost');
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
            message={mode === 'edit' ? 'Ukládání změn...' : 'Vytvářím událost...'}
            size="lg"
          />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && <Alert variant="error">{error}</Alert>}

        <FormField
          label="Název události"
          error={errors.name?.message}
          required
        >
          <Input
            {...register('name')}
            placeholder="Název události"
            error={errors.name?.message}
          />
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Typ události"
            error={errors.eventType?.message}
            required
          >
            <select
              {...register('eventType')}
              className={`w-full px-4 py-2.5 bg-surface border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 ${
                errors.eventType ? 'border-danger' : 'border-border hover:border-border-light'
              }`}
            >
              <option value="">Vyberte typ</option>
              <option value="nadcházející">Nadcházející</option>
              <option value="proběhlá">Proběhlá</option>
            </select>
          </FormField>

          <FormField
            label="Čas události"
            error={errors.eventTime?.message}
          >
            <TimePicker
              {...register('eventTime')}
              error={errors.eventTime?.message}
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
            hint="Volitelné - pro vícedenní události"
          >
            <DatePicker
              {...register('dateTo')}
              error={errors.dateTo?.message}
            />
          </FormField>
        </div>

        <FormField
          label="Datum zveřejnění"
          error={errors.publishDate?.message}
          hint="Referenční datum pro administraci"
        >
          <DatePicker
            {...register('publishDate')}
            error={errors.publishDate?.message}
          />
        </FormField>

        <FormField
          label="Popis události"
          error={errors.description?.message}
          hint="Můžete použít formátování"
        >
          <MarkdownEditor
            value={description || ''}
            onChange={(e) => setValue('description', e.target.value)}
            placeholder="Popis události..."
            rows={6}
            error={errors.description?.message}
          />
        </FormField>

        <FormField label="Požaduji fotografa">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('requiresPhotographer')}
              className="w-5 h-5 rounded border-border bg-surface text-primary focus:ring-primary focus:ring-offset-0"
            />
            <span className="text-text-primary">Ano, potřebuji fotografa na akci</span>
          </label>
        </FormField>

        <FormField
          label="Fotografie"
          hint="Můžete nahrát fotografie z události"
        >
          <ImageUpload onChange={setPhotos} />
        </FormField>

        <FormField
          label="Další soubory"
          hint="PDF, Word dokumenty a další přílohy"
        >
          <FileUpload onChange={setFiles} />
        </FormField>

        <div className="flex gap-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Ukládání...' : mode === 'edit' ? 'Uložit změny' : 'Vytvořit událost'}
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
