'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { matchResultSchema, MatchResultFormData } from '@/lib/validation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import ImageUpload from '@/components/ui/ImageUpload';
import FileUpload from '@/components/ui/FileUpload';
import DatePicker from '@/components/ui/DatePicker';
import MarkdownEditor from '@/components/ui/MarkdownEditor';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import CategorySelect from '@/components/ui/CategorySelect';
import { useScrollToError } from '@/hooks/useScrollToError';
import { useCreateMatchResult, useUpdateMatchResult } from '@/hooks/api';
import { MatchResult } from '@/types/match-result';

interface MatchResultFormProps {
  mode?: 'create' | 'edit';
  initialData?: MatchResult;
  recordId?: string;
}

export default function MatchResultForm({
  mode = 'create',
  initialData,
  recordId,
}: MatchResultFormProps) {
  const router = useRouter();
  const [images, setImages] = useState<FileList | null>(null);
  const [files, setFiles] = useState<FileList | null>(null);

  // Use the appropriate mutation hook based on mode
  const createMutation = useCreateMatchResult({
    onSuccess: () => {
      router.push('/vysledky?success=true');
    },
  });

  const updateMutation = useUpdateMatchResult(recordId || '', {
    onSuccess: () => {
      router.push(`/vysledek/${recordId}?success=true`);
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
  } = useForm<MatchResultFormData>({
    resolver: zodResolver(matchResultSchema),
    mode: 'onSubmit',
    defaultValues: initialData
      ? {
          homeTeam: initialData.homeTeam,
          awayTeam: initialData.awayTeam,
          homeScore: initialData.homeScore,
          awayScore: initialData.awayScore,
          homeGoalscorers: initialData.homeGoalscorers || '',
          awayGoalscorers: initialData.awayGoalscorers || '',
          matchReport: initialData.matchReport || '',
          categoryIds: initialData.categories?.map(c => c.id) || [],
          matchDate: initialData.matchDate,
          imagesUrl: initialData.imagesUrl || '',
        }
      : {
          categoryIds: [],
        },
  });

  // Watch the matchReport value for the controlled markdown editor
  const matchReport = watch('matchReport');

  // Automatically scroll to the first error field
  useScrollToError(errors, { offset: 100 });

  const onSubmit = async (data: MatchResultFormData) => {
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
            message={mode === 'edit' ? 'Ukládání změn...' : 'Nahrávání výsledku zápasu...'}
            size="lg"
          />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="error">{error}</Alert>
        )}

        {warnings && warnings.length > 0 && (
          <Alert variant="warning">
            {warnings.map((warning, index) => (
              <div key={index}>{warning}</div>
            ))}
          </Alert>
        )}

      <FormField
        label="Kategorie"
        error={errors.categoryIds?.message}
        required
      >
        <Controller
          name="categoryIds"
          control={control}
          render={({ field }) => (
            <CategorySelect
              value={field.value || []}
              onChange={field.onChange}
              error={errors.categoryIds?.message}
              required
            />
          )}
        />
      </FormField>

      <FormField
        label="Datum zápasu"
        error={errors.matchDate?.message}
        required
      >
        <Controller
          name="matchDate"
          control={control}
          render={({ field }) => (
            <DatePicker
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              name={field.name}
              error={errors.matchDate?.message}
            />
          )}
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          label="Domácí tým"
          error={errors.homeTeam?.message}
          required
        >
          <Input
            {...register('homeTeam')}
            placeholder="Název domácího týmu"
            error={errors.homeTeam?.message}
          />
        </FormField>

        <FormField
          label="Hostující tým"
          error={errors.awayTeam?.message}
          required
        >
          <Input
            {...register('awayTeam')}
            placeholder="Název hostujícího týmu"
            error={errors.awayTeam?.message}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <FormField
          label="Skóre domácích"
          error={errors.homeScore?.message}
          required
        >
          <Input
            {...register('homeScore', { valueAsNumber: true })}
            type="number"
            min="0"
            placeholder="0"
            error={errors.homeScore?.message}
          />
        </FormField>

        <FormField
          label="Skóre hostů"
          error={errors.awayScore?.message}
          required
        >
          <Input
            {...register('awayScore', { valueAsNumber: true })}
            type="number"
            min="0"
            placeholder="0"
            error={errors.awayScore?.message}
          />
        </FormField>
      </div>

      <FormField
        label="Střelci domácích"
        error={errors.homeGoalscorers?.message}
        hint="Např. 15' Jan Novák, 22' Jan Novák"
      >
        <Input
          {...register('homeGoalscorers')}
          placeholder="Jména střelců a minuty"
          error={errors.homeGoalscorers?.message}
        />
      </FormField>

      <FormField
        label="Střelci hostů"
        error={errors.awayGoalscorers?.message}
        hint="Např. 15' Jan Novák, 22' Jan Novák"
      >
        <Input
          {...register('awayGoalscorers')}
          placeholder="Jména střelců a minuty"
          error={errors.awayGoalscorers?.message}
        />
      </FormField>

      <FormField
        label="Zpráva ze zápasu"
        error={errors.matchReport?.message}
        hint="Shrnutí průběhu zápasu. Můžete použít formátování."
      >
        <MarkdownEditor
          value={matchReport || ''}
          onChange={(e) => setValue('matchReport', e.target.value)}
          placeholder="Popis průběhu zápasu..."
          error={errors.matchReport?.message}
        />
      </FormField>

      <FormField
        label="Fotografie"
        hint="Můžete nahrát libovolný počet fotografií ze zápasu"
      >
        <ImageUpload onChange={setImages} />
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

      <FormField
        label="Další soubory"
        hint="Volitelné - PDF, Word dokumenty a další přílohy"
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
          {isLoading ? 'Ukládání...' : mode === 'edit' ? 'Uložit změny' : 'Uložit výsledek'}
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
