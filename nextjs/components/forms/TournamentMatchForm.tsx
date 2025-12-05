'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tournamentMatchSchema, TournamentMatchFormData } from '@/lib/validation';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useScrollToError } from '@/hooks/useScrollToError';
import { Tournament } from '@/types/tournament';
import { TournamentMatch } from '@/types/tournament-match';

interface TournamentMatchFormProps {
  mode?: 'create' | 'edit';
  initialData?: TournamentMatch;
  recordId?: string;
}

export default function TournamentMatchForm({
  mode = 'create',
  initialData,
  recordId,
}: TournamentMatchFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TournamentMatchFormData>({
    resolver: zodResolver(tournamentMatchSchema),
    mode: 'onSubmit',
    defaultValues: initialData
      ? {
          homeTeam: initialData.homeTeam,
          awayTeam: initialData.awayTeam,
          homeScore: initialData.homeScore,
          awayScore: initialData.awayScore,
          homeGoalscorers: initialData.homeGoalscorers || '',
          awayGoalscorers: initialData.awayGoalscorers || '',
          tournament: initialData.tournamentId,
        }
      : undefined,
  });

  useScrollToError(errors, { offset: 100 });

  // Fetch tournaments on mount
  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const response = await fetch('/api/tournaments/list');
        const result = await response.json();

        if (result.success) {
          setTournaments(result.tournaments);
        } else {
          setError('Nepodařilo se načíst seznam turnajů');
        }
      } catch {
        setError('Nepodařilo se načíst seznam turnajů');
      } finally {
        setLoadingTournaments(false);
      }
    };

    fetchTournaments();
  }, []);

  const onSubmit = async (data: TournamentMatchFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'edit' && recordId) {
        // Update existing record
        const response = await fetch(`/api/tournament-matches/${recordId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Nepodařilo se aktualizovat turnajový zápas');
        }

        router.push(`/turnaj/${data.tournament}?success=true`);
      } else {
        // Create new record
        const response = await fetch('/api/tournament-matches/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Nepodařilo se vytvořit turnajový zápas');
        }

        router.push('/turnaje?success=true');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(mode === 'edit' ? 'Nepodařilo se aktualizovat turnajový zápas' : 'Nepodařilo se vytvořit turnajový zápas');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingTournaments) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="Načítám turnaje..." />
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <LoadingSpinner
            fullscreen={false}
            message={mode === 'edit' ? 'Ukládání změn...' : 'Vytvářím turnajový zápas...'}
            size="lg"
          />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && <Alert variant="error">{error}</Alert>}

        <FormField
          label="Turnaj"
          error={errors.tournament?.message}
          required
        >
          <Select
            {...register('tournament')}
            error={errors.tournament?.message}
          >
            <option value="">Vyberte turnaj</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name} ({tournament.category}) - {new Date(tournament.dateFrom).toLocaleDateString('cs-CZ')}
              </option>
            ))}
          </Select>
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

        <div className="space-y-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Ukládání...' : mode === 'edit' ? 'Uložit změny' : 'Přidat zápas'}
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
