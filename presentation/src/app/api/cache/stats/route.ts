import { NextRequest, NextResponse } from 'next/server';
import { cacheStats } from '@fotbal-fm/cache';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');

  if (!process.env.STRAPI_WEBHOOK_SECRET || secret !== process.env.STRAPI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = await cacheStats();
  return NextResponse.json(stats);
}
