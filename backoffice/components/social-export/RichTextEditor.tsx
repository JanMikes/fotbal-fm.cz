'use client';

/**
 * Simple WYSIWYG for one rich-text placeholder (`input.richText === true`).
 *
 * Hand-rolled contenteditable whose source of truth is the "runs" model shared
 * with the WBoost API (see lib/social-export/rich-text.ts): font FACE switch
 * (bold/italic are standalone face families — the B/I buttons swap
 * `fontFamily` via the face metadata), brand color swatches + free picker,
 * underline. Toolbar actions apply to the SELECTION when one exists and to
 * the WHOLE text when the caret is collapsed (micro-texts make a collapsed
 * caret no-op confusing). An input with a single face offers no face menu
 * and no B/I.
 *
 * Line breaks: every `\n`-separated line is its own `div[data-rt-line]`
 * block. Enter inserts a `\n`; inputs with `lists` additionally carry a
 * per-line type (`lines`, see lib/social-export/list-lines.ts) edited via the
 * bullet / numbered / checkbox buttons and shown as a marker in the line's
 * hanging indent (a checkbox marker is clickable: it flips cb ↔ cbx).
 *
 * Reliability guards mirrored from the wboost fill-page editor: IME
 * composition (no DOM rebuild mid-composition), paste forced to plain text,
 * runs snapshot undo (Cmd/Ctrl+Z — programmatic re-renders kill native undo),
 * maxLength enforced on the plain projection in code points. Every edit that
 * crosses a line boundary (Enter, Backspace at a line start, Delete at a line
 * end, typing over a multi-line selection) is applied to the model and
 * re-rendered — native editing only ever happens INSIDE one line block.
 *
 * The DOM is only rebuilt on toolbar actions / structural edits / paste /
 * undo / external value replacement — never on plain typing (that would
 * break the caret and IME).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, List, ListChecks, ListOrdered, Palette } from 'lucide-react';
import type {
  ListLineType,
  RichRunDTO,
  RichTextOptionsDTO,
  TemplateInputDTO,
} from '@/lib/social-export/api-types';
import type { InputFieldState } from '@/lib/social-export/field-rules';
import {
  fitLines,
  isCheckboxLine,
  lineIndexAt,
  lineStartOffset,
  normalizeLines,
  ordinalAt,
  reconcileLines,
  insertLineBreak,
  selectedLineRange,
  toggleCheckbox,
  toggleListType,
} from '@/lib/social-export/list-lines';
import {
  canonicalNewlines,
  codePointLength,
  faceMatches,
  groupFontsByName,
  isStyled,
  mappedFace,
  normalizeRuns,
  plainText,
  runsFromPlain,
  truncateRuns,
} from '@/lib/social-export/rich-text';

interface RichTextEditorProps {
  input: TemplateInputDTO;
  options: RichTextOptionsDTO;
  state: InputFieldState;
  disabled?: boolean;
  autoFocus?: boolean;
  onChange: (partial: Partial<InputFieldState>) => void;
}

interface Range2 {
  start: number;
  end: number;
  hadSelection: boolean;
}

interface Snapshot {
  runs: RichRunDTO[];
  lines: ListLineType[];
}

const BULLET_CHARS: Record<string, string> = { disc: '•', dash: '–', check: '✓' };
const PLACEHOLDER = 'Zadejte text…';

function stateRuns(state: InputFieldState): RichRunDTO[] {
  if (isStyled(state.runs) && plainText(state.runs) === state.value) return state.runs;
  return runsFromPlain(state.value);
}

function stateLines(input: TemplateInputDTO, state: InputFieldState): ListLineType[] {
  return fitLines(state.value, input.lists ? state.lines : null);
}

function runsEqual(a: RichRunDTO[], b: RichRunDTO[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function linesEqual(a: ListLineType[], b: ListLineType[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

/** Split runs into per-line runs (the `\n` separators dropped). */
function splitRunsByLine(runs: RichRunDTO[]): RichRunDTO[][] {
  const lines: RichRunDTO[][] = [[]];
  for (const run of runs) {
    run.text.split('\n').forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part !== '') lines[lines.length - 1].push({ ...run, text: part });
    });
  }
  return lines;
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'UL', 'OL']);

