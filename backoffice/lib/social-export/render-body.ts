/**
 * Render bodies with repeatable rows + moved elements (WBoost 2026-11) and
 * the restore of both from a saved record. The variant here is the EXPANDED
 * one (`expandRepeatableRows`): the flat maps are built as before over every
 * slot, then {@link buildRowsBody} moves the row values into `rows`.
 *
 * Pure + client-safe.
 */

import type {
  ElementOffsets,
  RenderImageValue,
  RenderInputValue,
  RenderRows,
  RepeatableRowDTO,
  TemplateVariantDTO,
} from './api-types';
import { buildRenderInputs, type InputFieldState } from './field-rules';
import { buildRenderImages, type ImageSlotState } from './field-rules-image';
import { sanitizeShapeColors, type ShapeColorState } from './shape-colors';
import { buildRowsBody, defaultRowCounts, inactiveRowIds, inferRowCounts } from './repeatable-rows';
import { sanitizeOffsets } from './element-move';

export interface RenderBodyParts {
  inputs: Record<string, RenderInputValue>;
  images: Record<string, RenderImageValue>;
  shapeColors: Record<string, string>;
  /** Present only for a variant with repeatable rows. */
  rows?: RenderRows;
  /** Present only when something moved. */
  offsets?: ElementOffsets;
}

/** The surface's repeatable rows (group members share them; first wins). */
export function surfaceRows(members: TemplateVariantDTO[]): RepeatableRowDTO[] {
  const seen = new Map<string, RepeatableRowDTO>();
  for (const member of members) {
    for (const row of member.repeatableRows ?? []) if (!seen.has(row.containerId)) seen.set(row.containerId, row);
  }
  return [...seen.values()];
}

/** The ids of every unused row slot of a surface. */
export function surfaceInactiveIds(members: TemplateVariantDTO[], rowCounts: Record<string, number>): Set<string> {
  return inactiveRowIds(surfaceRows(members), rowCounts);
}

/** The full single-variant body: inputs / images / shapeColors + rows + offsets. */
export function buildVariantRenderBody(
  variant: TemplateVariantDTO,
  state: {
    formState: Record<string, InputFieldState>;
    imageState: Record<string, ImageSlotState>;
    shapeColors: ShapeColorState;
    rowCounts: Record<string, number>;
    offsets: ElementOffsets | undefined;
  }
): RenderBodyParts {
  const flat = {
    inputs: buildRenderInputs(variant.inputs, state.formState, variant.containers),
    images: buildRenderImages(variant.imageInputs, state.imageState),
    shapeColors: sanitizeShapeColors(variant.shapeInputs, state.shapeColors),
  };
  const rows = variant.repeatableRows ?? [];
  const body: RenderBodyParts = rows.length > 0 ? buildRowsBody(rows, state.rowCounts, flat) : flat;
  const offsets = sanitizeOffsets(variant.movableElements, state.offsets);
  if (Object.keys(offsets).length > 0) body.offsets = offsets;
  return body;
}

/**
 * Row counts + offsets out of a saved record. Counts: the stored ones, else
 * inferred from the slot ids the record addresses (an old hand-numbered
 * row's id is its slot id now), never below the default. Offsets: per
 * variant, re-clamped against the CURRENT ranges (dropped when no longer
 * movable).
 */
export function restoreRowsAndOffsets(
  members: TemplateVariantDTO[],
  saved: {
    formState?: Record<string, unknown> | null;
    imageKeys?: Iterable<string>;
    shapeColors?: Record<string, string> | null;
    rowCounts?: Record<string, number> | null;
    offsets?: Record<string, ElementOffsets> | null;
  } | null | undefined
): { rowCounts: Record<string, number>; offsets: Record<string, ElementOffsets> } {
  const rows = surfaceRows(members);
  if (!saved) return { rowCounts: defaultRowCounts(rows), offsets: {} };
  const present = [
    ...Object.keys(saved.formState ?? {}),
    ...(saved.imageKeys ?? []),
    ...Object.keys(saved.shapeColors ?? {}),
  ];
  const offsets: Record<string, ElementOffsets> = {};
  for (const member of members) {
    const clean = sanitizeOffsets(member.movableElements, saved.offsets?.[member.id]);
    if (Object.keys(clean).length > 0) offsets[member.id] = clean;
  }
  return { rowCounts: inferRowCounts(rows, saved.rowCounts, present), offsets };
}
