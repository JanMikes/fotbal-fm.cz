import { NextResponse, type NextRequest } from 'next/server';
import { gate } from '@/lib/record-gate';
import { UNAVAILABLE_HEADERS, UNAVAILABLE_HTML } from '@/lib/unavailable-page';

/**
 * Next.js proxy (Node.js runtime): the record gate. A record route whose own record cannot be
 * loaded — Strapi failing or too slow, and no copy cached — answers 503 "temporarily unavailable"
 * (Retry-After, no-store) instead of rendering a false 404 or an empty page. Everything else
 * passes through untouched; see src/lib/record-gate.ts.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return NextResponse.next();

  const decision = await gate(request.nextUrl.pathname);
  if (decision.status === 'pass') return NextResponse.next();

  console.error(`[Gate] 503 ${request.nextUrl.pathname}: ${decision.fn} ${decision.reason === 'timeout' ? 'not loaded in time' : 'Strapi failed, no cached copy'}`);
  return new NextResponse(request.method === 'HEAD' ? null : UNAVAILABLE_HTML, { status: 503, headers: UNAVAILABLE_HEADERS });
}

export const config = {
  // The record routes only: CMS pages (the top-level catch-all), categories and everything under
  // them, articles, partners. Never /_next, /api, the readiness latch — nor public files: the
  // catch-all takes only dot-free segments, so /logo.svg, /icon-192.png, … (also fetched by the
  // image optimizer) never pay the proxy and can never be 503'd (review BF-V1; a test checks
  // every file in web/public against these matchers, compiled as Next compiles them).
  matcher: ['/:slug([^/.]+)', '/kategorie/:category/:path*', '/novinky/clanek/:slug', '/partner/:slug'],
};
