import { NextRequest, NextResponse } from 'next/server';
import { strapiRegister } from '@/lib/strapi';
import { createSession } from '@/lib/session';
import { registerSchema } from '@/lib/validation';
import { notifyUserRegistered } from '@/lib/notifications';
import { AuthResponse } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate registration secret
    const registrationSecret = process.env.REGISTRATION_SECRET;
    if (!registrationSecret) {
      console.error('REGISTRATION_SECRET environment variable is not set');
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          error: 'Registrace je momentálně nedostupná',
        },
        { status: 500 }
      );
    }

    if (!body.secret || body.secret !== registrationSecret) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          error: 'Neplatný registrační kód',
        },
        { status: 403 }
      );
    }

    // Validate request data
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json<AuthResponse>(
        {
          success: false,
          error: validationResult.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const { email, password, firstName, lastName, jobTitle } = validationResult.data;

    // Register with Strapi
    const { user, jwt } = await strapiRegister({
      email,
      password,
      firstName,
      lastName,
      jobTitle,
    });

    // Automatically log in - create session
    await createSession(user.id, user.email, jwt);

    // Send notification (non-blocking)
    notifyUserRegistered(user);

    return NextResponse.json<AuthResponse>({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Registration error:', error);

    return NextResponse.json<AuthResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Chyba při registraci',
      },
      { status: 400 }
    );
  }
}
