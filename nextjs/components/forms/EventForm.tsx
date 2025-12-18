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
import CategorySelect from '@/components/ui/CategorySelect';
import { useScrollToError } from '@/hooks/useScrollToError';
import { useCreateEvent, useUpdateEvent } from '@/hooks/api';
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
  const [images, setImages] = useState<FileList | null>(null);
  const [files, setFiles] = useState<FileList | null>(null);

  // Use the appropriate mutation hook based on mode
  const createMutation = useCreateEvent({
    onSuccess: () => {
      router.push('/udalosti?success=true');
    },
  });

  const updateMutation = useUpdateEvent(recordId || '', {
    onSuccess: () => {
      router.push(`/udalost/${recordId}?success=true`);
    },
  });

  // Select the active mutation based on mode
  const mutation = mode === 'edit' ? updateMutation : createMutation;
  const { isLoading, error, warnings } = mutation;

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
          categoryIds: initialData.categories?.map(c => c.id) || [],
        }
      : {
          requiresPhotographer: false,
          categoryIds: [],
        },
  });

  const description = watch('description');

  useScrollToError(errors, { offset: 100 });

  const onSubmit = async (data: EventFormData) => {
    if (mode === 'edit') {
      await updateMutation.mutate({ data, images, files });
    } else {
      await createMutation.mutate({ data, images, files });
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

        {warnings && warnings.length > 0 && (
          <Alert variant="warning">
            {warnings.map((warning, index) => (
              <div key={index}>{warning}</div>
            ))}
          </Alert>
        )}

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

        <FormField
          label="Kategorie"
          error={errors.categoryIds?.message}
          hint="Volitelné - přiřaďte kategorii pro filtrování"
        >
          <Controller
            name="categoryIds"
            control={control}
            render={({ field }) => (
              <CategorySelect
                value={field.value || []}
                onChange={field.onChange}
                error={errors.categoryIds?.message}
              />
            )}
          />
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
            <Controller
              name="eventTime"
              control={control}
              render={({ field }) => (
                <TimePicker
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  name={field.name}
                  error={errors.eventTime?.message}
                />
              )}
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
            <Controller
              name="eventTimeTo"
              control={control}
              render={({ field }) => (
                <TimePicker
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  name={field.name}
                  error={errors.eventTimeTo?.message}
                />
              )}
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
                name="requiresPhotographer"
                checked={watch('requiresPhotographer') === true}
                onChange={() => setValue('requiresPhotographer', true)}
                className="w-5 h-5 border-border bg-white text-primary focus:ring-ring-focus focus:ring-offset-0 accent-primary"
              />
              <span className="text-text-primary">Ano</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="requiresPhotographer"
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
          <ImageUpload onChange={setImages} />
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
