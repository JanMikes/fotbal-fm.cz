import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiCreateEvent } from '@/lib/strapi';
import { eventApiSchema } from '@/lib/validation';
import { notifyEventCreated } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Must parse formData FIRST before calling getSession()
    const formData = await request.formData();

    const session = await getSession();
    if (!session || !session.isLoggedIn || !session.jwt) {
      return NextResponse.json(
        { success: false, error: 'Nejste přihlášeni' },
        { status: 401 }
      );
    }

    // Extract form fields
    const eventData = {
      name: formData.get('name') as string,
      eventType: formData.get('eventType') as string,
      dateFrom: formData.get('dateFrom') as string,
      dateTo: formData.get('dateTo') as string,
      publishDate: formData.get('publishDate') as string,
      eventTime: formData.get('eventTime') as string,
      description: formData.get('description') as string,
      requiresPhotographer: formData.get('requiresPhotographer') as string,
    };

    // Validate the data
    const validationResult = eventApiSchema.safeParse({
      name: eventData.name,
      eventType: eventData.eventType,
      dateFrom: eventData.dateFrom,
      dateTo: eventData.dateTo || undefined,
      publishDate: eventData.publishDate || undefined,
      eventTime: eventData.eventTime || undefined,
      description: eventData.description || undefined,
      requiresPhotographer: eventData.requiresPhotographer,
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        { success: false, error: firstError.message },
        { status: 400 }
      );
    }

    // Extract photos from form data
    const photos: File[] = [];
    const photoEntries = formData.getAll('photos');
    for (const entry of photoEntries) {
      if (entry instanceof File && entry.size > 0) {
        photos.push(entry);
      }
    }

    // Extract files from form data
    const files: File[] = [];
    const fileEntries = formData.getAll('files');
    for (const entry of fileEntries) {
      if (entry instanceof File && entry.size > 0) {
        files.push(entry);
      }
    }

    // Create event in Strapi with author relationship
    const dataToSend = {
      ...validationResult.data,
      author: session.userId,
    };

    const event = await strapiCreateEvent(
      session.jwt,
      dataToSend,
      photos,
      files
    );

    // Send notification (non-blocking)
    notifyEventCreated(event);

    return NextResponse.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error('Event creation error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při vytváření události' },
      { status: 500 }
    );
  }
}
