import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import {
  withAuthFormData,
  apiSuccess,
  ApiErrors,
  getStringField,
  getFiles,
  addApiBreadcrumb,
  setFormContext,
} from '@/lib/api';
import { TournamentService, TournamentMatchService } from '@/lib/services';
import { tournamentApiSchema, inlineMatchApiSchema, tournamentPlayerSchema } from '@/lib/validation';

export const POST = withAuthFormData(async (request, { userId, jwt, formData }) => {
  addApiBreadcrumb('Creating tournament', {
    userId,
    formFields: [...formData.keys()],
  });

  setFormContext('TournamentForm', {
    mode: 'create',
    fields: [...formData.keys()],
    hasFiles: formData.has('photos'),
  });

  // Extract form fields
  const tournamentData = {
    name: getStringField(formData, 'name'),
    description: getStringField(formData, 'description'),
    location: getStringField(formData, 'location'),
    dateFrom: getStringField(formData, 'dateFrom'),
    dateTo: getStringField(formData, 'dateTo'),
    category: getStringField(formData, 'category'),
    imagesUrl: getStringField(formData, 'imagesUrl'),
  };

  // Validate the data
  const validationResult = tournamentApiSchema.safeParse(tournamentData);

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    return ApiErrors.validationFailed(firstError.message);
  }

  // Parse and validate matches if present
  const matchesJson = getStringField(formData, 'matches');
  let validatedMatches: z.infer<typeof inlineMatchApiSchema>[] = [];

  if (matchesJson) {
    try {
      const parsedMatches = JSON.parse(matchesJson);
      const matchesSchema = z.array(inlineMatchApiSchema);
      const matchesValidation = matchesSchema.safeParse(parsedMatches);

      if (!matchesValidation.success) {
        const firstError = matchesValidation.error.issues[0];
        return ApiErrors.validationFailed(`Chyba v zápasu: ${firstError.message}`);
      }

      validatedMatches = matchesValidation.data;
    } catch {
      return ApiErrors.validationFailed('Neplatný formát zápasů');
    }
  }

  // Parse and validate players if present
  const playersJson = getStringField(formData, 'players');
  let validatedPlayers: z.infer<typeof tournamentPlayerSchema>[] = [];

  if (playersJson) {
    try {
      const parsedPlayers = JSON.parse(playersJson);
      const playersSchema = z.array(tournamentPlayerSchema);
      const playersValidation = playersSchema.safeParse(parsedPlayers);

      if (!playersValidation.success) {
        const firstError = playersValidation.error.issues[0];
        return ApiErrors.validationFailed(`Chyba v hráči: ${firstError.message}`);
      }

      validatedPlayers = playersValidation.data;
    } catch {
      return ApiErrors.validationFailed('Neplatný formát hráčů');
    }
  }

  // Extract photos from form data
  const photos = getFiles(formData, 'photos');

  // Set Sentry context for debugging
  Sentry.setContext('tournament_request', {
    name: tournamentData.name,
    category: tournamentData.category,
    matchesCount: validatedMatches.length,
    playersCount: validatedPlayers.length,
    photosCount: photos.length,
  });

  // Use the service to create tournament
  const service = TournamentService.forUser(jwt);
  const result = await service.create(
    {
      ...validationResult.data,
      imagesUrl: validationResult.data.imagesUrl || undefined,
      author: userId,
      players: validatedPlayers.length > 0 ? validatedPlayers : undefined,
    },
    { photos }
  );

  if (!result.success) {
    return ApiErrors.serverError(result.error.message);
  }

  const tournament = result.data.tournament;

  // Validate response before proceeding
  if (!tournament || !tournament.id) {
    Sentry.captureMessage('Tournament created without valid ID', {
      level: 'error',
      extra: { tournament, tournamentData },
    });
    return ApiErrors.serverError('Turnaj byl vytvořen, ale nepodařilo se získat jeho ID');
  }

  // Create tournament matches if present
  if (validatedMatches.length > 0) {
    const matchService = TournamentMatchService.forUser(jwt);
    const matchesWithAuthor = validatedMatches.map((match) => ({
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homeGoalscorers: match.homeGoalscorers || undefined,
      awayGoalscorers: match.awayGoalscorers || undefined,
      tournament: tournament.id,
      author: userId,
    }));

    const matchesResult = await matchService.createMany(matchesWithAuthor);
    if (!matchesResult.success) {
      // Log but don't fail - tournament was created
      Sentry.captureMessage('Failed to create tournament matches', {
        level: 'warning',
        extra: { tournamentId: tournament.id, error: matchesResult.error },
      });
    }
  }

  return apiSuccess(
    { tournament },
    { warnings: result.data.uploadWarnings }
  );
});
