import { NextRequest, NextResponse } from 'next/server';
import { strapiLogin } from '@/lib/strapi';
import { createSession } from '@/lib/session';
import { loginSchema } from '@/lib/validation';
import { AuthResponse } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request data
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          error: validationResult.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Login with Strapi
    const { user, jwt } = await strapiLogin(email, password);

    // Create session
    await createSession(user.id, user.email, jwt);

    return NextResponse.json<AuthResponse>({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Login error:', error);

    return NextResponse.json<AuthResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Chyba při přihlašování',
      },
      { status: 401 }
    );
  }
}
