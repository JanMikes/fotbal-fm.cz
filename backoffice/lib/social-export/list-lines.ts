/**
 * Pure helpers for the per-LINE list structure of a rich value (`lines`, one
 * entry per `\n`-separated line of the plain text — see WBoost
 * assets/editor/rich_text_blocks.js for the render semantics):
 *
 *  - `reconcileLines` keeps the structure in step with a text edit: lines the
 *    edit did not touch keep their type, lines it created (split / insert)
 *    inherit the type of the line they came from, merged lines keep the type
 *    of the first one;
 *  - `insertLineBreak` / `toggleListType` / `toggleCheckbox` are the editor
 *    operations (Enter, the list buttons, the checkbox marker);
 *  - `checklistItems` / `checklistValue` convert between a field state and
 *    the rows of a dedicated checklist component.
 *
 * Offsets are UTF-16 indexes into the plain text (the DOM's unit). Client-safe.
 */

import type { ListLineType } from './api-types';
import type { InputFieldState } from './field-rules';

const LINE_TYPES: readonly ListLineType[] = ['p', 'ul', 'ol', 'cb', 'cbx'];

export function isListLine(type: ListLineType): boolean {
  return type !== 'p';
}

export function isCheckboxLine(type: ListLineType): boolean {
  return type === 'cb' || type === 'cbx';
}

/** Number of `\n`-separated lines of a plain text ('' is one empty line). */
export function lineCount(value: string): number {
  return value.split('\n').length;
}

/** Index of the line containing `offset`. */
export function lineIndexAt(value: string, offset: number): number {
  let index = 0;
  const end = Math.min(Math.max(0, offset), value.length);
  for (let i = 0; i < end; i += 1) {
    if (value.charCodeAt(i) === 10) index += 1;
  }
  return index;
}

/** Offset of the first character of line `index`. */
export function lineStartOffset(value: string, index: number): number {
  let offset = 0;
  for (let i = 0; i < index; i += 1) {
    const next = value.indexOf('\n', offset);
    if (next === -1) return value.length;
    offset = next + 1;
  }
  return offset;
}

/**
 * Coerce `lines` to exactly one valid entry per line of `value` (unknown
 * entries → 'p', missing → 'p', extra dropped).
 */
export function fitLines(value: string, lines: readonly unknown[] | null | undefined): ListLineType[] {
  const count = lineCount(value);
  const result: ListLineType[] = [];
  for (let i = 0; i < count; i += 1) {
    const candidate = lines?.[i];
    result.push(LINE_TYPES.includes(candidate as ListLineType) ? (candidate as ListLineType) : 'p');
  }
  return result;
}

/** The structure to STORE: null when no line is a list line. */
export function normalizeLines(lines: readonly ListLineType[] | null | undefined): ListLineType[] | null {
  if (!lines || !lines.some(isListLine)) return null;
  return [...lines];
}

/**
 * Line types after `oldValue` became `newValue`. The edit region is found by
 * common prefix/suffix; `caret` (the caret offset in `newValue` right after
 * the edit) disambiguates repeated characters — e.g. Enter at the end of
 * "a" in "a\nb" must split line 0, not line 1. Every new line inside the
 * edited region takes the type of the old line where the edit started (a
 * split continues the list; a merge keeps the first line's type).
 */
