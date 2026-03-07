import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { MatchService, TournamentService, EventService } from '@/lib/services';

export const GET = withAuth(async (
  _request,
  { jwt }
) => {
  addApiBreadcrumb('Fetching dashboard summary');

  const matchService = MatchService.forUser(jwt);
  const tournamentService = TournamentService.forUser(jwt);
  const eventService = EventService.forUser(jwt);

  const [matchesResult, tournamentsResult, eventsResult] = await Promise.all([
    matchService.getAllSummary(),
    tournamentService.getAllSummary(),
    eventService.getAllSummary(),
  ]);

  if (!matchesResult.success) {
    return ApiErrors.serverError(matchesResult.error.message);
  }
  if (!tournamentsResult.success) {
    return ApiErrors.serverError(tournamentsResult.error.message);
  }
  if (!eventsResult.success) {
    return ApiErrors.serverError(eventsResult.error.message);
  }

  return apiSuccess({
    matches: matchesResult.data,
    tournaments: tournamentsResult.data,
    events: eventsResult.data,
  });
});
