import { NextRequest, NextResponse } from 'next/server';
import { invalidateCache, isValidWebhookSecret } from '@fotbal-fm/cache';
import type { WebhookPayload } from '@fotbal-fm/cache';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('X-Strapi-Webhook-Signature');

  if (!isValidWebhookSecret(signature, process.env.STRAPI_WEBHOOK_SECRET)) {
    console.log('[Webhook] Unauthorized: secret mismatch or missing');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payload: WebhookPayload = {
      event: body.event,
      model: body.model,
      entry: body.entry,
    };

    console.log(`[Webhook] ${payload.event} on ${payload.model}${payload.entry?.slug ? ` slug:${payload.entry.slug}` : ''}`);

    // Wait for Strapi's DB transaction to commit
    // Strapi fires webhook before the transaction is committed
    await new Promise(resolve => setTimeout(resolve, 500));

    const result = await invalidateCache(payload);

    // Safety net: delayed re-invalidation for race conditions
    const payloadCopy = { ...payload };
    setTimeout(async () => {
      try {
        await invalidateCache(payloadCopy);
      } catch (err) {
        console.error('[Webhook] Delayed re-invalidation failed:', err);
      }
    }, 1000);

    return NextResponse.json({
      received: true,
      ...result,
    });
  } catch (error) {
    console.error('[Webhook] Error processing payload:', error);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
