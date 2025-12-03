import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiGetTournament, strapiUpdateTournament, strapiCreateTournamentMatch } from '@/lib/strapi';
import { tournamentApiSchema, inlineMatchApiSchema } from '@/lib/validation';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.isLoggedIn || !session.jwt) {
      return NextResponse.json(
        { success: false, error: 'Nejste přihlášeni' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const tournament = await strapiGetTournament(session.jwt, id);

    return NextResponse.json({
      success: true,
      tournament,
    });
  } catch (error) {
    console.error('Fetch tournament error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při načítání turnaje' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.isLoggedIn || !session.jwt) {
      return NextResponse.json(
        { success: false, error: 'Nejste přihlášeni' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check ownership
    const existingRecord = await strapiGetTournament(session.jwt, id);
    if (existingRecord.authorId !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'Nemáte oprávnění upravit tento záznam' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = tournamentApiSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    // Validate matches if present
    let validatedMatches: z.infer<typeof inlineMatchApiSchema>[] = [];
    if (body.matches && Array.isArray(body.matches) && body.matches.length > 0) {
      const matchesSchema = z.array(inlineMatchApiSchema);
      const matchesValidation = matchesSchema.safeParse(body.matches);

      if (!matchesValidation.success) {
        const firstError = matchesValidation.error.issues[0];
        return NextResponse.json(
          { success: false, error: `Chyba v zápasu: ${firstError.message}` },
          { status: 400 }
        );
      }

      validatedMatches = matchesValidation.data;
    }

    // Update tournament (without matches - those are handled separately)
    const { matches: _matches, ...tournamentData } = validationResult.data;
    const tournament = await strapiUpdateTournament(
      session.jwt,
      id,
      tournamentData
    );

    // Create new tournament matches if present
    if (validatedMatches.length > 0) {
      const tournamentId = parseInt(id, 10);

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

    return NextResponse.json({
      success: true,
      tournament,
    });
  } catch (error) {
    console.error('Update tournament error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při aktualizaci turnaje' },
      { status: 500 }
    );
  }
}
