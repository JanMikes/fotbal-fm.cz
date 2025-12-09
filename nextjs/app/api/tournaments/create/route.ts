import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiCreateTournament, strapiCreateTournamentMatch } from '@/lib/strapi';
import { tournamentApiSchema, inlineMatchApiSchema, tournamentPlayerSchema } from '@/lib/validation';
import { notifyTournamentCreated } from '@/lib/notifications';
import { z } from 'zod';
import * as Sentry from "@sentry/nextjs";

export async function POST(request: NextRequest) {
  console.log('[Tournament Create] API route hit');

  try {
    // CRITICAL: Must parse formData FIRST before calling getSession()
    console.log('[Tournament Create] Parsing formData...');
    const formData = await request.formData();
    console.log('[Tournament Create] FormData parsed successfully');

    console.log('[Tournament Create] Getting session...');
    const session = await getSession();
    console.log('[Tournament Create] Session retrieved:', {
      hasSession: !!session,
      isLoggedIn: session?.isLoggedIn,
      hasJwt: !!session?.jwt,
      userId: session?.userId
    });

    if (!session || !session.isLoggedIn || !session.jwt) {
      return NextResponse.json(
        { success: false, error: 'Nejste přihlášeni' },
        { status: 401 }
      );
    }

    // Extract form fields
    console.log('[Tournament Create] Extracting form fields...');
    const tournamentData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      location: formData.get('location') as string,
      dateFrom: formData.get('dateFrom') as string,
      dateTo: formData.get('dateTo') as string,
      category: formData.get('category') as string,
      imagesUrl: formData.get('imagesUrl') as string,
    };
    console.log('[Tournament Create] Form fields extracted:', {
      name: tournamentData.name,
      category: tournamentData.category,
      dateFrom: tournamentData.dateFrom
    });

    // Validate the data
    const validationResult = tournamentApiSchema.safeParse({
      name: tournamentData.name,
      description: tournamentData.description || undefined,
      location: tournamentData.location || undefined,
      dateFrom: tournamentData.dateFrom,
      dateTo: tournamentData.dateTo || undefined,
      category: tournamentData.category,
      imagesUrl: tournamentData.imagesUrl || undefined,
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        { success: false, error: firstError.message },
        { status: 400 }
      );
    }

    // Parse and validate matches if present
    const matchesJson = formData.get('matches') as string;
    let validatedMatches: z.infer<typeof inlineMatchApiSchema>[] = [];

    if (matchesJson) {
      try {
        const parsedMatches = JSON.parse(matchesJson);
        const matchesSchema = z.array(inlineMatchApiSchema);
        const matchesValidation = matchesSchema.safeParse(parsedMatches);

        if (!matchesValidation.success) {
          const firstError = matchesValidation.error.issues[0];
          return NextResponse.json(
            { success: false, error: `Chyba v zápasu: ${firstError.message}` },
            { status: 400 }
          );
        }

        validatedMatches = matchesValidation.data;
      } catch {
        return NextResponse.json(
          { success: false, error: 'Neplatný formát zápasů' },
          { status: 400 }
        );
      }
    }

    // Parse and validate players if present
    const playersJson = formData.get('players') as string;
    let validatedPlayers: z.infer<typeof tournamentPlayerSchema>[] = [];

    if (playersJson) {
      try {
        const parsedPlayers = JSON.parse(playersJson);
        const playersSchema = z.array(tournamentPlayerSchema);
        const playersValidation = playersSchema.safeParse(parsedPlayers);

        if (!playersValidation.success) {
          const firstError = playersValidation.error.issues[0];
          return NextResponse.json(
            { success: false, error: `Chyba v hráči: ${firstError.message}` },
            { status: 400 }
          );
        }

        validatedPlayers = playersValidation.data;
      } catch {
        return NextResponse.json(
          { success: false, error: 'Neplatný formát hráčů' },
          { status: 400 }
        );
      }
    }

    // Extract photos from form data
    const photos: File[] = [];
    const photoEntries = formData.getAll('photos');
    for (const entry of photoEntries) {
      if (entry instanceof File && entry.size > 0) {
        photos.push(entry);
      }
    }

    // Create tournament in Strapi with author relationship and players component
    const dataToSend = {
      ...validationResult.data,
      imagesUrl: validationResult.data.imagesUrl || undefined,
      author: session.userId,
      players: validatedPlayers.length > 0 ? validatedPlayers : undefined,
    };

    // Set Sentry context for debugging
    Sentry.setContext("tournament_request", {
      name: tournamentData.name,
      category: tournamentData.category,
      matchesCount: validatedMatches.length,
      playersCount: validatedPlayers.length,
      photosCount: photos.length,
    });

    console.log('[Tournament Create] About to call Strapi...', {
      dataToSend: { ...dataToSend, author: '[REDACTED]' },
      photosCount: photos.length
    });

    const tournament = await strapiCreateTournament(
      session.jwt,
      dataToSend,
      photos
    );

    // DEBUG: Validate response before returning
    if (!tournament || !tournament.id) {
      console.error('[Tournament Create] Invalid tournament response:', tournament);
      Sentry.captureMessage('Tournament created without valid ID', {
        level: 'error',
        extra: { tournament, tournamentData },
      });
      throw new Error('Turnaj byl vytvořen, ale nepodařilo se získat jeho ID');
    }

    console.log('[Tournament Create] Success:', { id: tournament.id, name: tournament.name });

    // Create tournament matches if present
    if (validatedMatches.length > 0) {
      // Use documentId (string) for Strapi 5 relations
      const tournamentId = tournament.id;

      await Promise.all(
        validatedMatches.map((match) =>
          strapiCreateTournamentMatch(session.jwt, {
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            homeGoalscorers: match.homeGoalscorers || undefined,
            awayGoalscorers: match.awayGoalscorers || undefined,
            tournament: tournamentId,
            author: session.userId,
          })
        )
      );
    }

    // Send notification (non-blocking)
    notifyTournamentCreated(tournament, validatedMatches.length);

    return NextResponse.json({
      success: true,
      tournament,
    });
  } catch (error) {
    console.error('Tournament creation error:', error);

    // Capture to Sentry with full context
    Sentry.withScope((scope) => {
      scope.setLevel('error');
      Sentry.captureException(error);
    });

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při vytváření turnaje' },
      { status: 500 }
    );
  }
}
