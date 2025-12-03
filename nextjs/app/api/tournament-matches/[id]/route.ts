import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiGetTournamentMatch, strapiUpdateTournamentMatch } from '@/lib/strapi';
import { tournamentMatchApiSchema } from '@/lib/validation';

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
    const tournamentMatch = await strapiGetTournamentMatch(session.jwt, id);

    return NextResponse.json({
      success: true,
      tournamentMatch,
    });
  } catch (error) {
    console.error('Fetch tournament match error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při načítání turnajového zápasu' },
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
    const existingRecord = await strapiGetTournamentMatch(session.jwt, id);
    if (existingRecord.authorId !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'Nemáte oprávnění upravit tento záznam' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = tournamentMatchApiSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const tournamentMatch = await strapiUpdateTournamentMatch(
      session.jwt,
      id,
      validationResult.data
    );

    return NextResponse.json({
      success: true,
      tournamentMatch,
    });
  } catch (error) {
    console.error('Update tournament match error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při aktualizaci turnajového zápasu' },
      { status: 500 }
    );
  }
}