export default function RichTextEditor({
  input,
  options,
  state,
  disabled = false,
  autoFocus = false,
  onChange,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const runsRef = useRef<RichRunDTO[]>(stateRuns(state));
  const linesRef = useRef<ListLineType[]>(stateLines(input, state));
  const lastSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const composingRef = useRef(false);
  const undoRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const lastTypingPushRef = useRef(0);

  // Toolbar reflection of the current selection.
  const [activeFamily, setActiveFamily] = useState<string | ''>('');
  const [activeBold, setActiveBold] = useState(false);
  const [activeItalic, setActiveItalic] = useState(false);
  const [activeUnderline, setActiveUnderline] = useState(false);
  const [activeList, setActiveList] = useState<'ul' | 'ol' | 'cb' | null>(null);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [plainLength, setPlainLength] = useState(() => codePointLength(state.value));

  const fontGroups = useMemo(() => groupFontsByName(options.fonts), [options.fonts]);
  const designFamily = input.textStyle?.fontFamily ?? null;
  // A single offered face leaves nothing to switch: no face menu, no B/I.
  const singleFace = input.fontOptions != null && input.fontOptions.length === 1;
  // Colour allowlist: null = brand swatches + free picker, [] = colour locked
  // (no colour UI at all), a list = only those swatches.
  const colorLocked = input.colorOptions !== null && input.colorOptions.length === 0;
  const swatches = input.colorOptions ?? options.colors;
  const freeColor = input.colorOptions === null;
  const bulletChar = BULLET_CHARS[input.listStyle?.bullet ?? 'disc'] ?? BULLET_CHARS.disc;

  // ------------------------------------------------------------------ DOM <-> runs

  const markerFor = useCallback(
    (lines: ListLineType[], index: number): string => {
      switch (lines[index]) {
        case 'ul':
          return bulletChar;
        case 'ol':
          return `${ordinalAt(lines, index)}.`;
        case 'cb':
          return '☐';
        case 'cbx':
          return '☑';
        default:
          return '';
      }
    },
    [bulletChar]
  );

  /** Show the placeholder on the (single, empty) first line only. */
  const syncPlaceholder = useCallback((empty: boolean) => {
    const editor = editorRef.current;
    if (!editor) return;
    Array.from(editor.children).forEach((child, index) => {
      const line = child as HTMLElement;
      if (empty && index === 0) line.dataset.placeholder = PLACEHOLDER;
      else delete line.dataset.placeholder;
    });
  }, []);

  const renderDom = useCallback(
    (runs: RichRunDTO[], lines: ListLineType[]) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.textContent = '';
      splitRunsByLine(runs).forEach((lineRuns, index) => {
        const line = document.createElement('div');
        const type = lines[index] ?? 'p';
        line.dataset.rtLine = type;
        if (type !== 'p') line.dataset.marker = markerFor(lines, index);
        for (const run of lineRuns) {
          const span = document.createElement('span');
          span.dataset.rtRun = '1';
          if (run.fontFamily) {
            span.dataset.font = run.fontFamily;
            span.style.fontFamily = `"${run.fontFamily}"`;
          }
          if (run.color) {
            span.dataset.color = run.color;
            span.style.color = run.color;
          }
          if (run.underline) {
            span.dataset.underline = '1';
            span.style.textDecoration = 'underline';
          }
          span.textContent = run.text;
          line.appendChild(span);
        }
        // An empty block needs a <br> to keep its height and host the caret.
        if (lineRuns.length === 0) line.appendChild(document.createElement('br'));
        editor.appendChild(line);
      });
      syncPlaceholder(runs.length === 0 && lines.length === 1);
    },
    [markerFor, syncPlaceholder]
  );

  /**
   * Whitelist parser: only our span[data-rt-run] carry style; every line
   * block (and any block / non-trailing <br> a browser slipped in) is a
   * `\n`. `structured` is false when the DOM is no longer exactly one
   * div[data-rt-line] per line — the caller then re-renders it.
   */
  const parseDom = useCallback((): { runs: RichRunDTO[]; structured: boolean } => {
    const editor = editorRef.current;
    if (!editor) return { runs: [], structured: true };
    const lines: RichRunDTO[][] = [];
    let structured = true;
    const newLine = () => lines.push([]);
    const walk = (node: Node, inherited: Omit<RichRunDTO, 'text'>) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (lines.length === 0) newLine();
        lines[lines.length - 1].push({ ...inherited, text: (node as Text).data });
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as HTMLElement;
      if (element.tagName === 'BR') {
        const trailing = element.nextSibling === null && element.parentElement !== editor;
        if (!trailing) {
          structured = false;
          newLine();
        }
        return;
      }
      if (BLOCK_TAGS.has(element.tagName)) {
        structured = false;
        newLine();
      }
      const style =
        element.dataset && element.dataset.rtRun !== undefined
          ? {
              fontFamily: element.dataset.font || null,
              color: element.dataset.color || null,
              underline: element.dataset.underline === '1',
            }
          : inherited;
      element.childNodes.forEach((child) => walk(child, style));
    };
    const base = { fontFamily: null, color: null, underline: false };
    editor.childNodes.forEach((node) => {
      const element = node as HTMLElement;
      if (node.nodeType === Node.ELEMENT_NODE && element.dataset.rtLine !== undefined) {
        newLine();
        element.childNodes.forEach((child) => walk(child, base));
      } else {
        structured = false;
        walk(node, base);
      }
    });
    if (lines.length === 0) {
      structured = false;
      newLine();
    }

    // Re-join with `\n` separators styled like the preceding run so they
    // merge away in normalization.
    const raw: RichRunDTO[] = [];
    lines.forEach((lineRuns, index) => {
      if (index > 0) {
        const previous = raw[raw.length - 1];
        raw.push({
          text: '\n',
          fontFamily: previous?.fontFamily ?? null,
          color: previous?.color ?? null,
          underline: previous?.underline ?? false,
        });
      }
      raw.push(...lineRuns);
    });
    return { runs: normalizeRuns(raw) ?? [], structured };
  }, []);

  // ------------------------------------------------------------------ selection

  /** Plain-text offset of a DOM position (each line block ends with a `\n`). */
  const offsetAt = useCallback((container: Node, offset: number): number => {
    const editor = editorRef.current;
    if (!editor) return 0;
    const children = Array.from(editor.childNodes);
    const lengthOf = (node: Node) => (node.textContent ?? '').length;
    if (container === editor) {
      let sum = 0;
      for (let i = 0; i < Math.min(offset, children.length); i += 1) {
        sum += lengthOf(children[i]) + 1;
      }
      return Math.max(0, Math.min(sum, plainText(runsRef.current).length));
    }
    let base = 0;
    for (const child of children) {
      if (child === container || child.contains(container)) {
        const range = document.createRange();
        range.setStart(child, 0);
        range.setEnd(container, offset);
        return base + range.toString().length;
      }
      base += lengthOf(child) + 1;
    }
    return Math.max(0, base - 1);
  }, []);

  const selectionOffsets = useCallback((): { start: number; end: number } | null => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) {
      return null;
    }
    return {
      start: offsetAt(range.startContainer, range.startOffset),
      end: offsetAt(range.endContainer, range.endOffset),
    };
  }, [offsetAt]);

  const effectiveRange = useCallback((): Range2 | null => {
    const total = plainText(runsRef.current).length;
    if (total === 0) return null;
    const offsets = selectionOffsets();
    if (!offsets || offsets.start === offsets.end) {
      return { start: 0, end: total, hadSelection: false };
    }
    return {
      start: Math.min(offsets.start, offsets.end),
      end: Math.max(offsets.start, offsets.end),
      hadSelection: true,
    };
  }, [selectionOffsets]);

  const restoreSelection = useCallback((start: number, end: number) => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection) return;
    const positionAt = (target: number): { node: Node; offset: number } => {
      const lines = Array.from(editor.childNodes);
      let base = 0;
      for (const line of lines) {
        const length = (line.textContent ?? '').length;
        if (target <= base + length) {
          const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
          let remaining = target - base;
          let node: Node | null;
          let last: Text | null = null;
          while ((node = walker.nextNode())) {
            last = node as Text;
            if (remaining <= last.data.length) return { node: last, offset: remaining };
            remaining -= last.data.length;
          }
          return last ? { node: last, offset: last.data.length } : { node: line, offset: 0 };
        }
        base += length + 1;
      }
      return { node: editor, offset: editor.childNodes.length };
    };
    const domRange = document.createRange();
    const startPos = positionAt(start);
    const endPos = positionAt(end);
    domRange.setStart(startPos.node, startPos.offset);
    domRange.setEnd(endPos.node, endPos.offset);
    selection.removeAllRanges();
    selection.addRange(domRange);
    editor.focus();
  }, []);

  // ------------------------------------------------------------------ runs surgery

  const sliceRuns = useCallback((start: number, end: number): RichRunDTO[] => {
    const result: RichRunDTO[] = [];
    let offset = 0;
    for (const run of runsRef.current) {
      const runStart = offset;
      const runEnd = offset + run.text.length;
      offset = runEnd;
      if (runEnd <= start || runStart >= end) continue;
      result.push({
        ...run,
        text: run.text.slice(Math.max(0, start - runStart), Math.min(run.text.length, end - runStart)),
      });
    }
    return result;
  }, []);

  const snapshot = useCallback(
    (): string => JSON.stringify({ runs: runsRef.current, lines: linesRef.current } satisfies Snapshot),
    []
  );

  const pushUndo = useCallback(
    (coalesce = false) => {
      const current = snapshot();
      const stack = undoRef.current;
      if (stack[stack.length - 1] === current) return;
      if (coalesce && Date.now() - lastTypingPushRef.current < 700) return;
      if (coalesce) lastTypingPushRef.current = Date.now();
      stack.push(current);
      if (stack.length > 50) stack.shift();
      redoRef.current = [];
    },
    [snapshot]
  );

  const emit = useCallback(
    (runs: RichRunDTO[], lines: ListLineType[]) => {
      runsRef.current = runs;
      linesRef.current = lines;
      const plain = plainText(runs);
      setPlainLength(codePointLength(plain));
      onChange({
        value: plain,
        runs: isStyled(runs) ? runs : null,
        // Only list inputs carry structure (the API 400s it elsewhere).
        ...(input.lists ? { lines: normalizeLines(lines) } : {}),
      });
    },
    [input.lists, onChange]
  );

  const updateToolbarState = useCallback(() => {
    const range = effectiveRange();
    const runs = range ? sliceRuns(range.start, range.end) : [];
    const effectiveFamilyOf = (run: RichRunDTO) => run.fontFamily ?? designFamily;
    setActiveBold(
      runs.length > 0 && runs.every((run) => faceMatches(options.fonts, effectiveFamilyOf(run), 'bold'))
    );
    setActiveItalic(
      runs.length > 0 && runs.every((run) => faceMatches(options.fonts, effectiveFamilyOf(run), 'italic'))
    );
    setActiveUnderline(runs.length > 0 && runs.every((run) => run.underline));
    const families = new Set(runs.map((run) => run.fontFamily ?? ''));
    setActiveFamily(families.size === 1 ? [...families][0] : '');

    if (input.lists) {
      const value = plainText(runsRef.current);
      const offsets = selectionOffsets() ?? lastSelectionRef.current;
      const [first, last] = offsets
        ? selectedLineRange(value, offsets.start, offsets.end)
        : [0, linesRef.current.length - 1];
      const covered = linesRef.current.slice(first, last + 1).map((line) => (line === 'cbx' ? 'cb' : line));
      const uniform = covered.length > 0 && covered.every((line) => line === covered[0]) ? covered[0] : null;
      setActiveList(uniform === 'ul' || uniform === 'ol' || uniform === 'cb' ? uniform : null);
    }
  }, [designFamily, effectiveRange, input.lists, options.fonts, selectionOffsets, sliceRuns]);

  /** Re-render + emit a new model state, keeping the given selection. */
  const commitModel = useCallback(
    (runs: RichRunDTO[], lines: ListLineType[], selection: { start: number; end: number }) => {
      renderDom(runs, lines);
      emit(runs, lines);
      restoreSelection(selection.start, selection.end);
      updateToolbarState();
    },
    [emit, renderDom, restoreSelection, updateToolbarState]
  );

  /**
   * Replace [start, end) of the plain text with `text` (new text takes the
   * style of the run before it), cap at maxLength, reconcile the line types
   * and re-render with the caret after the insertion.
   */
  const applyEdit = useCallback(
    (start: number, end: number, text: string) => {
      pushUndo();
      const plain = plainText(runsRef.current);
      const before = sliceRuns(0, start);
      const after = sliceRuns(end, plain.length);
      const styleSource = before[before.length - 1] ?? after[0] ?? null;
      let runs =
        normalizeRuns([
          ...before,
          {
            text,
            fontFamily: styleSource?.fontFamily ?? null,
            color: styleSource?.color ?? null,
            underline: styleSource?.underline ?? false,
          },
          ...after,
        ]) ?? [];
      if (input.maxLength != null) runs = truncateRuns(runs, input.maxLength);
      const next = plainText(runs);
      const caret = Math.min(start + text.length, next.length);
      const lines = reconcileLines(plain, linesRef.current, next, caret);
      commitModel(runs, lines, { start: caret, end: caret });
    },
    [commitModel, input.maxLength, pushUndo, sliceRuns]
  );

  const setLines = useCallback(
    (lines: ListLineType[], selection: { start: number; end: number }) => {
      pushUndo();
      commitModel(runsRef.current, lines, selection);
    },
    [commitModel, pushUndo]
  );

  const applyStyle = useCallback(
    (patch: (run: RichRunDTO) => RichRunDTO) => {
      const range = effectiveRange();
      if (!range) return;
      pushUndo();
      const plain = plainText(runsRef.current);
      const runs = normalizeRuns([
        ...sliceRuns(0, range.start),
        ...sliceRuns(range.start, range.end).map(patch),
        ...sliceRuns(range.end, plain.length),
      ]) ?? [];
      commitModel(runs, linesRef.current, {
        start: range.hadSelection ? range.start : plain.length,
        end: range.hadSelection ? range.end : plain.length,
      });
    },
    [commitModel, effectiveRange, pushUndo, sliceRuns]
  );

  const toggleFace = useCallback(
    (axis: 'bold' | 'italic') => {
      const range = effectiveRange();
      if (!range) return;
      const runs = sliceRuns(range.start, range.end);
      const shouldEnable = !runs.every((run) =>
        faceMatches(options.fonts, run.fontFamily ?? designFamily, axis)
      );
      applyStyle((run) => {
        const target = mappedFace(options.fonts, run.fontFamily ?? designFamily, axis, shouldEnable);
        return target === undefined ? run : { ...run, fontFamily: target };
      });
    },
    [applyStyle, designFamily, effectiveRange, options.fonts, sliceRuns]
  );

  const toggleUnderline = useCallback(() => {
    const range = effectiveRange();
    if (!range) return;
    const allUnderlined = sliceRuns(range.start, range.end).every((run) => run.underline);
    applyStyle((run) => ({ ...run, underline: !allUnderlined }));
  }, [applyStyle, effectiveRange, sliceRuns]);

  const clearFormatting = useCallback(() => {
    pushUndo();
    const runs = runsFromPlain(plainText(runsRef.current));
    renderDom(runs, linesRef.current);
    emit(runs, linesRef.current);
    updateToolbarState();
  }, [emit, pushUndo, renderDom, updateToolbarState]);

  /** The list buttons: toggle the selected lines (caret → its line). */
  const toggleList = useCallback(
    (type: 'ul' | 'ol' | 'cb') => {
      const value = plainText(runsRef.current);
      const offsets = selectionOffsets() ??
        lastSelectionRef.current ?? { start: 0, end: value.length };
      const [first, last] = selectedLineRange(value, offsets.start, offsets.end);
      setLines(toggleListType(linesRef.current, first, last, type), offsets);
    },
    [selectionOffsets, setLines]
  );

  const restoreSnapshot = useCallback(
    (raw: string) => {
      const parsed = JSON.parse(raw) as Partial<Snapshot>;
      const runs = normalizeRuns(parsed.runs) ?? [];
      const lines = fitLines(plainText(runs), parsed.lines ?? null);
      renderDom(runs, lines);
      emit(runs, lines);
    },
    [emit, renderDom]
  );

  const undo = useCallback(() => {
    const previous = undoRef.current.pop();
    if (previous === undefined) return;
    redoRef.current.push(snapshot());
    restoreSnapshot(previous);
  }, [restoreSnapshot, snapshot]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (next === undefined) return;
    undoRef.current.push(snapshot());
    restoreSnapshot(next);
  }, [restoreSnapshot, snapshot]);

  // ------------------------------------------------------------------ editor events

  const commitDomState = useCallback(() => {
    const parsed = parseDom();
    let runs = parsed.runs;
    let truncated = false;
    if (input.maxLength != null && codePointLength(plainText(runs)) > input.maxLength) {
      runs = truncateRuns(runs, input.maxLength);
      truncated = true;
    }
    const previousValue = plainText(runsRef.current);
    const nextValue = plainText(runs);
    const caret = Math.min(selectionOffsets()?.end ?? nextValue.length, nextValue.length);
    const lines = reconcileLines(previousValue, linesRef.current, nextValue, caret);
    if (!runsEqual(runs, runsRef.current)) {
      pushUndo(true);
    }
    if (truncated || !parsed.structured || editorRef.current?.childNodes.length !== lines.length) {
      renderDom(runs, lines);
      restoreSelection(caret, caret);
    } else {
      syncPlaceholder(nextValue === '' && lines.length === 1);
    }
    emit(runs, lines);
  }, [emit, input.maxLength, parseDom, pushUndo, renderDom, restoreSelection, selectionOffsets, syncPlaceholder]);

  /** Enter: exit an empty list item, else split the line (lists continue). */
  const insertBreak = useCallback(() => {
    const value = plainText(runsRef.current);
    const offsets = selectionOffsets() ?? { start: value.length, end: value.length };
    const start = Math.min(offsets.start, offsets.end);
    const end = Math.max(offsets.start, offsets.end);
    const result = insertLineBreak(value, linesRef.current, start, end);
    if (result.kind === 'exitList') {
      setLines(result.lines, { start, end });
      return;
    }
    if (input.maxLength != null && codePointLength(value) - codePointLength(value.slice(start, end)) + 1 > input.maxLength) {
      return;
    }
    applyEdit(start, end, '\n');
  }, [applyEdit, input.maxLength, selectionOffsets, setLines]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        // An IME uses Enter to commit its composition — leave it alone.
        if (event.nativeEvent.isComposing || composingRef.current) return;
        event.preventDefault();
        insertBreak();
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === 'b' && !singleFace) {
        event.preventDefault();
        toggleFace('bold');
      } else if (key === 'i' && !singleFace) {
        event.preventDefault();
        toggleFace('italic');
      } else if (key === 'u') {
        event.preventDefault();
        toggleUnderline();
      }
    },
    [insertBreak, redo, singleFace, toggleFace, toggleUnderline, undo]
  );

  const handleBeforeInput = useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      const native = event.nativeEvent as InputEvent;
      const inputType = native.inputType ?? '';
      // Composition input is not cancelable — the IME owns it until it ends.
      if (inputType === 'insertCompositionText' || composingRef.current) return;
      const offsets = selectionOffsets();
      if (!offsets) return;
      const start = Math.min(offsets.start, offsets.end);
      const end = Math.max(offsets.start, offsets.end);
      const value = plainText(runsRef.current);
      const spansBreak = value.slice(start, end).includes('\n');

      // Mobile keyboards send Enter as beforeinput only.
      if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') {
        event.preventDefault();
        insertBreak();
        return;
      }

      if (inputType.startsWith('delete')) {
        if (start !== end) {
          if (spansBreak) {
            event.preventDefault();
            applyEdit(start, end, '');
          }
          return;
        }
        if (inputType.includes('Backward')) {
          const lineIndex = lineIndexAt(value, start);
          if (start !== lineStartOffset(value, lineIndex)) return;
          event.preventDefault();
          if (input.lists && linesRef.current[lineIndex] !== 'p') {
            // Backspace at an item start first turns it back into text.
            const lines = [...linesRef.current];
            lines[lineIndex] = 'p';
            setLines(lines, { start, end });
          } else if (start > 0) {
            applyEdit(start - 1, start, '');
          }
          return;
        }
        if (value[start] === '\n') {
          event.preventDefault();
          applyEdit(start, start + 1, '');
        } else if (start === value.length) {
          event.preventDefault();
        }
        return;
      }

      if (!inputType.startsWith('insert')) return;
      const data =
        typeof native.data === 'string'
          ? native.data
          : (native.dataTransfer?.getData('text/plain') ?? '');
      if (input.maxLength != null && data.length > 0) {
        const selectionLength = end - start;
        if (plainLength - selectionLength + codePointLength(data) > input.maxLength) {
          event.preventDefault();
          return;
        }
      }
      if (spansBreak) {
        event.preventDefault();
        applyEdit(start, end, canonicalNewlines(data));
      }
    },
    [applyEdit, input.lists, input.maxLength, insertBreak, plainLength, selectionOffsets, setLines]
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      event.preventDefault();
      const text = canonicalNewlines(event.clipboardData.getData('text/plain'));
      if (!text) return;
      const length = plainText(runsRef.current).length;
      const offsets = selectionOffsets() ?? { start: length, end: length };
      applyEdit(Math.min(offsets.start, offsets.end), Math.max(offsets.start, offsets.end), text);
    },
    [applyEdit, selectionOffsets]
  );

  /** A click on a checkbox marker (the line's hanging indent) flips it. */
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const editor = editorRef.current;
      if (disabled || !editor || !input.lists) return;
      const line = (event.target as HTMLElement).closest<HTMLElement>('[data-rt-line]');
      if (!line || line.parentElement !== editor) return;
      const index = Array.from(editor.children).indexOf(line);
      if (!isCheckboxLine(linesRef.current[index])) return;
      const indent = parseFloat(getComputedStyle(line).paddingLeft) || 0;
      if (event.clientX - line.getBoundingClientRect().left > indent) return;
      event.preventDefault();
      const value = plainText(runsRef.current);
      const offsets = selectionOffsets() ?? { start: value.length, end: value.length };
      setLines(toggleCheckbox(linesRef.current, index), offsets);
    },
    [disabled, input.lists, selectionOffsets, setLines]
  );

  // ------------------------------------------------------------------ lifecycle

  // Initial render + external value replacement (chips insert, saved-state
  // restore): resync the DOM when the parent state no longer matches ours.
  useEffect(() => {
    const external = stateRuns(state);
    const externalLines = stateLines(input, state);
    if (!runsEqual(external, runsRef.current) || !linesEqual(externalLines, linesRef.current)) {
      runsRef.current = external;
      linesRef.current = externalLines;
      setPlainLength(codePointLength(state.value));
      renderDom(external, externalLines);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.value, state.runs, state.lines]);

  useEffect(() => {
    renderDom(runsRef.current, linesRef.current);
    if (autoFocus) editorRef.current?.focus();
    const onSelectionChange = () => {
      const offsets = selectionOffsets();
      if (offsets) lastSelectionRef.current = offsets;
      if (offsets || document.activeElement === editorRef.current) updateToolbarState();
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ UI

  const activeFaceLabel =
    options.fonts.find((font) => font.family === activeFamily)?.faceName ?? 'Výchozí písmo';

  const buttonBase =
    'rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-surface-hover';
  const buttonActive = 'bg-surface-hover font-semibold text-accent border-accent';

  return (
    <div>
      {/* @font-face for the pickable faces — served through the same-origin
          font proxy (fonts hard-require CORS, unlike images) — plus the line
          block styling: list markers live in the hanging indent (::before),
          the placeholder on an empty first line (::after). */}
      <style>
        {[
          ...options.fonts.map(
            (font) =>
              `@font-face { font-family: "${font.family}"; src: url("${font.url}"); font-display: swap; }`
          ),
          '[data-rt-editor] > [data-rt-line] { position: relative; min-height: 1.25em; }',
          '[data-rt-editor] > [data-rt-line]:not([data-rt-line="p"]) { padding-left: 1.6em; }',
          '[data-rt-editor] > [data-rt-line]:not([data-rt-line="p"])::before { content: attr(data-marker); position: absolute; left: 0; width: 1.4em; color: var(--color-text-muted); text-transform: none; }',
          '[data-rt-editor] > [data-rt-line="cb"]::before, [data-rt-editor] > [data-rt-line="cbx"]::before { cursor: pointer; color: inherit; }',
          '[data-rt-editor] > [data-placeholder]::after { content: attr(data-placeholder); position: absolute; top: 0; pointer-events: none; color: var(--color-text-muted); text-transform: none; }',
          '[data-rt-editor] > [data-rt-line="p"][data-placeholder]::after { left: 0; }',
          '[data-rt-editor] > [data-rt-line]:not([data-rt-line="p"])[data-placeholder]::after { left: 1.6em; }',
        ].join('\n')}
      </style>

      {/* Toolbar */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        {/* Face dropdown (custom listbox so options render in their face) —
            pointless with a single offered face. */}
        {!singleFace && (
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            className={`${buttonBase} max-w-[11rem] truncate`}
            onClick={() => setFontMenuOpen((open) => !open)}
            title="Písmo"
          >
            {activeFaceLabel} ▾
          </button>
          {fontMenuOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-56 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg">
              <button
                type="button"
                className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-surface-hover"
                onClick={() => {
                  setFontMenuOpen(false);
                  applyStyle((run) => ({ ...run, fontFamily: null }));
                }}
              >
                Výchozí písmo
              </button>
              {fontGroups.map((group) => (
                <div key={group.name}>
                  <div className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    {group.name}
                  </div>
                  {group.faces.map((face) => (
                    <button
                      key={face.family}
                      type="button"
                      className={`block w-full rounded px-2 py-1 text-left text-sm hover:bg-surface-hover ${
                        activeFamily === face.family ? 'bg-surface-hover' : ''
                      }`}
                      style={{ fontFamily: `"${face.family}"` }}
                      onClick={() => {
                        setFontMenuOpen(false);
                        applyStyle((run) => ({ ...run, fontFamily: face.family }));
                      }}
                    >
                      {face.faceName}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {!singleFace && (
          <>
            <button
              type="button"
              disabled={disabled}
              className={`${buttonBase} font-bold ${activeBold ? buttonActive : ''}`}
              onClick={() => toggleFace('bold')}
              title="Tučně (Ctrl+B) — přepne řez písma"
            >
              B
            </button>
            <button
              type="button"
              disabled={disabled}
              className={`${buttonBase} italic ${activeItalic ? buttonActive : ''}`}
              onClick={() => toggleFace('italic')}
              title="Kurzíva (Ctrl+I) — přepne řez písma"
            >
              I
            </button>
          </>
        )}
        <button
          type="button"
          disabled={disabled}
          className={`${buttonBase} underline ${activeUnderline ? buttonActive : ''}`}
          onClick={toggleUnderline}
          title="Podtržení (Ctrl+U)"
        >
          U
        </button>
        <button
          type="button"
          disabled={disabled}
          className={buttonBase}
          onClick={clearFormatting}
          title="Výchozí styl — odstraní veškeré formátování"
        >
          <Eraser className="h-3.5 w-3.5" />
        </button>

        {/* List buttons — apply to the line(s) of the selection. */}
        {input.lists && (
          <>
            <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
            <button
              type="button"
              disabled={disabled}
              className={`${buttonBase} ${activeList === 'ul' ? buttonActive : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => toggleList('ul')}
              title="Odrážky"
              aria-pressed={activeList === 'ul'}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={disabled}
              className={`${buttonBase} ${activeList === 'ol' ? buttonActive : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => toggleList('ol')}
              title="Číslovaný seznam"
              aria-pressed={activeList === 'ol'}
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            {input.listCheckboxes && (
              <button
                type="button"
                disabled={disabled}
                className={`${buttonBase} ${activeList === 'cb' ? buttonActive : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggleList('cb')}
                title="Zaškrtávací seznam"
                aria-pressed={activeList === 'cb'}
              >
                <ListChecks className="h-3.5 w-3.5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Color swatches — per input: the designer may restrict or lock them. */}
      {!colorLocked && (
      <div className="mb-1.5 flex flex-wrap items-center gap-1" role="group" aria-label="Barva textu">
        <button
          type="button"
          disabled={disabled}
          className="h-6 w-6 rounded-full border border-border bg-white bg-[linear-gradient(to_top_right,transparent_44%,#dc3545_46%,#dc3545_54%,transparent_56%)]"
          title="Výchozí barva"
          onClick={() => applyStyle((run) => ({ ...run, color: null }))}
        />
        {swatches.map((color) => (
          <button
            key={color}
            type="button"
            disabled={disabled}
            className="h-6 w-6 rounded-full border border-border transition-shadow hover:shadow-[0_0_0_2px_rgba(59,130,246,0.4)]"
            style={{ backgroundColor: color }}
            title={color}
            onClick={() => applyStyle((run) => ({ ...run, color }))}
          />
        ))}
        {freeColor && (
        <label
          className="relative inline-flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border"
          style={{ background: 'conic-gradient(#f44, #fb0, #4c4, #19d, #b3f, #f44)' }}
          title="Vlastní barva"
        >
          <Palette className="h-3 w-3 text-white drop-shadow" />
          <input
            type="color"
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Vlastní barva"
            onChange={(event) => {
              const color = event.target.value || null;
              applyStyle((run) => ({ ...run, color }));
            }}
          />
        </label>
        )}
      </div>
      )}

      {/* Editing surface — one div[data-rt-line] per line (see renderDom). */}
      <div
        ref={editorRef}
        data-rt-editor=""
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={input.name ?? 'Text'}
        className={`min-h-[2.25rem] w-full cursor-text whitespace-pre-wrap break-words rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 ${
          disabled ? 'pointer-events-none opacity-60' : ''
        } ${input.uppercase ? 'uppercase' : ''}`}
        style={designFamily ? { fontFamily: `"${designFamily}"` } : undefined}
        onInput={() => {
          if (!composingRef.current) commitDomState();
        }}
        onKeyDown={handleKeyDown}
        onBeforeInput={handleBeforeInput}
        onPaste={handlePaste}
        onMouseDown={handleMouseDown}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          commitDomState();
        }}
      />
    </div>
  );
}
