import { NextRequest, NextResponse } from 'next/server';
import { cacheClearAll } from '@fotbal-fm/cache';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('X-Strapi-Webhook-Signature')
    || request.nextUrl.searchParams.get('secret');

  if (!process.env.STRAPI_WEBHOOK_SECRET || secret !== process.env.STRAPI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cleared = await cacheClearAll();
  return NextResponse.json({ cleared });
}
