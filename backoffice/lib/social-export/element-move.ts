/**
 * User-movable elements ("Uživatel může posunout", WBoost 2026-11) — TS port
 * of WBoost's shared core `assets/editor/element_move.js` (round2 /
 * normalize / scale / bounds / clamp / deltas), which WBoost pins to its PHP
 * resolver. Our parity test runs the same case set (fixture
 * `element-move-parity.json`, produced by the WBoost JS).
 *
 * The listing already hands us each element's effective `range` (the
 * server's own bound), so the editor clamps with {@link clampToRange}; the
 * allowance math is kept for parity and for the limit wording.
 *
 * Offsets are canvas px relative to the DESIGNED position. Pure + client-safe.
 */

import type { ElementOffset, ElementOffsets, MovableElementDTO, MoveRangeDTO } from './api-types';

/** A raw allowance as stored on the canvas (`userMove`). */
export interface MoveAllowance {
  vertical: boolean;
  horizontal: boolean;
  maxUp: number | null;
  maxDown: number | null;
  maxLeft: number | null;
  maxRight: number | null;
}

/** The designed axis-aligned box in the core's own field names. */
export interface MoveFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Half-away-from-zero to 1/100 with plain IEEE ops (≡ PHP round2 ≡ WBoost JS). */
export function round2(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const rounded = Math.floor(Math.abs(value) * 100 + 0.5) / 100;
  if (rounded === 0) return 0;
  return value < 0 ? -rounded : rounded;
}

function maxOrNull(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return round2(value);
}

/** Lenient normalisation → canonical allowance, or null (= not movable). */
export function normalize(raw: unknown): MoveAllowance | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const vertical = source.vertical === true;
  const horizontal = source.horizontal === true;
  if (!vertical && !horizontal) return null;
  return {
    vertical,
    horizontal,
    maxUp: vertical ? maxOrNull(source.maxUp) : null,
    maxDown: vertical ? maxOrNull(source.maxDown) : null,
    maxLeft: horizontal ? maxOrNull(source.maxLeft) : null,
    maxRight: horizontal ? maxOrNull(source.maxRight) : null,
  };
}

/** Group projection: vertical maxima × ry, horizontal × rx. */
export function scale(raw: unknown, rx: number, ry: number): MoveAllowance | null {
  const allowance = normalize(raw);
  if (!allowance) return null;
  const by = (value: number | null, ratio: number) => (value === null ? null : round2(value * ratio));
  return {
    vertical: allowance.vertical,
    horizontal: allowance.horizontal,
    maxUp: by(allowance.maxUp, ry),
    maxDown: by(allowance.maxDown, ry),
    maxLeft: by(allowance.maxLeft, rx),
    maxRight: by(allowance.maxRight, rx),
  };
}

/** Allowed offset range relative to the designed position (an unlimited side = up to the canvas edge). */
export function bounds(raw: unknown, frame: MoveFrame, canvasWidth: number, canvasHeight: number): MoveRangeDTO {
  const allowance = normalize(raw);
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  if (allowance?.horizontal) {
    minX = -(allowance.maxLeft !== null ? allowance.maxLeft : Math.max(0, frame.left));
    maxX = allowance.maxRight !== null ? allowance.maxRight : Math.max(0, canvasWidth - (frame.left + frame.width));
  }
  if (allowance?.vertical) {
    minY = -(allowance.maxUp !== null ? allowance.maxUp : Math.max(0, frame.top));
    maxY = allowance.maxDown !== null ? allowance.maxDown : Math.max(0, canvasHeight - (frame.top + frame.height));
  }
  return { minX: round2(minX), maxX: round2(maxX), minY: round2(minY), maxY: round2(maxY) };
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function clamp(
  raw: unknown,
  x: unknown,
  y: unknown,
  frame: MoveFrame,
  canvasWidth: number,
  canvasHeight: number
): ElementOffset {
  return clampToRange(bounds(raw, frame, canvasWidth, canvasHeight), x, y);
}

/** Clamp a requested offset to a range (the listing's `movableElements[].range`). */
export function clampToRange(range: MoveRangeDTO, x: unknown, y: unknown): ElementOffset {
  return {
    x: round2(Math.min(Math.max(finite(x), range.minX), range.maxX)),
    y: round2(Math.min(Math.max(finite(y), range.minY), range.maxY)),
  };
}

/** The container shape `deltas` walks (canvas definitions or listing DTOs). */
interface ContainerLike {
  id: string;
  memberInputIds?: string[];
  memberImageInputIds?: string[];
  memberContainerIds?: string[];
}

function deepMemberIds(byId: Map<string, ContainerLike>, rootId: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const visited = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.shift()!;
    if (visited.has(id) || !byId.has(id)) continue;
    visited.add(id);
    const container = byId.get(id)!;
    const members = [
      ...(Array.isArray(container.memberInputIds) ? container.memberInputIds : []),
      // Listing DTOs keep image slots apart from texts; canvas JSON has none.
      ...(Array.isArray(container.memberImageInputIds) ? container.memberImageInputIds : []),
    ];
    for (const memberId of members) {
      if (typeof memberId === 'string' && memberId !== '' && !seen.has(memberId)) {
        seen.add(memberId);
        result.push(memberId);
      }
    }
    for (const childId of Array.isArray(container.memberContainerIds) ? container.memberContainerIds : []) {
      if (typeof childId === 'string') stack.push(childId);
    }
  }
  return result;
}

