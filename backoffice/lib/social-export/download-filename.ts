/**
 * Download file names of the social-export files (client + server safe).
 *
 * WBoost names every export `<template>[ - <size>][ - <page>][ - <version>].<ext>`
 * with Czech diacritics in the RFC 6266 `filename*` and an ASCII fallback in
 * `filename` (docs/api/consumer-prompt.md, "Download file names"). We keep
 * WBoost's name end to end: parse `filename*` first, forward both forms, and
 * percent-encode the `X-Export-Filename` mirror — a raw UTF-8 header value is
 * not allowed. {@link exportFilename} is only the fallback when WBoost sent
 * no name, built by the same rules.
 */

/** A run of characters no OS accepts in a file name. */
const RESERVED = '[\\/\\\\:*?"<>|]+';

/** `attachment; filename*=utf-8''…` / `filename="…"` / `filename=…` → the name (null when absent). */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;

  const extended = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (extended) {
    try {
      return decodeURIComponent(extended[2].trim());
    } catch {
      // Malformed percent-encoding: fall through to the plain filename.
    }
  }

  const plain = /filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;\s]+))/i.exec(header);
  if (!plain) return null;

  return plain[1] !== undefined ? plain[1].replace(/\\(.)/g, '$1') : plain[2];
}

/** ASCII-only transliteration for the `filename` fallback. */
function asciiFallback(name: string): string {
  const ascii = name
    .replace(/×/g, 'x')
    .replace(/[„“”‚‘«»]/g, '')
    .replace(/’/g, "'")
    .replace(/[–—]/g, '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[%"\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return ascii || 'export';
}

/** RFC 5987 encoding: encodeURIComponent plus the few characters it leaves. */
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** `attachment; filename="<ascii>"; filename*=UTF-8''<utf-8>` — always a Latin-1-safe header value. */
export function contentDisposition(filename: string, type: 'attachment' | 'inline' = 'attachment'): string {
  return `${type}; filename="${asciiFallback(filename)}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
}

export function encodeExportFilenameHeader(filename: string): string {
  return encodeURIComponent(filename);
}

export function decodeExportFilenameHeader(header: string | null): string | null {
  if (!header) return null;
  try {
    return decodeURIComponent(header);
  } catch {
    return header;
  }
}

function sanitizePart(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\t\r\n\u2028\u2029]+/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]+/gu, '')
    .replace(new RegExp(`(?<!\\S)${RESERVED}|${RESERVED}(?!\\S)`, 'g'), '')
    .replace(new RegExp(RESERVED, 'g'), '-')
    .replace(/[\s\p{Z}]+/gu, ' ')
    .replace(/^[\s.-]+|[\s.-]+$/g, '');
}

/**
 * The WBoost naming scheme for a name WBoost did not send: human parts joined
 * by " - " (blank ones skipped), ratio sizes `1:1` → `1x1`, OS-safe, ≤ 120
 * characters.
 */
export function exportFilename(
  parts: ReadonlyArray<string | null | undefined>,
  extension: string,
  fallback = 'export'
): string {
  const base =
    parts
      .filter((part): part is string => typeof part === 'string')
      .map((part) => sanitizePart(part.replace(/^(\d+):(\d+)$/, '$1x$2')))
      .filter((part) => part !== '')
      .join(' - ') || sanitizePart(fallback) || 'export';

  const suffix = `.${extension}`;
  const max = 120 - suffix.length;
  const trimmed = Array.from(base).length > max ? Array.from(base).slice(0, max).join('').replace(/[\s.-]+$/, '') : base;

  return trimmed + suffix;
}
