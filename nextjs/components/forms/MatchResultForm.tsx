'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { matchResultSchema, MatchResultFormData } from '@/lib/validation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import ImageUpload from '@/components/ui/ImageUpload';
import Alert from '@/components/ui/Alert';
import { useScrollToError } from '@/hooks/useScrollToError';

export default function MatchResultForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<FileList | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MatchResultFormData>({
    resolver: zodResolver(matchResultSchema),
    mode: 'onSubmit',
  });

  // Automatically scroll to the first error field
  useScrollToError(errors, { offset: 100 });

  const onSubmit = async (data: MatchResultFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Create FormData for multipart request
      const formData = new FormData();
      formData.append('homeTeam', data.homeTeam);
      formData.append('awayTeam', data.awayTeam);
      formData.append('homeScore', data.homeScore.toString());
      formData.append('awayScore', data.awayScore.toString());

      if (data.homeGoalscorers) {
        formData.append('homeGoalscorers', data.homeGoalscorers);
      }
      if (data.awayGoalscorers) {
        formData.append('awayGoalscorers', data.awayGoalscorers);
      }
      if (data.matchReport) {
        formData.append('matchReport', data.matchReport);
      }

      // Add images
      if (images) {
        Array.from(images).forEach((image) => {
          formData.append('images', image);
        });
      }

      const response = await fetch('/api/match-results/create', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Nepodařilo se vytvořit výsledek zápasu');
      }

      // Redirect to results page with success message
      router.push('/moje-vysledky?success=true');
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Nepodařilo se vytvořit výsledek zápasu');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="error">{error}</Alert>
      )}

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        hint="Shrnutí průběhu zápasu, zajímavé momenty, atd."
      >
        <textarea
          {...register('matchReport')}
          rows={6}
          placeholder="Popis průběhu zápasu..."
          className={`w-full px-4 py-3 border rounded-lg bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 transition-colors resize-vertical ${
            errors.matchReport
              ? 'border-danger focus:ring-danger'
              : 'border-border hover:border-border-light focus:ring-primary'
          }`}
        />
      </FormField>

      <FormField
        label="Fotografie"
        hint="Můžete nahrát libovolný počet fotografií ze zápasu"
      >
        <ImageUpload onChange={setImages} />
      </FormField>

      <div className="flex gap-4">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? 'Ukládání...' : 'Vytvořit výsledek'}
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
  );
}
