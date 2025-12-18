'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
import CategorySelect from '@/components/ui/CategorySelect';
import { useScrollToError } from '@/hooks/useScrollToError';
import { useCreateTournament, useUpdateTournament } from '@/hooks/api';
import { Tournament } from '@/types/tournament';
import { Trash2, Plus } from 'lucide-react';

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
  const [images, setImages] = useState<FileList | null>(null);

  // Use the appropriate mutation hook based on mode
  const createMutation = useCreateTournament({
    onSuccess: (data) => {
      router.push(`/turnaj/${data.tournament.id}?success=true`);
    },
  });

  const updateMutation = useUpdateTournament(recordId || '', {
    onSuccess: () => {
      router.push(`/turnaj/${recordId}?success=true`);
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
          categoryIds: initialData.categories?.map(c => c.id) || [],
          imagesUrl: initialData.imagesUrl || '',
          matches: initialData.matches?.map(m => ({
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            homeGoalscorers: m.homeGoalscorers || '',
            awayGoalscorers: m.awayGoalscorers || '',
          })) || [],
          players: initialData.players || [],
        }
      : {
          categoryIds: [],
          matches: [],
          players: [],
        },
  });

  const { fields: matchFields, append: appendMatch, remove: removeMatch } = useFieldArray({
    control,
    name: 'matches',
  });

  const { fields: playerFields, append: appendPlayer, remove: removePlayer } = useFieldArray({
    control,
    name: 'players',
  });

  const description = watch('description');

  useScrollToError(errors, { offset: 100 });

  const onSubmit = async (data: TournamentFormData) => {
    if (mode === 'edit') {
      await updateMutation.mutate({ data, images, files: null });
    } else {
      await createMutation.mutate({ data, images, files: null });
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

        {warnings && warnings.length > 0 && (
          <Alert variant="warning">
            {warnings.map((warning, index) => (
              <div key={index}>{warning}</div>
            ))}
          </Alert>
        )}

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
          label="Místo konání"
          error={errors.location?.message}
        >
          <Input
            {...register('location')}
            placeholder="Město, stadion..."
            error={errors.location?.message}
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
            label="Datum do"
            error={errors.dateTo?.message}
            hint="Volitelné - pro vícedenní turnaje"
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
            error={errors.description?.message}
          />
        </FormField>

        <FormField
          label="Fotografie"
          hint="Můžete nahrát fotografie z turnaje"
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

        {/* Tournament Matches Section */}
        <div className="border-t pt-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Zápasy turnaje</h3>
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={() => appendMatch({
                homeTeam: '',
                awayTeam: '',
                homeScore: 0,
                awayScore: 0,
                homeGoalscorers: '',
                awayGoalscorers: '',
              })}
            >
              <Plus className="w-4 h-4 mr-1" />
              Přidat zápas
            </Button>
          </div>

          {matchFields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
              Zatím nebyly přidány žádné zápasy. Klikněte na &quot;Přidat zápas&quot; pro přidání.
            </p>
          ) : (
            <div className="space-y-4">
              {matchFields.map((field, index) => (
                <div
                  key={field.id}
                  className="border border-border rounded-lg p-4 bg-card"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      Zápas #{index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => removeMatch(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <FormField
                      label="Domácí tým"
                      error={errors.matches?.[index]?.homeTeam?.message}
                      required
                    >
                      <Input
                        {...register(`matches.${index}.homeTeam`)}
                        placeholder="Název týmu"
                        error={errors.matches?.[index]?.homeTeam?.message}
                      />
                    </FormField>

                    <FormField
                      label="Hostující tým"
                      error={errors.matches?.[index]?.awayTeam?.message}
                      required
                    >
                      <Input
                        {...register(`matches.${index}.awayTeam`)}
                        placeholder="Název týmu"
                        error={errors.matches?.[index]?.awayTeam?.message}
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      label="Skóre domácích"
                      error={errors.matches?.[index]?.homeScore?.message}
                      required
                    >
                      <Input
                        {...register(`matches.${index}.homeScore`, { valueAsNumber: true })}
                        type="number"
                        min="0"
                        placeholder="0"
                        error={errors.matches?.[index]?.homeScore?.message}
                      />
                    </FormField>

                    <FormField
                      label="Skóre hostů"
                      error={errors.matches?.[index]?.awayScore?.message}
                      required
                    >
                      <Input
                        {...register(`matches.${index}.awayScore`, { valueAsNumber: true })}
                        type="number"
                        min="0"
                        placeholder="0"
                        error={errors.matches?.[index]?.awayScore?.message}
                      />
                    </FormField>

                    <FormField
                      label="Střelci domácích"
                      error={errors.matches?.[index]?.homeGoalscorers?.message}
                    >
                      <Input
                        {...register(`matches.${index}.homeGoalscorers`)}
                        placeholder="15' Novák"
                        error={errors.matches?.[index]?.homeGoalscorers?.message}
                      />
                    </FormField>

                    <FormField
                      label="Střelci hostů"
                      error={errors.matches?.[index]?.awayGoalscorers?.message}
                    >
                      <Input
                        {...register(`matches.${index}.awayGoalscorers`)}
                        placeholder="22' Svoboda"
                        error={errors.matches?.[index]?.awayGoalscorers?.message}
                      />
                    </FormField>
                  </div>
                </div>
              ))}

              {/* Add match button at bottom of list */}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  className="w-full sm:w-auto sm:mx-auto sm:flex"
                  onClick={() => appendMatch({
                    homeTeam: '',
                    awayTeam: '',
                    homeScore: 0,
                    awayScore: 0,
                    homeGoalscorers: '',
                    awayGoalscorers: '',
                  })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Přidat další zápas
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Tournament Players Section */}
        <div className="border-t pt-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Hráči turnaje</h3>
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={() => appendPlayer({
                title: '',
                playerName: '',
              })}
            >
              <Plus className="w-4 h-4 mr-1" />
              Přidat hráče
            </Button>
          </div>

          {playerFields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-lg">
              Zatím nebyli přidáni žádní hráči. Klikněte na &quot;Přidat hráče&quot; pro přidání ocenění.
            </p>
          ) : (
            <div className="space-y-4">
              {playerFields.map((field, index) => (
                <div
                  key={field.id}
                  className="border border-border rounded-lg p-4 bg-card"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      Ocenění #{index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => removePlayer(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      label="Titul / Ocenění"
                      error={errors.players?.[index]?.title?.message}
                      required
                    >
                      <Input
                        {...register(`players.${index}.title`)}
                        placeholder="např. Nejlepší střelec turnaje"
                        error={errors.players?.[index]?.title?.message}
                      />
                    </FormField>

                    <FormField
                      label="Jméno hráče"
                      error={errors.players?.[index]?.playerName?.message}
                      required
                    >
                      <Input
                        {...register(`players.${index}.playerName`)}
                        placeholder="Jméno a příjmení"
                        error={errors.players?.[index]?.playerName?.message}
                      />
                    </FormField>
                  </div>
                </div>
              ))}

              {/* Add player button at bottom of list */}
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  onClick={() => appendPlayer({
                    title: '',
                    playerName: '',
                  })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Přidat další ocenění
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Ukládání...' : mode === 'edit' ? 'Uložit změny' : 'Uložit turnaj'}
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
