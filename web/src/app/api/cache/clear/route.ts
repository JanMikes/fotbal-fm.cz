import { NextRequest, NextResponse } from 'next/server';
import { cacheClearAll, cacheDeletePattern, isValidWebhookSecret } from '@fotbal-fm/cache';

/**
 * Content types whose writes must NOT flush the whole site cache: every app registration
 * through a deep link creates a claim and bumps the link's counter. Strapi's own document
 * middleware already invalidates the few `deep-link:*` keys these touch.
 */
const TARGETED_MODELS: Record<string, string[]> = {
  'deep-link-claim': [],
  'deep-link': ['deep-link:*'],
  'audience-category': ['deep-link:*', 'audience-categories:*'],
};

export async function POST(request: NextRequest) {
  const secret = request.headers.get('X-Strapi-Webhook-Signature');

  if (!isValidWebhookSecret(secret, process.env.STRAPI_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const model = await readModel(request);
  if (model && model in TARGETED_MODELS) {
    let deleted = 0;
    for (const pattern of TARGETED_MODELS[model]) {
      deleted += await cacheDeletePattern(pattern);
    }
    return NextResponse.json({ cleared: false, model, deleted });
  }

  const cleared = await cacheClearAll();
  return NextResponse.json({ cleared });
}

/** Strapi webhook payload: { event, model, uid, entry }. Anything unparsable = full flush. */
async function readModel(request: NextRequest): Promise<string | null> {
  try {
    const body = (await request.json()) as { model?: unknown };
    return typeof body?.model === 'string' ? body.model : null;
  } catch {
    return null;
  }
}
