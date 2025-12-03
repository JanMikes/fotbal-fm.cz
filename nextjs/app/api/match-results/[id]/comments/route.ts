import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiGetComments } from '@/lib/strapi';

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
    const comments = await strapiGetComments(session.jwt, 'matchResult', id);

    return NextResponse.json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error('Fetch match result comments error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při načítání komentářů' },
      { status: 500 }
    );
  }
}
