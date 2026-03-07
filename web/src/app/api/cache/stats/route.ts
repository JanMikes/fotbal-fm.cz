import { NextRequest, NextResponse } from 'next/server';
import { cacheStats, isValidWebhookSecret } from '@fotbal-fm/cache';

export async function GET(request: NextRequest) {
  const secret = request.headers.get('X-Strapi-Webhook-Signature');

  if (!isValidWebhookSecret(secret, process.env.STRAPI_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = await cacheStats();
  return NextResponse.json(stats);
}
