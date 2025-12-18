import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  withAuth,
  withAuthFormData,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
  setFormContext,
  getStringField,
  getFiles,
} from '@/lib/api';
import { TournamentService, TournamentMatchService } from '@/lib/services';
import { tournamentApiSchema, inlineMatchApiSchema, tournamentPlayerSchema } from '@/lib/validation';

export const GET = withAuth(async (
  request: NextRequest,
  { jwt }
) => {
  // Extract ID from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  addApiBreadcrumb('Getting tournament', { id });

  const service = TournamentService.forUser(jwt);
  const result = await service.getById(id);

  if (!result.success) {
    if (result.error.code === 'NOT_FOUND') {
      return ApiErrors.notFound(result.error.message);
    }
    return ApiErrors.serverError(result.error.message);
  }

  return apiSuccess({ tournament: result.data });
});

export const PUT = withAuthFormData(async (
  request: NextRequest,
  { userId, jwt, formData }
) => {
  // Extract ID from URL
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];

  addApiBreadcrumb('Updating tournament', { id, userId });

  setFormContext('TournamentForm', {
    mode: 'edit',
    entityId: id,
    fields: [...formData.keys()],
    hasFiles: formData.has('photos') || formData.has('files'),
  });

  const service = TournamentService.forUser(jwt);

  // Check ownership
  const existingResult = await service.getById(id);
  if (!existingResult.success) {
    if (existingResult.error.code === 'NOT_FOUND') {
      return ApiErrors.notFound(existingResult.error.message);
    }
    return ApiErrors.serverError(existingResult.error.message);
  }

  if (existingResult.data.authorId !== userId) {
    return ApiErrors.forbidden('Nemáte oprávnění upravit tento záznam');
  }

  // Parse categories from JSON
  const categoryIdsJson = getStringField(formData, 'categoryIds');
  let categories: string[] = [];
  if (categoryIdsJson) {
    try {
      categories = JSON.parse(categoryIdsJson);
    } catch {
      return ApiErrors.validationFailed('Neplatný formát kategorií');
    }
  }

  // Extract form fields
  const tournamentData = {
    name: getStringField(formData, 'name'),
    dateFrom: getStringField(formData, 'dateFrom'),
    dateTo: getStringField(formData, 'dateTo'),
    categories,
    description: getStringField(formData, 'description'),
    location: getStringField(formData, 'location'),
    imagesUrl: getStringField(formData, 'imagesUrl'),
  };

  const validationResult = tournamentApiSchema.safeParse(tournamentData);

  if (!validationResult.success) {
    return ApiErrors.validationFailed(validationResult.error.issues[0].message);
  }

  // Parse matches from JSON string if present
  const matchesJson = getStringField(formData, 'matches');
  let validatedMatches: z.infer<typeof inlineMatchApiSchema>[] = [];
  if (matchesJson) {
    try {
      const parsedMatches = JSON.parse(matchesJson);
      if (Array.isArray(parsedMatches) && parsedMatches.length > 0) {
        const matchesSchema = z.array(inlineMatchApiSchema);
        const matchesValidation = matchesSchema.safeParse(parsedMatches);

        if (!matchesValidation.success) {
          const firstError = matchesValidation.error.issues[0];
          return ApiErrors.validationFailed(`Chyba v zápasu: ${firstError.message}`);
        }

        validatedMatches = matchesValidation.data;
      }
    } catch {
      return ApiErrors.validationFailed('Neplatný formát dat zápasů');
    }
  }

  // Parse players from JSON string if present
  const playersJson = getStringField(formData, 'players');
  let validatedPlayers: z.infer<typeof tournamentPlayerSchema>[] = [];
  if (playersJson) {
    try {
      const parsedPlayers = JSON.parse(playersJson);
      if (Array.isArray(parsedPlayers) && parsedPlayers.length > 0) {
        const playersSchema = z.array(tournamentPlayerSchema);
        const playersValidation = playersSchema.safeParse(parsedPlayers);

        if (!playersValidation.success) {
          const firstError = playersValidation.error.issues[0];
          return ApiErrors.validationFailed(`Chyba v hráči: ${firstError.message}`);
        }

        validatedPlayers = playersValidation.data;
      }
    } catch {
      return ApiErrors.validationFailed('Neplatný formát dat hráčů');
    }
  }

  // Extract photos from form data (tournaments don't support file attachments)
  const photos = getFiles(formData, 'photos');

  // Update tournament (without matches - those are handled separately)
  // Players are a component and are updated directly with the tournament
  const updateResult = await service.update(id, {
    ...validationResult.data,
    players: validatedPlayers.length > 0 ? validatedPlayers : [],
  }, { photos });

  if (!updateResult.success) {
    return ApiErrors.serverError(updateResult.error.message);
  }

  const tournament = updateResult.data.tournament;

  // Create new tournament matches if present
  if (validatedMatches.length > 0) {
    const matchService = TournamentMatchService.forUser(jwt);
    const matchesWithAuthor = validatedMatches.map((match) => ({
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homeGoalscorers: match.homeGoalscorers || undefined,
      awayGoalscorers: match.awayGoalscorers || undefined,
      tournament: id,
      author: userId,
    }));

    await matchService.createMany(matchesWithAuthor);
  }

  return apiSuccess(
    { tournament },
    { warnings: updateResult.data.uploadWarnings }
  );
});
