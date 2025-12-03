import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiCreateMatchResult } from '@/lib/strapi';
import { matchResultApiSchema } from '@/lib/validation';
import { notifyMatchResultCreated } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    // CRITICAL: Must parse formData FIRST before calling getSession()
    // Even with middleware skipping API routes, getSession() uses cookies()
    // which locks the request body in production when dealing with large uploads
    const formData = await request.formData();

    const session = await getSession();
    if (!session || !session.isLoggedIn || !session.jwt) {
      return NextResponse.json(
        { success: false, error: 'Nejste přihlášeni' },
        { status: 401 }
      );
    }

    // Extract form fields
    const matchData = {
      homeTeam: formData.get('homeTeam') as string,
      awayTeam: formData.get('awayTeam') as string,
      homeScore: formData.get('homeScore') as string,
      awayScore: formData.get('awayScore') as string,
      homeGoalscorers: formData.get('homeGoalscorers') as string,
      awayGoalscorers: formData.get('awayGoalscorers') as string,
      matchReport: formData.get('matchReport') as string,
      category: formData.get('category') as string,
      matchDate: formData.get('matchDate') as string,
      imagesUrl: formData.get('imagesUrl') as string,
    };

    // Validate the data
    const validationResult = matchResultApiSchema.safeParse({
      homeTeam: matchData.homeTeam,
      awayTeam: matchData.awayTeam,
      homeScore: matchData.homeScore,
      awayScore: matchData.awayScore,
      homeGoalscorers: matchData.homeGoalscorers || undefined,
      awayGoalscorers: matchData.awayGoalscorers || undefined,
      matchReport: matchData.matchReport || undefined,
      category: matchData.category,
      matchDate: matchData.matchDate,
      imagesUrl: matchData.imagesUrl || undefined,
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        { success: false, error: firstError.message },
        { status: 400 }
      );
    }

    // Extract images from form data
    const images: File[] = [];
    const imageEntries = formData.getAll('images');
    for (const entry of imageEntries) {
      if (entry instanceof File && entry.size > 0) {
        images.push(entry);
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

    // Create match result in Strapi with author relationship
    const dataToSend = {
      ...validationResult.data,
      // Convert empty string to undefined for optional URL
      imagesUrl: validationResult.data.imagesUrl || undefined,
      author: session.userId, // Set the author to the current user
    };

    const matchResult = await strapiCreateMatchResult(
      session.jwt,
      dataToSend,
      images,
      files
    );

    // Send notification (non-blocking)
    notifyMatchResultCreated(matchResult);

    return NextResponse.json({
      success: true,
      matchResult,
    });
  } catch (error) {
    console.error('Match result creation error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při vytváření výsledku zápasu' },
      { status: 500 }
    );
  }
}
