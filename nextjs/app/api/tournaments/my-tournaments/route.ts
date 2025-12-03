import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiGetUserTournaments } from '@/lib/strapi';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.isLoggedIn || !session.jwt) {
      return NextResponse.json(
        { success: false, error: 'Nejste přihlášeni' },
        { status: 401 }
      );
    }

    const tournaments = await strapiGetUserTournaments(
      session.jwt,
      session.userId
    );

    return NextResponse.json({
      success: true,
      tournaments,
    });
  } catch (error) {
    console.error('Fetch tournaments error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při načítání turnajů' },
      { status: 500 }
    );
  }
}
