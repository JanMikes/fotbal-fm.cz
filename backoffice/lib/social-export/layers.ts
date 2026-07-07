/**
 * Pure helper building the ordered "Vrstvy" (layers panel) row list for a
 * variant: every text + image placeholder merged into ONE list, sorted by the
 * API's `layerIndex` DESCENDING — the canvas paint order, so the topmost layer
 * comes first (Photoshop convention). Rows with a null `layerIndex` (object not
 * locatable, or an older API deploy without the field) sink to the end in their
 * definition order (Array.prototype.sort is stable).
 *
 * Client-safe (pure functions + shared types), unit-tested directly.
 */

import { resolveInputLabel, isEditable, type InputFieldState } from './field-rules';
import { resolveImageLabel, type ImageSlotState } from './field-rules-image';
import type { TemplateVariantDTO } from './api-types';

export interface LayerRow {
  kind: 'text' | 'image';
  id: string;
  label: string;
  /** Locked text inputs are not editable (rendered with a lock, no click). */
  editable: boolean;
  /**
   * Whether clicking the row can open an editor: image slots always (the
   * gallery modal needs no anchor); text only when editable AND a frame exists
   * (the floating text panel anchors to the overlay box).
   */
  clickable: boolean;
  hidable: boolean;
  hidden: boolean;
  /** Whether hovering the row can highlight a box over the preview. */
  hasFrame: boolean;
  layerIndex: number | null;
}

export function buildLayerRows(
  variant: TemplateVariantDTO,
  formState: Record<string, InputFieldState>,
  imageState: Record<string, ImageSlotState>
): LayerRow[] {
  const rows: LayerRow[] = [];

  variant.inputs.forEach((input, index) => {
    const editable = isEditable(input);
    rows.push({
      kind: 'text',
      id: input.id,
      label: resolveInputLabel(input, index),
      editable,
      clickable: editable && input.frame != null,
      hidable: input.hidable && editable,
      hidden: formState[input.id]?.hidden ?? false,
      hasFrame: input.frame != null,
      layerIndex: input.layerIndex,
    });
  });

  variant.imageInputs.forEach((input, index) => {
    rows.push({
      kind: 'image',
      id: input.id,
      label: resolveImageLabel(input, index),
      editable: true,
      clickable: true,
      hidable: input.hidable,
      hidden: imageState[input.id]?.hidden ?? false,
      hasFrame: input.frame != null,
      layerIndex: input.layerIndex,
    });
  });

  // Topmost first; nulls last (stable sort keeps their definition order).
  return rows.sort(
    (a, b) =>
      (b.layerIndex ?? Number.NEGATIVE_INFINITY) - (a.layerIndex ?? Number.NEGATIVE_INFINITY)
  );
}
