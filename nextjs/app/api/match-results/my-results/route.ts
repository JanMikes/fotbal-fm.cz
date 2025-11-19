import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiGetUserMatchResults } from '@/lib/strapi';

export async function GET() {
  try {
    // Check if user is authenticated
    const session = await getSession();
    if (!session || !session.isLoggedIn || !session.jwt) {
      return NextResponse.json(
        { success: false, error: 'Nejste přihlášeni' },
        { status: 401 }
      );
    }

    // Fetch user's match results from Strapi
    const matchResults = await strapiGetUserMatchResults(
      session.jwt,
      session.userId
    );

    return NextResponse.json({
      success: true,
      matchResults,
    });
  } catch (error) {
    console.error('Fetch match results error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při načítání výsledků zápasů' },
      { status: 500 }
    );
  }
}
