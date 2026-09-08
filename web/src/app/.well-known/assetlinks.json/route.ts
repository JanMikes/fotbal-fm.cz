import { buildAssetLinks } from '@/lib/app-links';

// Android verifies App Links against this file at install time.
export function GET() {
  return new Response(JSON.stringify(buildAssetLinks()), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
