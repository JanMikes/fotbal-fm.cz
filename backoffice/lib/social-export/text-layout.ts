/**
 * Client-side mirror of the WBoost render's text layout, so the placeholder
 * boxes over the preview track the text the user actually typed instead of
 * freezing at the designed frames:
 *  - every editable text input's box height is re-measured from its current
 *    value (wrapped at `frame.width` with the input's Fabric `textStyle`);
 *  - container ("smart text area") members are then reflowed vertically with
 *    the same algorithm the render uses (WBoostContainerLayout), so longer
 *    text visibly pushes the members below it down and hidden members
 *    collapse — and the predicted `overflowPx` gates the download button
 *    BEFORE the render would 400.
 *
 * Measurement parity (mirrors Fabric 7 Textbox + WBoost's break-word patch —
 * canonical reference: brand-manuals `assets/editor/text_measure.js`): greedy
 * word wrap at `frame.width`, over-long words hard-break into grapheme
 * chunks, per-grapheme charSpacing (1/1000 em), line height
 * `fontSize × 1.13 × lineHeight` with the last line NOT lineHeight-multiplied
 * (Fabric's calcTextHeight). Rich-text runs may switch the font FAMILY per
 * segment (never the size) — a bold face wraps wider, so word widths are
 * summed per same-family piece.
 *
 * Accuracy depends on the REAL fonts being loaded (`useWboostFonts` — the
 * project fonts endpoint + FontFace). Before they load, wrap points come from
 * a fallback face: the boxes are approximate and the overflow pre-check must
 * stay off. The server render stays authoritative either way.
 *
 * Client-safe; measurement degrades to the designed frames when no canvas 2D
 * context exists (SSR, tests).
 */

import type {
  ImageFrameDTO,
  TemplateInputDTO,
  TemplateVariantDTO,
  TextStyleDTO,
} from './api-types';
import type { InputFieldState } from './field-rules';
import { isStyled, truncateRuns } from './rich-text';

/** Fabric's Text._fontSizeMult — part of every line's height. */
const FONT_SIZE_MULT = 1.13;

/** One same-style piece of a measured value (rich runs switch the family). */
export interface TextSegment {
  text: string;
  /** Face family override ("Rubik (Rubik Bold)"), or null = the input's designed family. */
  fontFamily: string | null;
}

/** A measurable value: plain string, or rich segments in order. */
export type MeasurableText = string | TextSegment[];

export type MeasureTextHeight = (
  value: MeasurableText,
  boxWidth: number,
  style: TextStyleDTO
) => number | null;

// ---------------------------------------------------------------------------
// Wrapped-height measurement (offscreen canvas 2D, Fabric-compatible math)
// ---------------------------------------------------------------------------

let measureContext: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext === undefined) {
    measureContext =
      typeof document === 'undefined'
        ? null
        : document.createElement('canvas').getContext('2d');
  }
  return measureContext;
}

