import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiGetEvent, strapiUpdateEvent } from '@/lib/strapi';
import { eventApiSchema } from '@/lib/validation';
import { notifyEventUpdated } from '@/lib/notifications';

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
    const event = await strapiGetEvent(session.jwt, id);

    return NextResponse.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error('Fetch event error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při načítání události' },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    // Check ownership
    const existingRecord = await strapiGetEvent(session.jwt, id);
    if (existingRecord.authorId !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'Nemáte oprávnění upravit tento záznam' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = eventApiSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const event = await strapiUpdateEvent(
      session.jwt,
      id,
      validationResult.data
    );

    // Send notification (non-blocking)
    notifyEventUpdated(event);

    return NextResponse.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error('Update event error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při aktualizaci události' },
      { status: 500 }
    );
  }
}
