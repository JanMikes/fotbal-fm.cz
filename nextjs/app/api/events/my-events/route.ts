import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiGetUserEvents } from '@/lib/strapi';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.isLoggedIn || !session.jwt) {
      return NextResponse.json(
        { success: false, error: 'Nejste přihlášeni' },
        { status: 401 }
      );
    }

    const events = await strapiGetUserEvents(
      session.jwt,
      session.userId
    );

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error('Fetch events error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při načítání událostí' },
      { status: 500 }
    );
  }
}
