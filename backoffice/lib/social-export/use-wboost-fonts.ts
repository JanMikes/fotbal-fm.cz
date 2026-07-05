'use client';

import { useEffect, useState } from 'react';
import type { ProjectFontsResponse } from './api-types';
import { SOCIAL_EXPORT_API_BASE } from './api-types';

/**
 * Load the project's WBoost fonts into `document.fonts` so client-side text
 * measurement (`text-layout.ts`) wraps with the REAL glyph metrics — wrap
 * points measured with a fallback face put the live placeholder boxes (and
 * the overflow pre-check) at wrong positions.
 *
 * Mirrors the export render's own font loading: one `FontFace` per face,
 * keyed by the exact Fabric family string ("Rubik (Rubik Bold)"), NO
 * weight/style descriptors — faces are standalone families. Files stream
 * through the same-origin font proxy, so CORS never applies.
 *
 * Module-level singleton: all mounts share one load; a failed load resets so
 * a later mount retries. `fontsReady` flips to true only when every listed
 * face loaded — callers gate the overflow pre-check on it (a partial font set
 * must not block downloads on mis-measured text).
 */
let fontsPromise: Promise<boolean> | null = null;

async function loadProjectFonts(): Promise<boolean> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return false;

  const res = await fetch(`${SOCIAL_EXPORT_API_BASE}/fonts`);
  if (!res.ok) return false;

  const json = (await res.json()) as { success: boolean; data?: ProjectFontsResponse };
  const fonts = json.success ? json.data?.fonts ?? [] : null;
  if (!fonts) return false;

  const results = await Promise.allSettled(
    fonts.map(async (font) => {
      // Already registered (e.g. by a previous page visit in this SPA session).
      const alreadyLoaded = document.fonts.check(`16px "${font.family.replace(/"/g, '\\"')}"`);
      if (alreadyLoaded) return;
      const face = new FontFace(font.family, `url("${font.url}")`);
      await face.load();
      document.fonts.add(face);
    })
  );

  return results.every((r) => r.status === 'fulfilled');
}

export function useWboostFonts(): { fontsReady: boolean } {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const promise = (fontsPromise ??= loadProjectFonts().catch(() => false));
    promise.then((loaded) => {
      // Let the next mount retry a failed/partial load.
      if (!loaded && fontsPromise === promise) fontsPromise = null;
      if (!cancelled && loaded) setFontsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { fontsReady };
}
