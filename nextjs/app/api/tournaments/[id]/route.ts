import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiGetTournament, strapiUpdateTournament } from '@/lib/strapi';
import { tournamentApiSchema } from '@/lib/validation';

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

    const tournament = await strapiUpdateTournament(
      session.jwt,
      id,
      validationResult.data
    );

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
