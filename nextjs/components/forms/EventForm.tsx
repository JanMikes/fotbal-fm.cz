'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { eventSchema, EventFormData } from '@/lib/validation';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
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
  recordId?: string;
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
    control,
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
          eventTimeTo: initialData.eventTimeTo || '',
          description: initialData.description || '',
          requiresPhotographer: initialData.requiresPhotographer || false,
        }
      : {
          requiresPhotographer: false,
        },
  });

  const description = watch('description');

  useScrollToError(errors, { offset: 100 });

  const onValidationError = async (errors: Record<string, any>) => {
    // Log validation errors to server for debugging
    try {
      await fetch('/api/debug-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form: 'EventForm',
          errors,
          formValues: watch(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        }),
      });
    } catch (e) {
      // Ignore logging errors
    }
  };

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
        if (data.eventTimeTo) {
          formData.append('eventTimeTo', data.eventTimeTo);
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

      <form onSubmit={handleSubmit(onSubmit, onValidationError)} className="space-y-6">
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

        <FormField
          label="Typ události"
          error={errors.eventType?.message}
          required
        >
          <Select
            {...register('eventType')}
            error={errors.eventType?.message}
          >
            <option value="">Vyberte typ</option>
            <option value="nadcházející">Nadcházející</option>
            <option value="proběhlá">Proběhlá</option>
          </Select>
        </FormField>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Datum od"
            error={errors.dateFrom?.message}
            required
          >
            <Controller
              name="dateFrom"
              control={control}
              render={({ field }) => (
                <DatePicker
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  name={field.name}
                  error={errors.dateFrom?.message}
                />
              )}
            />
          </FormField>

          <FormField
            label="Čas od"
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
            label="Datum do"
            error={errors.dateTo?.message}
            hint="Volitelné - pro vícedenní události"
          >
            <Controller
              name="dateTo"
              control={control}
              render={({ field }) => (
                <DatePicker
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  name={field.name}
                  error={errors.dateTo?.message}
                />
              )}
            />
          </FormField>

          <FormField
            label="Čas do"
            error={errors.eventTimeTo?.message}
          >
            <TimePicker
              {...register('eventTimeTo')}
              error={errors.eventTimeTo?.message}
            />
          </FormField>
        </div>

        <FormField
          label="Kdy nejpozději je nutné zveřejnit"
          error={errors.publishDate?.message}
          hint="Referenční datum pro administrátora"
        >
          <Controller
            name="publishDate"
            control={control}
            render={({ field }) => (
              <DatePicker
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                name={field.name}
                error={errors.publishDate?.message}
              />
            )}
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
            error={errors.description?.message}
          />
        </FormField>

        <FormField label="Požaduji na akci fotografa">
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="true"
                {...register('requiresPhotographer')}
                checked={watch('requiresPhotographer') === true}
                onChange={() => setValue('requiresPhotographer', true)}
                className="w-5 h-5 border-border bg-white text-primary focus:ring-ring-focus focus:ring-offset-0 accent-primary"
              />
              <span className="text-text-primary">Ano</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="false"
                {...register('requiresPhotographer')}
                checked={watch('requiresPhotographer') === false}
                onChange={() => setValue('requiresPhotographer', false)}
                className="w-5 h-5 border-border bg-white text-primary focus:ring-ring-focus focus:ring-offset-0 accent-primary"
              />
              <span className="text-text-primary">Ne</span>
            </label>
          </div>
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

        <div className="space-y-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading}
            className="w-full"
            onClick={() => {
              // Debug: log button click to server
              fetch('/api/debug-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  form: 'EventForm',
                  event: 'submit_button_clicked',
                  formValues: watch(),
                  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
                }),
              }).catch(() => {});
            }}
          >
            {isLoading ? 'Ukládání...' : mode === 'edit' ? 'Uložit změny' : 'Uložit událost'}
          </Button>

          <button
            type="button"
            onClick={() => router.back()}
            disabled={isLoading}
            className="w-full text-center text-sm text-muted underline hover:text-foreground disabled:opacity-50"
          >
            Zrušit
          </button>
        </div>
      </form>
    </>
  );
}
