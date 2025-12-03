'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { matchResultSchema, MatchResultFormData } from '@/lib/validation';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import ImageUpload from '@/components/ui/ImageUpload';
import FileUpload from '@/components/ui/FileUpload';
import DatePicker from '@/components/ui/DatePicker';
import MarkdownEditor from '@/components/ui/MarkdownEditor';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useScrollToError } from '@/hooks/useScrollToError';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<FileList | null>(null);
  const [files, setFiles] = useState<FileList | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
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
          category: initialData.category,
          matchDate: initialData.matchDate,
          imagesUrl: initialData.imagesUrl || '',
        }
      : undefined,
  });

  // Watch the matchReport value for the controlled markdown editor
  const matchReport = watch('matchReport');

  // Automatically scroll to the first error field
  useScrollToError(errors, { offset: 100 });

  const onSubmit = async (data: MatchResultFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'edit' && recordId) {
        // Update existing record
        const response = await fetch(`/api/match-results/${recordId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Nepodařilo se aktualizovat výsledek zápasu');
        }

        router.push(`/vysledek/${recordId}?success=true`);
      } else {
        // Create new record
        const formData = new FormData();
        formData.append('homeTeam', data.homeTeam);
        formData.append('awayTeam', data.awayTeam);
        formData.append('homeScore', data.homeScore.toString());
        formData.append('awayScore', data.awayScore.toString());
        formData.append('category', data.category);
        formData.append('matchDate', data.matchDate);

        if (data.homeGoalscorers) {
          formData.append('homeGoalscorers', data.homeGoalscorers);
        }
        if (data.awayGoalscorers) {
          formData.append('awayGoalscorers', data.awayGoalscorers);
        }
        if (data.matchReport) {
          formData.append('matchReport', data.matchReport);
        }
        if (data.imagesUrl) {
          formData.append('imagesUrl', data.imagesUrl);
        }

        // Add images
        if (images) {
          Array.from(images).forEach((image) => {
            formData.append('images', image);
          });
        }

        // Add files
        if (files) {
          Array.from(files).forEach((file) => {
            formData.append('files', file);
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

        router.push('/vysledky?success=true');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(mode === 'edit' ? 'Nepodařilo se aktualizovat výsledek zápasu' : 'Nepodařilo se vytvořit výsledek zápasu');
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
            message={mode === 'edit' ? 'Ukládání změn...' : 'Nahrávání výsledku zápasu...'}
            size="lg"
          />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="error">{error}</Alert>
        )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          label="Kategorie"
          error={errors.category?.message}
          required
        >
          <Select
            {...register('category')}
            error={errors.category?.message}
          >
            <option value="">Vyberte kategorii</option>
            <option value="Muži A">Muži A</option>
            <option value="Muži B">Muži B</option>
            <option value="Dorost U16">Dorost U16</option>
            <option value="Dorost U17">Dorost U17</option>
            <option value="Dorost U18">Dorost U18</option>
            <option value="Dorost U19">Dorost U19</option>
            <option value="Žáci U12">Žáci U12</option>
            <option value="Žáci U13">Žáci U13</option>
            <option value="Žáci U14">Žáci U14</option>
            <option value="Žáci U15">Žáci U15</option>
            <option value="Přípravka U8">Přípravka U8</option>
            <option value="Přípravka U9">Přípravka U9</option>
            <option value="Přípravka U10">Přípravka U10</option>
            <option value="Přípravka U11">Přípravka U11</option>
            <option value="Školička">Školička</option>
            <option value="Ženy A">Ženy A</option>
            <option value="Žákyně Mladší">Žákyně Mladší</option>
            <option value="Žákyně Starší">Žákyně Starší</option>
            <option value="Žákyně Přípravka">Žákyně Přípravka</option>
          </Select>
        </FormField>

        <FormField
          label="Datum zápasu"
          error={errors.matchDate?.message}
          required
        >
          <DatePicker
            {...register('matchDate')}
            error={errors.matchDate?.message}
          />
        </FormField>
      </div>

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
        hint="Shrnutí průběhu zápasu. Můžete použít formátování."
      >
        <MarkdownEditor
          value={matchReport || ''}
          onChange={(e) => setValue('matchReport', e.target.value)}
          placeholder="Popis průběhu zápasu..."
          rows={6}
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

      <div className="flex gap-4">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? 'Ukládání...' : mode === 'edit' ? 'Uložit změny' : 'Vytvořit výsledek'}
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
