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
  TemplateContainerDTO,
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

  // Container reflow — tree-aware since the WBoost nesting rework: a child
  // container flows inside its parent as ONE block and grows freely; only a
  // TOP-LEVEL container's maxHeight gates overflow (and the render 400 always
  // reports the top-level id). Uniform `gap` replaces the designed spacing of
  // that container. Decorative image members are not exposed by the API, so a
  // container using them mirrors approximately — the render is authoritative.
  interface FlowItem {
    kind: 'text' | 'container';
    id: string;
    designedTop: number;
    designedHeight: number;
    extTop?: number | null;
    height?: number;
    hidden?: boolean;
  }
  interface FlowNode {
    container: TemplateContainerDTO;
    items: FlowItem[];
    gaps: number[];
    anchorTop: number;
    contentBottom: number;
    /** Horizontal designed extent of the tree — sibling push only couples
     *  roots whose x-ranges overlap (columns never interact). */
    extLeft: number;
    extRight: number;
    /** Sibling collision-push offset resolved over the measured roots. */
    rootDelta: number;
  }

  const containerById = new Map(variant.containers.map((c) => [c.id, c]));
  const claimed = new Set<string>();
  for (const c of variant.containers) {
    for (const childId of c.memberContainerIds ?? []) {
      if (childId !== c.id && containerById.has(childId)) claimed.add(childId);
    }
  }

  const nodes = new Map<string, FlowNode>();
  const buildNode = (container: TemplateContainerDTO, visiting: Set<string>): FlowNode | null => {
    if (visiting.has(container.id)) return null; // cycle guard
    visiting.add(container.id);

    const items: FlowItem[] = [];
    let extLeft = Infinity;
    let extRight = -Infinity;
    for (const id of container.memberInputIds) {
      const frame = inputById.get(id)?.frame;
      if (frame && frames[id] != null) {
        items.push({ kind: 'text', id, designedTop: frame.y, designedHeight: frame.height });
        extLeft = Math.min(extLeft, frame.x);
        extRight = Math.max(extRight, frame.x + frame.width);
      }
    }
    for (const childId of container.memberContainerIds ?? []) {
      const child = childId !== container.id ? containerById.get(childId) : undefined;
      if (!child) continue;
      const childNode = buildNode(child, visiting);
      if (!childNode) continue;
      const bottom = Math.max(...childNode.items.map((i) => i.designedTop + i.designedHeight));
      items.push({
        kind: 'container',
        id: childId,
        designedTop: childNode.anchorTop,
        designedHeight: bottom - childNode.anchorTop,
      });
      extLeft = Math.min(extLeft, childNode.extLeft);
      extRight = Math.max(extRight, childNode.extRight);
    }
    visiting.delete(container.id);
    if (items.length === 0) return null;

    items.sort((a, b) => a.designedTop - b.designedTop);
    const node: FlowNode = {
      container,
      items,
      gaps: items.slice(1).map((item, i) => item.designedTop - (items[i].designedTop + items[i].designedHeight)),
      anchorTop: items[0].designedTop,
      contentBottom: items[0].designedTop,
      extLeft,
      extRight,
      rootDelta: 0,
    };
    nodes.set(container.id, node);
    return node;
  };

  const measureNode = (node: FlowNode): { height: number; hidden: boolean } => {
    let previousBottom: number | null = null;
    node.items.forEach((item, i) => {
      if (item.kind === 'container') {
        const child = nodes.get(item.id)!;
        const measured = measureNode(child);
        item.height = measured.height;
        item.hidden = measured.hidden;
      } else {
        const input = inputById.get(item.id)!;
        item.height = frames[item.id].height;
        item.hidden = input.hidable && (state[item.id]?.hidden ?? false);
      }
      if (item.hidden) {
        item.extTop = null;
        return;
      }
      let gap =
        typeof node.container.gap === 'number' ? node.container.gap : (node.gaps[i - 1] ?? 0);
      // A nested child's spaceAfter floors the parent-flow gap after it.
      const previousItem = node.items[i - 1];
      if (previousItem?.kind === 'container') {
        const previousChild = containerById.get(previousItem.id);
        if (typeof previousChild?.spaceAfter === 'number') {
          gap = Math.max(gap, previousChild.spaceAfter);
        }
      }
      item.extTop = previousBottom === null ? node.anchorTop : previousBottom + gap;
      previousBottom = item.extTop + (item.height ?? 0);
    });
    node.contentBottom = previousBottom ?? node.anchorTop;
    return {
      height: node.contentBottom - node.anchorTop,
      hidden: node.items.every((item) => item.hidden),
    };
  };

  /** Final text tops across the tree, in flow order (null = hidden). */
  const commitNode = (node: FlowNode, delta: number, out: { id: string; top: number | null }[]) => {
    for (const item of node.items) {
      if (item.hidden || item.extTop == null) {
        if (item.kind === 'text') out.push({ id: item.id, top: null });
        else commitHiddenNode(nodes.get(item.id)!, out);
        continue;
      }
      if (item.kind === 'container') {
        const child = nodes.get(item.id)!;
        commitNode(child, item.extTop + delta - child.anchorTop, out);
      } else {
        out.push({ id: item.id, top: item.extTop + delta });
      }
    }
  };
  const commitHiddenNode = (node: FlowNode, out: { id: string; top: number | null }[]) => {
    for (const item of node.items) {
      if (item.kind === 'text') out.push({ id: item.id, top: null });
      else commitHiddenNode(nodes.get(item.id)!, out);
    }
  };

  const rootNodes: FlowNode[] = [];
  for (const container of variant.containers) {
    if (claimed.has(container.id) || container.nested === true) continue;
    const node = buildNode(container, new Set());
    if (node) {
      measureNode(node);
      rootNodes.push(node);
    }
  }

  // Sibling collision-push: top-level containers never overlap. Walked in
  // designed-top order, a root whose content would run into a lower,
  // horizontally-overlapping root pushes it down by the excess (chained;
  // whitespace absorbs growth first, no pull-up), keeping the pusher's
  // spaceAfter clearance — also enforced as a minimum at designed positions.
  const placed: FlowNode[] = [];
  [...rootNodes]
    .sort((a, b) => a.anchorTop - b.anchorTop)
    .forEach((node) => {
      let delta = 0;
      placed.forEach((other) => {
        const xOverlap =
          Math.min(other.extRight, node.extRight) - Math.max(other.extLeft, node.extLeft);
        if (!(xOverlap > 0)) return;
        const clearance =
          typeof other.container.spaceAfter === 'number' ? other.container.spaceAfter : 0;
        delta = Math.max(delta, other.contentBottom + other.rootDelta + clearance - node.anchorTop);
      });
      node.rootDelta = Math.max(0, delta);
      placed.push(node);
    });

  for (const node of rootNodes) {
    const delta = node.rootDelta;
    const flow: { id: string; top: number | null }[] = [];
    commitNode(node, delta, flow);

    flow.forEach((entry, i) => {
      if (!frames[entry.id]) return;
      if (entry.top !== null) {
        frames[entry.id] = { ...frames[entry.id], y: entry.top };
      } else {
        const nextVisible = flow.slice(i + 1).find((e) => e.top !== null);
        frames[entry.id] = {
          ...frames[entry.id],
          y: nextVisible?.top ?? node.contentBottom + delta,
          height: 0,
        };
      }
    });

    // Overflow = own maxHeight excess, or content ending below the canvas
    // bottom minus spaceAfter (a pushed section falling off the page).
    // Mirror the render's rounding (template_variant_render.html.twig) and
    // its 0.5px tolerance used by the WBoost fill overlay.
    const finalBottom = node.contentBottom + delta;
    const clearance =
      typeof node.container.spaceAfter === 'number' ? node.container.spaceAfter : 0;
    const overflowPx = Math.max(
      finalBottom - (node.anchorTop + delta + node.container.maxHeight),
      finalBottom - (variant.height - clearance)
    );
    if (overflowPx > 0.5) {
      overflows.push({
        containerId: node.container.id,
        overflowPx: Math.round(overflowPx * 100) / 100,
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
