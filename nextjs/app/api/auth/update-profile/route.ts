import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiUpdateProfile } from '@/lib/strapi';
import { updateProfileSchema } from '@/lib/validation';
import { AuthResponse } from '@/types/api';

export async function PUT(request: NextRequest) {
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

    const body = await request.json();

    // Validate request data
    const validationResult = updateProfileSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          error: validationResult.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const { firstName, lastName, jobTitle } = validationResult.data;

    // Update profile in Strapi
    const user = await strapiUpdateProfile(session.jwt, session.userId, {
      firstName,
      lastName,
      jobTitle,
    });

    return NextResponse.json<AuthResponse>({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Update profile error:', error);

    return NextResponse.json<AuthResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Chyba při aktualizaci profilu',
      },
      { status: 500 }
    );
  }
}
