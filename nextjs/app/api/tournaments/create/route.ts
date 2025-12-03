import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiCreateTournament } from '@/lib/strapi';
import { tournamentApiSchema } from '@/lib/validation';

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
    const tournamentData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      location: formData.get('location') as string,
      dateFrom: formData.get('dateFrom') as string,
      dateTo: formData.get('dateTo') as string,
      category: formData.get('category') as string,
      imagesUrl: formData.get('imagesUrl') as string,
    };

    // Validate the data
    const validationResult = tournamentApiSchema.safeParse({
      name: tournamentData.name,
      description: tournamentData.description || undefined,
      location: tournamentData.location || undefined,
      dateFrom: tournamentData.dateFrom,
      dateTo: tournamentData.dateTo || undefined,
      category: tournamentData.category,
      imagesUrl: tournamentData.imagesUrl || undefined,
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

    // Create tournament in Strapi with author relationship
    const dataToSend = {
      ...validationResult.data,
      imagesUrl: validationResult.data.imagesUrl || undefined,
      author: session.userId,
    };

    const tournament = await strapiCreateTournament(
      session.jwt,
      dataToSend,
      photos
    );

    return NextResponse.json({
      success: true,
      tournament,
    });
  } catch (error) {
    console.error('Tournament creation error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při vytváření turnaje' },
      { status: 500 }
    );
  }
}
