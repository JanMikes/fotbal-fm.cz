import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiCreateTournamentMatch } from '@/lib/strapi';
import { tournamentMatchApiSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const session = await getSession();
    if (!session || !session.isLoggedIn || !session.jwt) {
      return NextResponse.json(
        { success: false, error: 'Nejste přihlášeni' },
        { status: 401 }
      );
    }

    // Validate the data
    const validationResult = tournamentMatchApiSchema.safeParse(body);

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        { success: false, error: firstError.message },
        { status: 400 }
      );
    }

    // Create tournament match in Strapi with author relationship
    const dataToSend = {
      ...validationResult.data,
      author: session.userId,
    };

    const tournamentMatch = await strapiCreateTournamentMatch(
      session.jwt,
      dataToSend
    );

    return NextResponse.json({
      success: true,
      tournamentMatch,
    });
  } catch (error) {
    console.error('Tournament match creation error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při vytváření turnajového zápasu' },
      { status: 500 }
    );
  }
}