export function reconcileLines(
  oldValue: string,
  oldLines: readonly ListLineType[],
  newValue: string,
  caret?: number
): ListLineType[] {
  const previous = fitLines(oldValue, oldLines);
  if (oldValue === newValue) return previous;

  const maxPrefix = Math.min(oldValue.length, newValue.length);
  let prefix = 0;
  while (prefix < maxPrefix && oldValue[prefix] === newValue[prefix]) prefix += 1;
  if (caret !== undefined && newValue.length >= oldValue.length) {
    // An insertion ends at the caret, so it cannot start after caret − inserted.
    prefix = Math.min(prefix, Math.max(0, caret - (newValue.length - oldValue.length)));
  } else if (caret !== undefined) {
    prefix = Math.min(prefix, Math.max(0, caret));
  }

  let suffix = 0;
  const maxSuffix = Math.min(oldValue.length - prefix, newValue.length - prefix);
  while (
    suffix < maxSuffix &&
    oldValue[oldValue.length - 1 - suffix] === newValue[newValue.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const startLine = lineIndexAt(oldValue, prefix);
  const oldEndLine = lineIndexAt(oldValue, oldValue.length - suffix);
  const newEndLine = lineIndexAt(newValue, newValue.length - suffix);
  const regionType = previous[startLine] ?? 'p';

  const result: ListLineType[] = previous.slice(0, startLine);
  for (let i = startLine; i <= newEndLine; i += 1) result.push(regionType);
  result.push(...previous.slice(oldEndLine + 1));
  return fitLines(newValue, result);
}

/**
 * Enter at the selection [start, end]. On a collapsed caret inside an EMPTY
 * list item the item turns back into a paragraph (`exitList`, text
 * unchanged); otherwise a `\n` replaces the selection and the new line
 * continues the type of the line it was split from.
 */
export function insertLineBreak(
  value: string,
  lines: readonly ListLineType[],
  start: number,
  end: number
):
  | { kind: 'exitList'; lines: ListLineType[] }
  | { kind: 'break'; value: string; lines: ListLineType[]; caret: number } {
  const fitted = fitLines(value, lines);
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const lineIndex = lineIndexAt(value, from);
  if (from === to && isListLine(fitted[lineIndex]) && lineText(value, lineIndex) === '') {
    const next = [...fitted];
    next[lineIndex] = 'p';
    return { kind: 'exitList', lines: next };
  }
  const nextValue = value.slice(0, from) + '\n' + value.slice(to);
  return {
    kind: 'break',
    value: nextValue,
    lines: reconcileLines(value, fitted, nextValue, from + 1),
    caret: from + 1,
  };
}

/** Text of line `index` (without its `\n`). */
export function lineText(value: string, index: number): string {
  return value.split('\n')[index] ?? '';
}

/**
 * Lines covered by the selection [start, end]: from the caret's line to the
 * end's line — a non-empty selection ending exactly at a line start does not
 * include that line.
 */
export function selectedLineRange(value: string, start: number, end: number): [number, number] {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const first = lineIndexAt(value, from);
  let last = lineIndexAt(value, to);
  if (to > from && last > first && value[to - 1] === '\n') last -= 1;
  return [first, last];
}

/**
 * The list buttons: set lines [first, last] to `type` ('cb' = checkbox item;
 * already checked items stay checked), or back to 'p' when every one of
 * them already is of that type (toggle off).
 */
export function toggleListType(
  lines: readonly ListLineType[],
  first: number,
  last: number,
  type: 'ul' | 'ol' | 'cb'
): ListLineType[] {
  const result = [...lines];
  const matches = (line: ListLineType) => (type === 'cb' ? isCheckboxLine(line) : line === type);
  const covered = result.slice(first, last + 1);
  const allOn = covered.length > 0 && covered.every(matches);
  for (let i = first; i <= last && i < result.length; i += 1) {
    if (allOn) result[i] = 'p';
    else if (!(type === 'cb' && isCheckboxLine(result[i]))) result[i] = type;
  }
  return result;
}

/** Flip a checkbox item between unchecked ('cb') and checked ('cbx'); other lines untouched. */
export function toggleCheckbox(lines: readonly ListLineType[], index: number): ListLineType[] {
  const result = [...lines];
  if (result[index] === 'cb') result[index] = 'cbx';
  else if (result[index] === 'cbx') result[index] = 'cb';
  return result;
}

/** Ordinal of an 'ol' item within its run of consecutive 'ol' lines (1-based). */
export function ordinalAt(lines: readonly ListLineType[], index: number): number {
  let ordinal = 1;
  for (let i = index - 1; i >= 0 && lines[i] === 'ol'; i -= 1) ordinal += 1;
  return ordinal;
}

// ---------------------------------------------------------------------------
// Checklist components (input.checklist non-null)
// ---------------------------------------------------------------------------

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

/**
 * The rows of a checklist field: one per `\n`-separated line, checked when
 * its line is 'cbx'. An empty value without list lines is an empty
 * checklist (no rows).
 */
export function checklistItems(state: Pick<InputFieldState, 'value' | 'lines'>): ChecklistItem[] {
  const value = state.value ?? '';
  const hasLines = Array.isArray(state.lines) && state.lines.length === lineCount(value);
  if (value === '' && !(hasLines && state.lines!.some(isListLine))) return [];
  const lines = hasLines ? state.lines! : null;
  return value.split('\n').map((text, i) => ({ text, checked: lines?.[i] === 'cbx' }));
}

/**
 * The field partial for a list of checklist rows: unstyled (`runs: null`),
 * every line a checkbox item. Item text never carries line breaks. No rows →
 * an empty value with no structure.
 */
export function checklistValue(items: readonly ChecklistItem[]): Pick<InputFieldState, 'value' | 'runs' | 'lines'> {
  if (items.length === 0) return { value: '', runs: null, lines: null };
  return {
    value: items.map((item) => item.text.replace(/[\r\n]+/g, ' ')).join('\n'),
    runs: null,
    lines: items.map((item) => (item.checked ? 'cbx' : 'cb')),
  };
}
