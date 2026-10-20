/**
 * Recolourable shapes ("Barva pro uživatele" in WBoost): a shape the designer
 * opened up is ONE colour field — the picked `#rrggbb` repaints its fill, its
 * border or both (`target`). The pick is shared by every dimension of a group
 * (members share the shape's id), so the editor keeps one map
 * `shapeId → colour` per fill surface; "" / absent = the designed colour.
 *
 * Client-safe (pure functions), unit-tested directly.
 */

import type { ShapeInputDTO, TemplateVariantDTO } from './api-types';

/** shapeId → picked `#rrggbb` (absent = designed colour). */
export type ShapeColorState = Record<string, string>;

/** The surface's recolourable shapes: union over its dimensions, first wins. */
export function unionShapeInputs(members: TemplateVariantDTO[]): ShapeInputDTO[] {
  const seen = new Map<string, ShapeInputDTO>();
  for (const member of members) {
    for (const shape of member.shapeInputs ?? []) {
      if (!seen.has(shape.id)) seen.set(shape.id, shape);
    }
  }
  return [...seen.values()];
}

/** `#rgb` / `#rrggbb` (any case, `#` optional) → lowercase `#rrggbb`, else null — WBoost's own rule. */
export function normalizeHexColor(value: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const hex = match[1].toLowerCase();
  return `#${hex.length === 3 ? hex.replace(/(.)/g, '$1$1') : hex}`;
}

/** Whether WBoost will accept `color` for this shape (a list-only shape takes its options only). */
export function isAllowedShapeColor(shape: ShapeInputDTO, color: string): boolean {
  return shape.freeColor || shape.colorOptions.includes(color);
}

/**
 * Keep only picks that still apply: shapes that exist, valid hexes, colours
 * the shape accepts — and drop picks equal to the designed colour (no
 * override). Used for the render body AND to sanitize a saved / loaded state
 * (the design may have changed in WBoost since).
 */
export function sanitizeShapeColors(
  shapes: ShapeInputDTO[],
  raw: Record<string, unknown> | null | undefined
): ShapeColorState {
  const result: ShapeColorState = {};
  if (!raw) return result;

  for (const shape of shapes) {
    const value = raw[shape.id];
    if (typeof value !== 'string' || value === '') continue;
    const color = normalizeHexColor(value);
    if (!color || color === shape.defaultColor || !isAllowedShapeColor(shape, color)) continue;
    result[shape.id] = color;
  }

  return result;
}

/** The colour a shape currently shows (its pick, else the designed colour). */
export function currentShapeColor(shape: ShapeInputDTO, state: ShapeColorState): string {
  return state[shape.id] ?? shape.defaultColor;
}

/** Field label: the designer's layer name, else a numbered fallback. */
export function resolveShapeLabel(shape: ShapeInputDTO, index: number): string {
  return shape.name?.trim() || `Barva tvaru ${index + 1}`;
}

/** Czech description of what a pick repaints. */
export function shapeTargetLabel(target: ShapeInputDTO['target']): string {
  switch (target) {
    case 'fill':
      return 'Mění barvu výplně';
    case 'stroke':
      return 'Mění barvu obrysu';
    default:
      return 'Mění výplň i obrys';
  }
}
