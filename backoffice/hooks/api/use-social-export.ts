'use client';

/**
 * Hooks and utilities for the social-export feature.
 */

import useSWR, { KeyedMutator } from 'swr';
import {
  SOCIAL_EXPORT_API_BASE,
  TemplateDTO,
  RenderInputValue,
  RenderImageValue,
  GalleryImageDTO,
  RenderErrorDetails,
} from '@/lib/social-export/api-types';
import type { SavedExportState, SavedExportStateDTO } from '@/lib/social-export/saved-state';

// ---------------------------------------------------------------------------
// Fetcher helper for SWR
// ---------------------------------------------------------------------------

async function fetchTemplates(): Promise<TemplateDTO[]> {
  const res = await fetch(`${SOCIAL_EXPORT_API_BASE}/templates`);
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Nepodařilo se načíst šablony');
  }
  return json.data.templates as TemplateDTO[];
}

// ---------------------------------------------------------------------------
// Hook: useSocialExportTemplates
// ---------------------------------------------------------------------------

export function useSocialExportTemplates(): {
  templates: TemplateDTO[];
  isLoading: boolean;
  error: string | null;
} {
  const { data, error, isLoading } = useSWR<TemplateDTO[], Error>(
    `${SOCIAL_EXPORT_API_BASE}/templates`,
    fetchTemplates,
    { revalidateOnFocus: false }
  );

  return {
    templates: data ?? [],
    isLoading,
    error: error ? error.message : null,
  };
}

// ---------------------------------------------------------------------------
// Saved editor state (global, per match + variant)
// ---------------------------------------------------------------------------

async function fetchSavedStates(url: string): Promise<SavedExportStateDTO[]> {
  const res = await fetch(url);
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Nepodařilo se načíst uložený stav');
  }
  return json.data.states as SavedExportStateDTO[];
}

/**
 * All saved export states for a match (one per variant). Pass null to skip
 * fetching (e.g. while the user is not authenticated yet). A fetch error
 * degrades to "no saved states" so the editor still works from the prefill.
 */
export function useSavedExportStates(matchId: string | null): {
  states: SavedExportStateDTO[];
  isLoading: boolean;
  mutate: KeyedMutator<SavedExportStateDTO[]>;
} {
  const { data, isLoading, mutate } = useSWR<SavedExportStateDTO[], Error>(
    matchId ? `${SOCIAL_EXPORT_API_BASE}/state?matchId=${encodeURIComponent(matchId)}` : null,
    fetchSavedStates,
    { revalidateOnFocus: false }
  );

  return { states: data ?? [], isLoading, mutate };
}

export interface SaveExportStatePayload {
  matchId: string;
  templateId: string;
  variantId: string;
  state: SavedExportState;
}

/**
 * PUT the current editor state. `keepalive` lets the request finish even when
 * the page is being unloaded (the accidental-refresh case).
 */
export async function saveExportState(
  payload: SaveExportStatePayload,
  opts?: { keepalive?: boolean }
): Promise<{ state?: SavedExportStateDTO; error?: string }> {
  try {
    const res = await fetch(`${SOCIAL_EXPORT_API_BASE}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: opts?.keepalive ?? false,
    });
    const json = await res.json();
    if (!json.success) {
      return { error: json.error || 'Uložení se nezdařilo' };
    }
    return { state: json.data.state as SavedExportStateDTO };
  } catch {
    return { error: 'Uložení se nezdařilo — síťová chyba' };
  }
}

// ---------------------------------------------------------------------------
// renderVariant: POST /api/social-export/render
// Returns a Blob on success or an error string on failure.
// ---------------------------------------------------------------------------

export async function renderVariant(
  variantId: string,
  inputs: Record<string, RenderInputValue>,
  images?: Record<string, RenderImageValue>
): Promise<{ blob?: Blob; error?: string; errorDetails?: RenderErrorDetails }> {
  try {
    const body =
      images && Object.keys(images).length > 0
        ? { variantId, inputs, images }
        : { variantId, inputs };

    const res = await fetch(`${SOCIAL_EXPORT_API_BASE}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.startsWith('image/')) {
        return { blob: await res.blob() };
      }
    }

    // Non-image response — try to parse JSON error (incl. the structured
    // details a container_overflow 400 carries: code, containerId, overflowPx).
    try {
      const json = await res.json();
      const details =
        json && typeof json.details === 'object' && json.details !== null
          ? (json.details as RenderErrorDetails)
          : undefined;
      return { error: json.error || 'Generování selhalo', errorDetails: details };
    } catch {
      return { error: 'Generování selhalo' };
    }
  } catch {
    return { error: 'Generování selhalo — síťová chyba' };
  }
}

// ---------------------------------------------------------------------------
// Image-slot gallery: list + upload
// ---------------------------------------------------------------------------

/** GET the gallery images an image slot can be filled with. */
export async function fetchSlotImages(
  variantId: string,
  imageInputId: string
): Promise<GalleryImageDTO[]> {
  const qs = new URLSearchParams({ variantId, imageInputId }).toString();
  const res = await fetch(`${SOCIAL_EXPORT_API_BASE}/placeholder-images?${qs}`);
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Nepodařilo se načíst obrázky');
  }
  return json.data.images as GalleryImageDTO[];
}

/** Upload a local file into the slot's gallery and return the created image. */
export async function uploadSlotImage(
  variantId: string,
  imageInputId: string,
  file: File,
  directoryId?: string
): Promise<{ image?: GalleryImageDTO; error?: string }> {
  try {
    const form = new FormData();
    form.append('variantId', variantId);
    form.append('imageInputId', imageInputId);
    form.append('file', file);
    if (directoryId) form.append('directoryId', directoryId);

    const res = await fetch(`${SOCIAL_EXPORT_API_BASE}/placeholder-images`, {
      method: 'POST',
      body: form,
    });
    const json = await res.json();
    if (!json.success) {
      return { error: json.error || 'Nahrání se nezdařilo' };
    }
    return { image: json.data.image as GalleryImageDTO };
  } catch {
    return { error: 'Nahrání se nezdařilo — síťová chyba' };
  }
}

/** Upload a photo from this match's gallery into the slot and return the created image. */
export async function uploadMatchPhoto(
  variantId: string,
  imageInputId: string,
  matchId: string,
  imageId: number,
  directoryId?: string
): Promise<{ image?: GalleryImageDTO; error?: string }> {
  try {
    const res = await fetch(`${SOCIAL_EXPORT_API_BASE}/placeholder-images/from-match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantId, imageInputId, matchId, imageId, directoryId }),
    });
    const json = await res.json();
    if (!json.success) {
      return { error: json.error || 'Nahrání se nezdařilo' };
    }
    return { image: json.data.image as GalleryImageDTO };
  } catch {
    return { error: 'Nahrání se nezdařilo — síťová chyba' };
  }
}

// ---------------------------------------------------------------------------
// downloadBlob: trigger browser download
// ---------------------------------------------------------------------------

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// sanitizeFilename: strip characters unsafe for filenames
// ---------------------------------------------------------------------------

export function sanitizeFilename(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-zA-Z0-9_\-]/g, '-') // replace unsafe chars with dash
    .replace(/-{2,}/g, '-') // collapse multiple dashes
    .replace(/^-|-$/g, '') // trim leading/trailing dashes
    .toLowerCase();
}
