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
 * caret no-op confusing).
 *
 * Reliability guards mirrored from the wboost fill-page editor: IME
 * composition (no DOM rebuild mid-composition), paste forced to plain text
 * (newlines flattened), Enter blocked (values carry no newlines), runs
 * snapshot undo (Cmd/Ctrl+Z — programmatic re-renders kill native undo),
 * maxLength enforced on the plain projection in code points.
 *
 * The DOM is only rebuilt on toolbar actions / paste / undo / external value
 * replacement — never on plain typing (that would break the caret and IME).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, Palette } from 'lucide-react';
import type {
  RichRunDTO,
  RichTextOptionsDTO,
  TemplateInputDTO,
} from '@/lib/social-export/api-types';
import type { InputFieldState } from '@/lib/social-export/field-rules';
import {
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

function stateRuns(state: InputFieldState): RichRunDTO[] {
  if (isStyled(state.runs) && plainText(state.runs) === state.value) return state.runs;
  return runsFromPlain(state.value);
}

function runsEqual(a: RichRunDTO[], b: RichRunDTO[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

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
  const composingRef = useRef(false);
  const undoRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const lastTypingPushRef = useRef(0);

  // Toolbar reflection of the current selection.
  const [activeFamily, setActiveFamily] = useState<string | ''>('');
  const [activeBold, setActiveBold] = useState(false);
  const [activeItalic, setActiveItalic] = useState(false);
  const [activeUnderline, setActiveUnderline] = useState(false);
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [plainLength, setPlainLength] = useState(() => codePointLength(state.value));

  const fontGroups = useMemo(() => groupFontsByName(options.fonts), [options.fonts]);
  const designFamily = input.textStyle?.fontFamily ?? null;

  // ------------------------------------------------------------------ DOM <-> runs

  const renderDom = useCallback((runs: RichRunDTO[]) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.textContent = '';
    for (const run of runs) {
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
      editor.appendChild(span);
    }
  }, []);

  /** Whitelist parser: only our span[data-rt-run] carry style. */
  const parseDom = useCallback((): RichRunDTO[] => {
    const editor = editorRef.current;
    if (!editor) return [];
    const raw: RichRunDTO[] = [];
    const walk = (node: Node, inherited: Omit<RichRunDTO, 'text'>) => {
      if (node.nodeType === Node.TEXT_NODE) {
        raw.push({ ...inherited, text: (node as Text).data });
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as HTMLElement;
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
    editor.childNodes.forEach((node) =>
      walk(node, { fontFamily: null, color: null, underline: false })
    );
    return normalizeRuns(raw) ?? [];
  }, []);

  // ------------------------------------------------------------------ selection

  const offsetAt = useCallback((container: Node, offset: number): number => {
    const editor = editorRef.current;
    if (!editor) return 0;
    let total = 0;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node === container) return total + offset;
      total += (node as Text).data.length;
    }
    if (container.nodeType === Node.ELEMENT_NODE) {
      let sum = 0;
      for (let i = 0; i < Math.min(offset, container.childNodes.length); i += 1) {
        sum += container.childNodes[i].textContent?.length ?? 0;
      }
      if (container === editor) return sum;
    }
    return total;
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
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      let remaining = target;
      let node: Node | null;
      let last: Text | null = null;
      while ((node = walker.nextNode())) {
        last = node as Text;
        if (remaining <= last.data.length) return { node: last, offset: remaining };
        remaining -= last.data.length;
      }
      if (last) return { node: last, offset: last.data.length };
      return { node: editor, offset: 0 };
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

  const pushUndo = useCallback((coalesce = false) => {
    const snapshot = JSON.stringify(runsRef.current);
    const stack = undoRef.current;
    if (stack[stack.length - 1] === snapshot) return;
    if (coalesce && Date.now() - lastTypingPushRef.current < 700) return;
    if (coalesce) lastTypingPushRef.current = Date.now();
    stack.push(snapshot);
    if (stack.length > 50) stack.shift();
    redoRef.current = [];
  }, []);

  const emit = useCallback(
    (runs: RichRunDTO[]) => {
      runsRef.current = runs;
      const plain = plainText(runs);
      setPlainLength(codePointLength(plain));
      onChange({ value: plain, runs: isStyled(runs) ? runs : null });
    },
    [onChange]
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
  }, [designFamily, effectiveRange, options.fonts, sliceRuns]);

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
      renderDom(runs);
      emit(runs);
      restoreSelection(
        range.hadSelection ? range.start : plain.length,
        range.hadSelection ? range.end : plain.length
      );
      updateToolbarState();
    },
    [effectiveRange, emit, pushUndo, renderDom, restoreSelection, sliceRuns, updateToolbarState]
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
    renderDom(runs);
    emit(runs);
    updateToolbarState();
  }, [emit, pushUndo, renderDom, updateToolbarState]);

  const undo = useCallback(() => {
    const snapshot = undoRef.current.pop();
    if (snapshot === undefined) return;
    redoRef.current.push(JSON.stringify(runsRef.current));
    const runs = normalizeRuns(JSON.parse(snapshot) as unknown) ?? [];
    renderDom(runs);
    emit(runs);
  }, [emit, renderDom]);

  const redo = useCallback(() => {
    const snapshot = redoRef.current.pop();
    if (snapshot === undefined) return;
    undoRef.current.push(JSON.stringify(runsRef.current));
    const runs = normalizeRuns(JSON.parse(snapshot) as unknown) ?? [];
    renderDom(runs);
    emit(runs);
  }, [emit, renderDom]);

  // ------------------------------------------------------------------ editor events

  const commitDomState = useCallback(() => {
    let runs = parseDom();
    let truncated = false;
    if (input.maxLength != null && codePointLength(plainText(runs)) > input.maxLength) {
      runs = truncateRuns(runs, input.maxLength);
      truncated = true;
    }
    if (!runsEqual(runs, runsRef.current)) {
      pushUndo(true);
    }
    if (truncated) {
      renderDom(runs);
      const end = plainText(runs).length;
      restoreSelection(end, end);
    }
    emit(runs);
  }, [emit, input.maxLength, parseDom, pushUndo, renderDom, restoreSelection]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === 'b') {
        event.preventDefault();
        toggleFace('bold');
      } else if (key === 'i') {
        event.preventDefault();
        toggleFace('italic');
      } else if (key === 'u') {
        event.preventDefault();
        toggleUnderline();
      }
    },
    [redo, toggleFace, toggleUnderline, undo]
  );

  const handleBeforeInput = useCallback(
    (event: React.FormEvent<HTMLDivElement>) => {
      if (input.maxLength == null) return;
      const native = event.nativeEvent as InputEvent;
      if (!native.inputType || !native.inputType.startsWith('insert')) return;
      const offsets = selectionOffsets();
      const selectionLength = offsets ? Math.abs(offsets.end - offsets.start) : 0;
      const inserted = typeof native.data === 'string' ? native.data.length : 0;
      if (inserted === 0) return;
      if (plainLength - selectionLength + inserted > input.maxLength) {
        event.preventDefault();
      }
    },
    [input.maxLength, plainLength, selectionOffsets]
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain').replace(/[\r\n]+/g, ' ');
      if (!text) return;
      pushUndo();
      const offsets = selectionOffsets() ?? {
        start: plainText(runsRef.current).length,
        end: plainText(runsRef.current).length,
      };
      const start = Math.min(offsets.start, offsets.end);
      const end = Math.max(offsets.start, offsets.end);
      const plain = plainText(runsRef.current);
      const before = sliceRuns(0, start);
      const after = sliceRuns(end, plain.length);
      const styleSource = before[before.length - 1] ?? after[0] ?? null;
      let runs = normalizeRuns([
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
      renderDom(runs);
      emit(runs);
      const caret = Math.min(start + text.length, plainText(runs).length);
      restoreSelection(caret, caret);
    },
    [emit, input.maxLength, pushUndo, renderDom, restoreSelection, selectionOffsets, sliceRuns]
  );

  // ------------------------------------------------------------------ lifecycle

  // Initial render + external value replacement (chips insert, saved-state
  // restore): resync the DOM when the parent state no longer matches ours.
  useEffect(() => {
    const external = stateRuns(state);
    if (!runsEqual(external, runsRef.current)) {
      runsRef.current = external;
      setPlainLength(codePointLength(state.value));
      renderDom(external);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.value, state.runs]);

  useEffect(() => {
    renderDom(runsRef.current);
    if (autoFocus) editorRef.current?.focus();
    const onSelectionChange = () => {
      const offsets = selectionOffsets();
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
          font proxy (fonts hard-require CORS, unlike images). */}
      <style>
        {options.fonts
          .map(
            (font) =>
              `@font-face { font-family: "${font.family}"; src: url("${font.url}"); font-display: swap; }`
          )
          .join('\n')}
      </style>

      {/* Toolbar */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1">
        {/* Face dropdown (custom listbox so options render in their face) */}
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
      </div>

      {/* Color swatches */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1" role="group" aria-label="Barva textu">
        <button
          type="button"
          disabled={disabled}
          className="h-6 w-6 rounded-full border border-border bg-white bg-[linear-gradient(to_top_right,transparent_44%,#dc3545_46%,#dc3545_54%,transparent_56%)]"
          title="Výchozí barva"
          onClick={() => applyStyle((run) => ({ ...run, color: null }))}
        />
        {options.colors.map((color) => (
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
      </div>

      {/* Editing surface */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="false"
        aria-label={input.name ?? 'Text'}
        className={`min-h-[2.25rem] w-full cursor-text whitespace-pre-wrap break-words rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 ${
          disabled ? 'pointer-events-none opacity-60' : ''
        } ${input.uppercase ? 'uppercase' : ''} empty:before:pointer-events-none empty:before:text-text-muted empty:before:content-[attr(data-placeholder)]`}
        style={designFamily ? { fontFamily: `"${designFamily}"` } : undefined}
        data-placeholder="Zadejte text…"
        onInput={() => {
          if (!composingRef.current) commitDomState();
        }}
        onKeyDown={handleKeyDown}
        onBeforeInput={handleBeforeInput}
        onPaste={handlePaste}
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
