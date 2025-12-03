import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiCreateComment } from '@/lib/strapi';
import { commentApiSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isLoggedIn || !session.jwt) {
      return NextResponse.json(
        { success: false, error: 'Nejste přihlášeni' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validationResult = commentApiSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    // Validate that exactly one entity type is specified
    const { matchResult, tournament, event } = validationResult.data;
    const entityCount = [matchResult, tournament, event].filter(Boolean).length;

    if (entityCount !== 1) {
      return NextResponse.json(
        { success: false, error: 'Komentář musí patřit právě k jedné entitě' },
        { status: 400 }
      );
    }

    // Add author from session - Strapi 5 relations accept numeric id
    const commentData = {
      ...validationResult.data,
      author: session.userId,
    };

    const comment = await strapiCreateComment(session.jwt, commentData);

    return NextResponse.json({
      success: true,
      comment,
    });
  } catch (error) {
    console.error('Create comment error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Chyba při vytváření komentáře' },
      { status: 500 }
    );
  }
}
