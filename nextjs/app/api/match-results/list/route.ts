import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiGetAllMatchResults } from '@/lib/strapi';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isLoggedIn || !session.jwt) {
      return NextResponse.json(
        { success: false, error: 'Nejste přihlášeni' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const onlyMine = searchParams.get('onlyMine') === 'true';

    const matchResults = await strapiGetAllMatchResults(
      session.jwt,
      onlyMine ? session.userId : undefined
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
