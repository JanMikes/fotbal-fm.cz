import { buildAppleAppSiteAssociation } from '@/lib/app-links';

// Apple's CDN fetches this on app install and periodically; it must be JSON, unredirected.
export function GET() {
  return new Response(JSON.stringify(buildAppleAppSiteAssociation()), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
