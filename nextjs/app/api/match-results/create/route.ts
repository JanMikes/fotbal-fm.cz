import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiCreateMatchResult } from '@/lib/strapi';
import { matchResultApiSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getSession();
    if (!session || !session.isLoggedIn || !session.jwt) {
      return NextResponse.json(
        { success: false, error: 'Nejste přihlášeni' },
        { status: 401 }
      );
    }

    // Parse the multipart form data
    const formData = await request.formData();

    // Extract form fields
    const matchData = {
      homeTeam: formData.get('homeTeam') as string,
      awayTeam: formData.get('awayTeam') as string,
      homeScore: formData.get('homeScore') as string,
      awayScore: formData.get('awayScore') as string,
      homeGoalscorers: formData.get('homeGoalscorers') as string,
      awayGoalscorers: formData.get('awayGoalscorers') as string,
      matchReport: formData.get('matchReport') as string,
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

    // Create match result in Strapi with author relationship
    const dataToSend = {
      ...validationResult.data,
      author: session.userId, // Set the author to the current user
    };

    const matchResult = await strapiCreateMatchResult(
      session.jwt,
      dataToSend,
      images
    );

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
