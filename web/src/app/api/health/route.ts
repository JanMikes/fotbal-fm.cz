/**
 * Docker healthcheck of the web container — a readiness latch (D75).
 *
 * Until one real page has rendered, it answers 503: it renders `/` itself (following the 307
 * to the first category) and requires a 200 that contains the site header. That keeps the
 * deploy smoke test the old `wget /` healthcheck gave: a build that cannot render stays
 * `starting`, Traefik never routes to it and the rollout reverts it. After the first success
 * the latch stays closed for the life of the process and this is a cheap liveness answer —
 * it never renders again and never depends on Strapi, so a slow render under load or a Strapi
 * outage cannot turn the container unhealthy (Traefik would then drop the only replica).
 *
 * It does NOT prove Strapi works: with Strapi down every section renders its empty fallback,
 * the page is still a 200 with a header, and the latch opens.
 */

const SMOKE_TIMEOUT_MS = 8000; // below the 10 s Docker healthcheck timeout
/** Rendered by the root layout's <Header> on every page, including the empty-data fallback. */
const READY_MARKER = '<header';

let ready = false;
let smoke: Promise<boolean> | null = null;

async function smokeRender(): Promise<boolean> {
  const port = process.env.PORT ?? '3000';
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(SMOKE_TIMEOUT_MS),
      headers: { 'x-fm-smoke': '1' },
    });
    const body = res.ok ? await res.text() : '';
    if (!res.ok || !body.includes(READY_MARKER)) {
      console.warn(`[Health] Smoke render of / not ready yet: HTTP ${res.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`[Health] Smoke render of / failed: ${(error as Error).message}`);
    return false;
  }
}

export async function GET() {
  if (!ready) {
    // Concurrent probes share one smoke render.
    smoke ??= smokeRender().finally(() => {
      smoke = null;
    });
    if (await smoke) ready = true; // a latch: once open it never closes again
  }
  return Response.json({ status: ready ? 'ok' : 'warming' }, { status: ready ? 200 : 503 });
}

// Never prerendered at build time (a build-time smoke fetch would bake a 503).
export const dynamic = 'force-dynamic';