/** Quote the family unless it already carries quotes/commas (Fabric's rule). */
function fontDeclaration(family: string, fontSize: number): string {
  const quoted = /['",]/.test(family) ? family : `"${family}"`;
  return `${fontSize}px ${quoted}`;
}

interface StyledGrapheme {
  g: string;
  family: string;
}

function toStyledGraphemes(value: MeasurableText, baseFamily: string): StyledGrapheme[] {
  const segments: TextSegment[] =
    typeof value === 'string' ? [{ text: value, fontFamily: null }] : value;
  const graphemes: StyledGrapheme[] = [];
  for (const segment of segments) {
    const family = segment.fontFamily || baseFamily;
    for (const g of Array.from(segment.text)) {
      graphemes.push({ g, family });
    }
  }
  return graphemes;
}

/**
 * Width of a styled-grapheme list: same-family pieces measured together
 * (canvas kerning within a piece), plus charSpacing per grapheme — Fabric's
 * kernedWidth + charSpacing sum.
 */
function measureStyled(
  ctx: CanvasRenderingContext2D,
  graphemes: StyledGrapheme[],
  fontSize: number,
  spacingPerGrapheme: number
): number {
  if (graphemes.length === 0) return 0;
  let width = graphemes.length * spacingPerGrapheme;
  let piece = '';
  let pieceFamily = graphemes[0].family;
  for (const { g, family } of graphemes) {
    if (family !== pieceFamily) {
      ctx.font = fontDeclaration(pieceFamily, fontSize);
      width += ctx.measureText(piece).width;
      piece = '';
      pieceFamily = family;
    }
    piece += g;
  }
  ctx.font = fontDeclaration(pieceFamily, fontSize);
  width += ctx.measureText(piece).width;
  return width;
}

/** A wrap entry: one word (or break-word chunk) with the family of the join before it. */
interface WrapEntry {
  width: number;
  joinerFamily: string | null;
}

/**
 * Number of wrapped lines of one paragraph. Mirrors Fabric Textbox._wrapLine
 * (splitByGrapheme: false) fed through WBoost's break-word patch (words wider
 * than the box pre-sliced into greedily packed grapheme chunks).
 */
function wrapParagraphLineCount(
  ctx: CanvasRenderingContext2D,
  graphemes: StyledGrapheme[],
  boxWidth: number,
  style: TextStyleDTO
): number {
  const spacing = (style.fontSize * style.charSpacing) / 1000;

  // Fabric wordSplit (_wordJoiners); consecutive separators yield empty words,
  // which still contribute their joining space — keep them. Each separator's
  // own family prices the inter-word space of the following join.
  const words: StyledGrapheme[][] = [];
  const joinerFamilies: string[] = [];
  let current: StyledGrapheme[] = [];
  for (const grapheme of graphemes) {
    if (grapheme.g === ' ' || grapheme.g === '\t' || grapheme.g === '\r') {
      words.push(current);
      joinerFamilies.push(grapheme.family);
      current = [];
    } else {
      current.push(grapheme);
    }
  }
  words.push(current);

  // Break-word patch: pre-slice over-wide words into fitting chunks.
  const entries: WrapEntry[] = [];
  let largestWordWidth = 0;
  for (let w = 0; w < words.length; w += 1) {
    const word = words[w];
    let joinerFamily = w === 0 ? null : joinerFamilies[w - 1];
    const wordWidth = measureStyled(ctx, word, style.fontSize, spacing);
    if (wordWidth <= boxWidth || word.length <= 1) {
      entries.push({ width: wordWidth, joinerFamily });
      largestWordWidth = Math.max(largestWordWidth, wordWidth);
      continue;
    }
    let chunk: StyledGrapheme[] = [];
    let chunkWidth = 0;
    for (const grapheme of word) {
      const candidate = [...chunk, grapheme];
      const candidateWidth = measureStyled(ctx, candidate, style.fontSize, spacing);
      if (chunk.length > 0 && candidateWidth > boxWidth) {
        entries.push({ width: chunkWidth, joinerFamily });
        largestWordWidth = Math.max(largestWordWidth, chunkWidth);
        joinerFamily = null; // chunks pack full-width; no re-inserted space
        chunk = [grapheme];
        chunkWidth = measureStyled(ctx, chunk, style.fontSize, spacing);
      } else {
        chunk = candidate;
        chunkWidth = candidateWidth;
      }
    }
    if (chunk.length > 0) {
      entries.push({ width: chunkWidth, joinerFamily });
      largestWordWidth = Math.max(largestWordWidth, chunkWidth);
    }
  }

  // Fabric _wrapLine: greedy fill; a word's trailing charSpacing doesn't count
  // against the limit (the `- additionalSpace` compensation).
  const additionalSpace = spacing;
  const maxWidth = Math.max(boxWidth, largestWordWidth);
  let lines = 0;
  let lineWidth = 0;
  let infixWidth = 0;
  let lineJustStarted = true;
  for (let e = 0; e < entries.length; e += 1) {
    lineWidth += infixWidth + entries[e].width - additionalSpace;
    if (lineWidth > maxWidth && !lineJustStarted) {
      lines += 1;
      lineWidth = entries[e].width;
      lineJustStarted = true;
    } else {
      lineWidth += additionalSpace;
    }
    const nextJoiner = e + 1 < entries.length ? entries[e + 1].joinerFamily : null;
    infixWidth =
      nextJoiner === null
        ? 0
        : measureStyled(ctx, [{ g: ' ', family: nextJoiner }], style.fontSize, spacing);
    lineJustStarted = false;
  }
  if (entries.length > 0) lines += 1;
  return Math.max(1, lines);
}

/**
 * Height of `value` wrapped in a box `boxWidth` wide, per Fabric's
 * calcTextHeight: every line is `fontSize × 1.13 × lineHeight` except the last,
 * which is `fontSize × 1.13`. Returns null when measuring is impossible
 * (no canvas 2D context) — callers keep the designed height.
 */
export function measureWrappedTextHeight(
  value: MeasurableText,
  boxWidth: number,
  style: TextStyleDTO
): number | null {
  const ctx = getMeasureContext();
  if (!ctx || !(boxWidth > 0) || !(style.fontSize > 0)) return null;

  const graphemes = toStyledGraphemes(value, style.fontFamily);

  // Paragraph split on newlines (Fabric's _reNewline); a stray \r acts as a
  // word joiner inside wrapParagraphLineCount.
  const paragraphs: StyledGrapheme[][] = [];
  let current: StyledGrapheme[] = [];
  for (const grapheme of graphemes) {
    if (grapheme.g === '\n') {
      paragraphs.push(current);
      current = [];
    } else {
      current.push(grapheme);
    }
  }
  paragraphs.push(current);

  let lineCount = 0;
  for (const paragraph of paragraphs) {
    lineCount += wrapParagraphLineCount(ctx, paragraph, boxWidth, style);
  }

  const fullLine = style.fontSize * FONT_SIZE_MULT * style.lineHeight;
  const lastLine = style.fontSize * FONT_SIZE_MULT;
  return fullLine * (lineCount - 1) + lastLine;
}

// ---------------------------------------------------------------------------
// Container reflow (verbatim port of WBoostContainerLayout — the algorithm is
// an API contract shared by the render, the WBoost editor and consumers)
// ---------------------------------------------------------------------------

export interface DesignedMember {
  designedTop: number;
  designedHeight: number;
}

export interface FlowMember {
  designedTop: number;
  actualHeight: number;
  hidden: boolean;
}

export interface ContainerLayoutResult {
  /** New top per member, in flow order; null = hidden (occupies no space). */
  tops: (number | null)[];
  containerTop: number;
  contentBottom: number;
  /** > 0 when the flow does not fit maxHeight (the render would 400). */
  overflowPx: number;
}

/** Designed vertical gaps between consecutive members; gaps[i] sits between i and i+1. */
export function computeGaps(members: DesignedMember[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < members.length; i += 1) {
    const previous = members[i - 1];
    gaps.push(members[i].designedTop - (previous.designedTop + previous.designedHeight));
  }
  return gaps;
}

/**
 * Pure reflow: the first visible member anchors at the container top (designed
 * top of the FIRST member, hidden or not); every next visible member sits at
 * previousVisibleBottom + its own designed gap. Hidden members get a null top.
 */
export function computeLayout(
  members: FlowMember[],
  maxHeight: number,
  gaps: number[]
): ContainerLayoutResult {
  const tops: (number | null)[] = new Array(members.length).fill(null);
  if (members.length === 0) {
    return { tops, containerTop: 0, contentBottom: 0, overflowPx: 0 };
  }

  const containerTop = members[0].designedTop;
  let previousBottom: number | null = null;

  for (let i = 0; i < members.length; i += 1) {
    const member = members[i];
    if (member.hidden) continue;
    const top: number =
      previousBottom === null ? containerTop : previousBottom + (gaps[i - 1] ?? 0);
    tops[i] = top;
    previousBottom = top + member.actualHeight;
  }

  const contentBottom = previousBottom === null ? containerTop : previousBottom;
  const overflowPx = Math.max(0, contentBottom - (containerTop + maxHeight));

  return { tops, containerTop, contentBottom, overflowPx };
}

// ---------------------------------------------------------------------------
// Per-variant frame computation (what the overlay consumes)
// ---------------------------------------------------------------------------

/**
 * The value the render would draw for this input, or null when the box keeps
 * its designed geometry: locked inputs always render their canvas default, and
 * an empty, non-hidden value is omitted from the payload (template default
 * text — whose extent IS the designed frame). Mirrors `buildRenderInputs` +
 * the server's ResolveTextOverrides (maxLength cap, uppercase). Rich values
 * with styled runs measure as segments (a bold face wraps wider).
 */
function renderedValue(
  input: TemplateInputDTO,
  fieldState: InputFieldState | undefined
): MeasurableText | null {
  if (input.locked) return null;

  if (input.richText && isStyled(fieldState?.runs)) {
    let runs = fieldState.runs;
    if (input.maxLength != null) {
      runs = truncateRuns(runs, input.maxLength);
    }
    const segments: TextSegment[] = runs.map((run) => ({
      text: input.uppercase ? run.text.toUpperCase() : run.text,
      fontFamily: run.fontFamily,
    }));
    return segments.some((segment) => segment.text !== '') ? segments : null;
  }

  let value = fieldState?.value ?? '';
  if (value === '') return null;
  if (input.maxLength != null && value.length > input.maxLength) {
    value = value.slice(0, input.maxLength);
  }
  return input.uppercase ? value.toUpperCase() : value;
}

/** One container whose predicted flow exceeds its maxHeight. */
export interface PredictedOverflow {
  containerId: string;
  overflowPx: number;
}

export interface TextLayoutResult {
  /** Live canvas-px frame per framed text input (measured + reflowed). */
  frames: Record<string, ImageFrameDTO>;
  /** Containers predicted to overflow, worst first. Trustworthy only with real fonts loaded. */
  overflows: PredictedOverflow[];
}

/**
 * Live canvas-px frames of every framed text input: designed frame, height
 * re-measured from the current value, container members reflowed (hidden ones
 * collapsed to a zero-height line at their flow position so their eye toggle
 * stays reachable). Inputs the render leaves at their default keep the
 * designed frame untouched. Also predicts each container's overflow — the
 * same number the render's `container_overflow` 400 would report.
 *
 * `measure` is injectable for tests; the default degrades to designed heights
 * when no canvas context is available.
 */
export function computeTextLayout(
  variant: TemplateVariantDTO,
  state: Record<string, InputFieldState>,
  measure: MeasureTextHeight = measureWrappedTextHeight
): TextLayoutResult {
  const frames: Record<string, ImageFrameDTO> = {};
  const overflows: PredictedOverflow[] = [];
  const inputById = new Map(variant.inputs.map((input) => [input.id, input]));

  for (const input of variant.inputs) {
    if (!input.frame) continue;
    let height = input.frame.height;
    const value = renderedValue(input, state[input.id]);
    if (value !== null && input.textStyle) {
      height = measure(value, input.frame.width, input.textStyle) ?? height;
    }
    frames[input.id] = { ...input.frame, height };
  }

  for (const container of variant.containers) {
    const memberIds = container.memberInputIds.filter((id) => frames[id] != null);
    if (memberIds.length < 2) continue;

    const designed = memberIds.map((id) => {
      const frame = inputById.get(id)!.frame!;
      return { designedTop: frame.y, designedHeight: frame.height };
    });
    const gaps = computeGaps(designed);
    const members = memberIds.map((id, i) => {
      const input = inputById.get(id)!;
      return {
        designedTop: designed[i].designedTop,
        actualHeight: frames[id].height,
        hidden: input.hidable && (state[id]?.hidden ?? false),
      };
    });
    const layout = computeLayout(members, container.maxHeight, gaps);

    memberIds.forEach((id, i) => {
      const top = layout.tops[i];
      if (top !== null) {
        frames[id] = { ...frames[id], y: top };
      } else {
        const nextVisibleTop = layout.tops.slice(i + 1).find((t) => t !== null);
        frames[id] = {
          ...frames[id],
          y: nextVisibleTop ?? layout.contentBottom,
          height: 0,
        };
      }
    });

    // Mirror the render's rounding (template_variant_render.html.twig) and its
    // 0.5px tolerance used by the WBoost fill overlay.
    if (layout.overflowPx > 0.5) {
      overflows.push({
        containerId: container.id,
        overflowPx: Math.round(layout.overflowPx * 100) / 100,
      });
    }
  }

  overflows.sort((a, b) => b.overflowPx - a.overflowPx);

  return { frames, overflows };
}

/** Frames-only view of `computeTextLayout` (kept for callers that ignore overflow). */
export function computeTextFrames(
  variant: TemplateVariantDTO,
  state: Record<string, InputFieldState>,
  measure: MeasureTextHeight = measureWrappedTextHeight
): Record<string, ImageFrameDTO> {
  return computeTextLayout(variant, state, measure).frames;
}
