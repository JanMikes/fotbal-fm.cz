import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret } = body;

    const registrationSecret = process.env.REGISTRATION_SECRET;

    if (!registrationSecret) {
      return NextResponse.json(
        { valid: false },
        { status: 500 }
      );
    }

    const isValid = secret === registrationSecret;

    return NextResponse.json({ valid: isValid });
  } catch (error) {
    return NextResponse.json(
      { valid: false },
      { status: 400 }
    );
  }
}
