import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiChangePassword } from '@/lib/strapi';
import { changePasswordSchema } from '@/lib/validation';
import { ApiResponse } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    // IMPORTANT: Parse body BEFORE calling getSession() to avoid
    // "Response body object should not be disturbed or locked" error in production
    const body = await request.json();

    const session = await getSession();

    if (!session.isLoggedIn || !session.jwt) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Nepřihlášený uživatel',
        },
        { status: 401 }
      );
    }

    // Validate request data
    const validationResult = changePasswordSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: validationResult.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validationResult.data;

    // Change password in Strapi
    await strapiChangePassword(session.jwt, currentPassword, newPassword);

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error('Change password error:', error);

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Chyba při změně hesla',
      },
      { status: 500 }
    );
  }
}
