import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiGetMe } from '@/lib/strapi';
import { AuthResponse } from '@/types/api';

export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.jwt) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          error: 'Nepřihlášený uživatel',
        },
        { status: 401 }
      );
    }

    // Fetch fresh user data from Strapi
    const user = await strapiGetMe(session.jwt);

    return NextResponse.json<AuthResponse>({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get user error:', error);

    return NextResponse.json<AuthResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Chyba při načítání uživatele',
      },
      { status: 500 }
    );
  }
}