/**
 * Per-member translation of a set of element offsets: id → [dx, dy]. A
 * container key moves every deep member (nested containers, row slots),
 * keys add, zero moves are skipped — the same ids the WBoost render moves.
 */
export function deltas(
  containers: ContainerLike[] | null | undefined,
  offsets: Record<string, Partial<ElementOffset> | null | undefined> | null | undefined
): Record<string, [number, number]> {
  const byId = new Map<string, ContainerLike>();
  for (const container of Array.isArray(containers) ? containers : []) {
    if (container && typeof container.id === 'string' && container.id !== '' && !byId.has(container.id)) {
      byId.set(container.id, container);
    }
  }

  const result: Record<string, [number, number]> = {};
  const add = (id: string, dx: number, dy: number) => {
    const current = result[id] ?? [0, 0];
    result[id] = [current[0] + dx, current[1] + dy];
  };
  for (const id of Object.keys(offsets ?? {})) {
    const offset = offsets?.[id] ?? {};
    const dx = finite(offset.x);
    const dy = finite(offset.y);
    if (dx === 0 && dy === 0) continue;
    if (byId.has(id)) {
      for (const memberId of deepMemberIds(byId, id)) add(memberId, dx, dy);
      continue;
    }
    add(id, dx, dy);
  }
  return result;
}

/** Whether an element may move along at least one axis. */
export function isMovable(element: MovableElementDTO): boolean {
  return element.vertical || element.horizontal;
}

/**
 * The `offsets` body for one variant: only its movable ids, every value
 * clamped to its range, unmoved elements omitted (the API accepts `{0, 0}`
 * too, but an empty map keeps the body and the history clean).
 */
export function sanitizeOffsets(
  movables: MovableElementDTO[] | undefined,
  offsets: ElementOffsets | null | undefined
): ElementOffsets {
  const result: ElementOffsets = {};
  for (const element of movables ?? []) {
    const raw = offsets?.[element.id];
    if (!raw || typeof raw !== 'object') continue;
    const clamped = clampToRange(element.range, raw.x, raw.y);
    if (clamped.x !== 0 || clamped.y !== 0) result[element.id] = clamped;
  }
  return result;
}

/** The ✥ / ↕ / ↔ glyph of an element's allowed axes. */
export function moveGlyph(element: Pick<MovableElementDTO, 'vertical' | 'horizontal'>): '✥' | '↕' | '↔' {
  if (element.vertical && element.horizontal) return '✥';
  return element.vertical ? '↕' : '↔';
}

function limitPart(label: string, value: number | null): string {
  if (value === null) return `${label} bez omezení`;
  if (value === 0) return `${label} ne`;
  return `${label} až ${round2(value).toLocaleString('cs-CZ')} px`;
}

/** "nahoru až 15 px · dolů bez omezení" — the designer limits of the allowed axes. */
export function describeLimits(element: MovableElementDTO): string {
  const parts: string[] = [];
  if (element.vertical) {
    parts.push(limitPart('nahoru', element.limits.up), limitPart('dolů', element.limits.down));
  }
  if (element.horizontal) {
    parts.push(limitPart('doleva', element.limits.left), limitPart('doprava', element.limits.right));
  }
  return parts.join(' · ');
}
