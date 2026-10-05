import { NextRequest, NextResponse } from 'next/server';
import { bumpTags, isValidWebhookSecret } from '@fotbal-fm/cache';
import { tagsForUid } from '@fotbal-fm/cache/type-tags';

/**
 * TRANSITIONAL (lily D75 Phase 1): the Strapi "Clear cache" webhook's target until the webhook is
 * disabled. It no longer flushes anything: the written content type's tags are bumped (the data
 * cache v2 refreshes their entries on the next read, serving the old copy meanwhile), through the
 * same type → tags map Strapi's own transport uses — content types the web never reads (comments,
 * events, social exports, deep-link claims) bump nothing, an unmapped api:: type bumps `all`.
 * Strapi's transport bumps the same writes after commit; this endpoint is the belt to its braces
 * while both run, and is deleted together with the webhook.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('X-Strapi-Webhook-Signature');

  if (!isValidWebhookSecret(secret, process.env.STRAPI_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const uid = await readUid(request);
  const tags = uid ? tagsForUid(uid) : ['all'];
  const bumped = await bumpTags(tags);
  if (tags.length > 0) {
    console.log(`[Cache] webhook ${uid ?? '(unparsable payload)'} -> bumped tags=${tags.join(',')}${bumped ? '' : ' FAILED (Redis unavailable)'}`);
  }
  return NextResponse.json({ model: uid, tags, bumped }, { status: bumped ? 200 : 503 });
}

/** Strapi webhook payload: { event, model, uid, entry }. `uid` (api::x.x) when present, else built from `model`. */
async function readUid(request: NextRequest): Promise<string | null> {
  try {
    const body = (await request.json()) as { model?: unknown; uid?: unknown };
    if (typeof body?.uid === 'string') return body.uid;
    return typeof body?.model === 'string' ? `api::${body.model}.${body.model}` : null;
  } catch {
    return null;
  }
}
