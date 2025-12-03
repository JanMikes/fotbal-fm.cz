import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { strapiCreateComment, strapiGetMatchResult, strapiGetTournament, strapiGetEvent, strapiGetMe } from '@/lib/strapi';
import { commentApiSchema } from '@/lib/validation';
import { notifyCommentAdded } from '@/lib/notifications';

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

    // Send notification (non-blocking) - fetch entity name and user info for better email content
    try {
      let entityType: 'matchResult' | 'tournament' | 'event';
      let entityName = '';

      // Fetch current user info for the notification
      const currentUser = await strapiGetMe(session.jwt);
      const commentWithAuthor = {
        ...comment,
        author: {
          id: currentUser.id,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
        },
      };

      if (matchResult) {
        entityType = 'matchResult';
        const entity = await strapiGetMatchResult(session.jwt, matchResult);
        entityName = `${entity.homeTeam} vs ${entity.awayTeam} (${entity.homeScore}:${entity.awayScore})`;
      } else if (tournament) {
        entityType = 'tournament';
        const entity = await strapiGetTournament(session.jwt, tournament);
        entityName = entity.name;
      } else {
        entityType = 'event';
        const entity = await strapiGetEvent(session.jwt, event!);
        entityName = entity.name;
      }

      notifyCommentAdded(commentWithAuthor, entityType, entityName);
    } catch {
      // If fetching entity fails, still send notification with fallback
      const entityType = matchResult ? 'matchResult' : tournament ? 'tournament' : 'event';
      const entityId = matchResult || tournament || event;
      notifyCommentAdded(comment, entityType, `ID: ${entityId}`);
    }

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
