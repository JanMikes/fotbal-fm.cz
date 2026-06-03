'use client';

/**
 * Hooks and utilities for the social-export feature.
 */

import useSWR from 'swr';
import { SOCIAL_EXPORT_API_BASE, TemplateDTO, RenderInputValue } from '@/lib/social-export/api-types';

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
// renderVariant: POST /api/social-export/render
// Returns a Blob on success or an error string on failure.
// ---------------------------------------------------------------------------

export async function renderVariant(
  variantId: string,
  inputs: Record<string, RenderInputValue>
): Promise<{ blob?: Blob; error?: string }> {
  try {
    const res = await fetch(`${SOCIAL_EXPORT_API_BASE}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantId, inputs }),
    });

    if (res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.startsWith('image/')) {
        return { blob: await res.blob() };
      }
    }

    // Non-image response — try to parse JSON error
    try {
      const json = await res.json();
      return { error: json.error || 'Generování selhalo' };
    } catch {
      return { error: 'Generování selhalo' };
    }
  } catch {
    return { error: 'Generování selhalo — síťová chyba' };
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
