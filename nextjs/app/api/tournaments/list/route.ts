import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiGetTournamentsWithFilter } from '@/lib/strapi';

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

    const tournaments = await strapiGetTournamentsWithFilter(
      session.jwt,
      onlyMine ? session.userId : undefined
    );

    return NextResponse.json({
      success: true,
      tournaments,
    });
  } catch (error) {
    console.error('Fetch tournaments list error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při načítání seznamu turnajů' },
      { status: 500 }
    );
  }
}
