/**
 * Pure helpers for rich-text (WYSIWYG) input values, mirroring the WBoost
 * server semantics (wboost: src/Value/RichText.php + assets/editor/
 * rich_text_runs.js — keep in sync):
 *
 *  - a value is a list of "runs" `{ text, fontFamily|null, color|null,
 *    underline }`; the concatenation of run texts is the plain-text projection
 *    (`maxLength` counts it, in Unicode code points)
 *  - null style = inherit the designed style; run text carries no line breaks
 *  - adjacent equal-styled runs merge, empty runs drop (normalize)
 *
 * Client-safe (pure functions, no server imports).
 */

import type { RichRunDTO, RichTextFontOptionDTO } from './api-types';

/** Code-point length — parity with the server's mb_strlen (NOT UTF-16 .length). */
export function codePointLength(text: string): number {
  return Array.from(text).length;
}

/** The plain-text projection of a runs list. */
export function plainText(runs: RichRunDTO[]): string {
  return runs.map((run) => run.text).join('');
}

/** Whether any run carries styling (unstyled values are sent as plain strings). */
export function isStyled(runs: RichRunDTO[] | null | undefined): runs is RichRunDTO[] {
  return Array.isArray(runs) && runs.some((run) => run.fontFamily !== null || run.color !== null || run.underline);
}

function sameStyle(a: RichRunDTO, b: RichRunDTO): boolean {
  return a.fontFamily === b.fontFamily && a.color === b.color && a.underline === b.underline;
}

/**
 * Coerce + normalize an untrusted runs value (autosave restore, external
 * data): drops non-object runs, flattens line breaks to spaces, nulls
 * malformed styles, merges adjacent equal-styled runs, drops empty ones.
 * Returns null when the input isn't an array at all.
 */
export function normalizeRuns(raw: unknown): RichRunDTO[] | null {
  if (!Array.isArray(raw)) return null;

  const result: RichRunDTO[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.text !== 'string') continue;

    const text = candidate.text.replace(/[\r\n]+/g, ' ');
    if (text === '') continue;

    const run: RichRunDTO = {
      text,
      fontFamily:
        typeof candidate.fontFamily === 'string' && candidate.fontFamily !== ''
          ? candidate.fontFamily
          : null,
      color: typeof candidate.color === 'string' && candidate.color !== '' ? candidate.color : null,
      underline: candidate.underline === true,
    };

    const previous = result[result.length - 1];
    if (previous && sameStyle(previous, run)) {
      previous.text += run.text;
    } else {
      result.push(run);
    }
  }

  return result;
}

/** Cut runs so the plain projection is at most `maxLength` code points. */
export function truncateRuns(runs: RichRunDTO[], maxLength: number): RichRunDTO[] {
  let remaining = Math.max(0, maxLength);
  const result: RichRunDTO[] = [];
  for (const run of runs) {
    if (remaining <= 0) break;
    const length = codePointLength(run.text);
    if (length <= remaining) {
      result.push(run);
      remaining -= length;
    } else {
      result.push({ ...run, text: Array.from(run.text).slice(0, remaining).join('') });
      remaining = 0;
    }
  }
  return result;
}

/** A single unstyled run for a plain string ('' → empty list). */
export function runsFromPlain(value: string): RichRunDTO[] {
  const text = value.replace(/[\r\n]+/g, ' ');
  return text === '' ? [] : [{ text, fontFamily: null, color: null, underline: false }];
}

/** Group font faces by family name for a grouped dropdown. */
export function groupFontsByName(
  fonts: RichTextFontOptionDTO[]
): { name: string; faces: RichTextFontOptionDTO[] }[] {
  const groups = new Map<string, RichTextFontOptionDTO[]>();
  for (const font of fonts) {
    const existing = groups.get(font.fontName);
    if (existing) {
      existing.push(font);
    } else {
      groups.set(font.fontName, [font]);
    }
  }
  return Array.from(groups.entries()).map(([name, faces]) => ({ name, faces }));
}

const isBoldFace = (font: RichTextFontOptionDTO): boolean => font.weight >= 600;
// `style` is FontLib-parsed subfamily metadata — loose strings like
// "Bold Italic" are common, so match by substring, never equality.
const isItalicFace = (font: RichTextFontOptionDTO): boolean => font.style.toLowerCase().includes('italic');

/** Whether a family string resolves to a bold / italic face. */
export function faceMatches(
  fonts: RichTextFontOptionDTO[],
  family: string | null,
  axis: 'bold' | 'italic'
): boolean {
  const option = fonts.find((font) => font.family === family);
  if (!option) return false;
  return axis === 'bold' ? isBoldFace(option) : isItalicFace(option);
}

/**
 * The face `family` should switch to when toggling `axis` on/off (keeping the
 * other axis), or undefined when the family has no candidate face — metadata
 * is best-effort, callers should leave the run unchanged / disable the button.
 */
export function mappedFace(
  fonts: RichTextFontOptionDTO[],
  family: string | null,
  axis: 'bold' | 'italic',
  enable: boolean
): string | undefined {
  const current = fonts.find((font) => font.family === family);
  if (!current) return undefined;

  const wantBold = axis === 'bold' ? enable : isBoldFace(current);
  const wantItalic = axis === 'italic' ? enable : isItalicFace(current);

  const candidates = fonts.filter(
    (font) =>
      font.fontName === current.fontName &&
      isBoldFace(font) === wantBold &&
      isItalicFace(font) === wantItalic
  );
  if (candidates.length === 0) return undefined;

  const targetWeight = wantBold ? 700 : 400;
  return [...candidates].sort(
    (a, b) => Math.abs(a.weight - targetWeight) - Math.abs(b.weight - targetWeight)
  )[0].family;
}
