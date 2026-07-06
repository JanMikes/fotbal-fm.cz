import { NextRequest } from 'next/server';
import {
  withAuth,
  apiSuccess,
  ApiErrors,
  addApiBreadcrumb,
} from '@/lib/api';
import { MatchService, TournamentService, EventService } from '@/lib/services';

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const RECENT_LIMIT = 3;

export const GET = withAuth(async (
  request: NextRequest,
  { jwt }
) => {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const includeRecent = searchParams.get('recent') === 'true';
  const hasWindow = !!(from && to && DATE_FORMAT.test(from) && DATE_FORMAT.test(to));

  addApiBreadcrumb('Fetching dashboard summary', { from, to, includeRecent });

  const matchService = MatchService.forUser(jwt);
  const tournamentService = TournamentService.forUser(jwt);
  const eventService = EventService.forUser(jwt);

  // Entities with a [dateFrom, dateTo ?? dateFrom] range overlap the window
  // when dateFrom <= to AND (dateTo >= from OR dateFrom >= from).
  const rangeOverlapFilters = hasWindow
    ? {
        dateFrom: { $lte: to },
        $or: [
          { dateTo: { $gte: from } },
          { dateFrom: { $gte: from } },
        ],
      }
    : undefined;

  const calendarPromise = Promise.all([
    matchService.getAllSummary({
      filters: hasWindow ? { matchDate: { $gte: from, $lte: to } } : undefined,
    }),
    tournamentService.getAllSummary({ filters: rangeOverlapFilters }),
    eventService.getAllSummary({ filters: rangeOverlapFilters }),
  ]);

  const recentPromise = includeRecent
    ? Promise.all([
        matchService.getAllSummary({ limit: RECENT_LIMIT }),
        tournamentService.getAllSummary({ limit: RECENT_LIMIT }),
        eventService.getAllSummary({ limit: RECENT_LIMIT }),
      ])
    : null;

  const [matchesResult, tournamentsResult, eventsResult] = await calendarPromise;

  if (!matchesResult.success) {
    return ApiErrors.serverError(matchesResult.error.message);
  }
  if (!tournamentsResult.success) {
    return ApiErrors.serverError(tournamentsResult.error.message);
  }
  if (!eventsResult.success) {
    return ApiErrors.serverError(eventsResult.error.message);
  }

  let recent;
  if (recentPromise) {
    const [recentMatches, recentTournaments, recentEvents] = await recentPromise;

    if (!recentMatches.success) {
      return ApiErrors.serverError(recentMatches.error.message);
    }
    if (!recentTournaments.success) {
      return ApiErrors.serverError(recentTournaments.error.message);
    }
    if (!recentEvents.success) {
      return ApiErrors.serverError(recentEvents.error.message);
    }

    recent = {
      matches: recentMatches.data,
      tournaments: recentTournaments.data,
      events: recentEvents.data,
    };
  }

  return apiSuccess({
    matches: matchesResult.data,
    tournaments: tournamentsResult.data,
    events: eventsResult.data,
    ...(recent ? { recent } : {}),
  });
});
