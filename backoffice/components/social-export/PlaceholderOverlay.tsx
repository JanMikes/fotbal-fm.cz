'use client';

import PlaceholderBox from './PlaceholderBox';
import PlaceholderTools from './PlaceholderTools';
import { resolveInputLabel, isEditable, type InputFieldState } from '@/lib/social-export/field-rules';
import { resolveImageLabel, type ImageSlotState } from '@/lib/social-export/field-rules-image';
import { canvasToDisplay, type DisplayRect } from '@/lib/social-export/geometry';
import type { TemplateVariantDTO } from '@/lib/social-export/api-types';

/** Identifies which kind of placeholder a box belongs to. */
export type ActivePlaceholder =
  | { kind: 'text'; id: string }
  | { kind: 'image'; id: string };

interface PlaceholderOverlayProps {
  variant: TemplateVariantDTO;
  /** canvas-px → display-px factor (renderedImgWidth / variant.width). */
  scale: number;
  /** Stage size in display px, used to keep the tool clusters inside the preview. */
  stageWidth: number;
  stageHeight: number;
  /** Whether the dashed boundary boxes are drawn (the active one always shows). */
  showBorders: boolean;
  active: ActivePlaceholder | null;
  onSelect: (placeholder: ActivePlaceholder) => void;
  /** Per-input hidden flags (drive the eye toggle). */
  formState: Record<string, InputFieldState>;
  imageState: Record<string, ImageSlotState>;
  onToggleHidden: (placeholder: ActivePlaceholder) => void;
}

interface OverlayItem {
  key: string;
  kind: 'text' | 'image';
  id: string;
  rect: DisplayRect;
  label: string;
  editable: boolean;
  hidable: boolean;
  hidden: boolean;
  active: boolean;
}

const TOOL = 30; // button diameter (px), matches PlaceholderTools
const TOOL_GAP = 4;
const EDGE = 2;

/** Position the tool cluster glued to the box's top-right, above when there's room. */
function clusterPosition(item: OverlayItem, stageWidth: number, stageHeight: number) {
  const buttons = item.editable ? 1 + (item.hidable ? 1 : 0) : 1; // pencil(+eye) or lock
  const clusterW = buttons * TOOL + (buttons - 1) * TOOL_GAP;
  const right = item.rect.left + item.rect.width;
  let left = right - clusterW;
  left = Math.min(Math.max(EDGE, left), Math.max(EDGE, stageWidth - clusterW - EDGE));
  // Prefer just above the box; tuck inside the top edge when there's no room.
  let top = item.rect.top - TOOL - TOOL_GAP;
  if (top < EDGE) top = item.rect.top + TOOL_GAP;
  top = Math.min(Math.max(EDGE, top), Math.max(EDGE, stageHeight - TOOL - EDGE));
  return { left, top };
}

/**
 * Absolutely-positioned overlay (sized to the rendered image rect) drawn in two
 * layers: (1) the dashed boundary boxes, (2) the interactive tool clusters on
 * top. Splitting them guarantees every placeholder's pencil/eye paints above all
 * boxes' borders. Text + image slots are both drawn; locked text inputs render a
 * lock indicator (no pencil). Inputs without a frame aren't drawable — they
 * remain editable via the fallback field list under the preview.
 */
export default function PlaceholderOverlay({
  variant,
  scale,
  stageWidth,
  stageHeight,
  showBorders,
  active,
  onSelect,
  formState,
  imageState,
  onToggleHidden,
}: PlaceholderOverlayProps) {
  const items: OverlayItem[] = [];

  variant.inputs.forEach((input, index) => {
    if (!input.frame) return;
    items.push({
      key: `text-${input.id}`,
      kind: 'text',
      id: input.id,
      rect: canvasToDisplay(input.frame, scale),
      label: resolveInputLabel(input, index),
      editable: isEditable(input),
      hidable: input.hidable,
      hidden: formState[input.id]?.hidden ?? false,
      active: active?.kind === 'text' && active.id === input.id,
    });
  });

  variant.imageInputs.forEach((input, index) => {
    if (!input.frame) return;
    items.push({
      key: `image-${input.id}`,
      kind: 'image',
      id: input.id,
      rect: canvasToDisplay(input.frame, scale),
      label: resolveImageLabel(input, index),
      editable: true,
      hidable: input.hidable,
      hidden: imageState[input.id]?.hidden ?? false,
      active: active?.kind === 'image' && active.id === input.id,
    });
  });

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Layer 1 — boundary boxes (decorative). Hidden slots always show their
          hatched box so the "won't be exported" state is visible regardless of
          the highlight toggle. */}
      {items.map((item) =>
        showBorders || item.active || item.hidden ? (
          <PlaceholderBox
            key={`box-${item.key}`}
            rect={item.rect}
            active={item.active}
            readOnly={!item.editable}
            hidden={item.hidden}
          />
        ) : null
      )}

      {/* Layer 2 — interactive tools, always on top. */}
      {items.map((item) => {
        const { left, top } = clusterPosition(item, stageWidth, stageHeight);
        return (
          <PlaceholderTools
            key={`tools-${item.key}`}
            left={left}
            top={top}
            label={item.label}
            active={item.active}
            readOnly={!item.editable}
            hidable={item.hidable}
            hidden={item.hidden}
            onEdit={() => onSelect({ kind: item.kind, id: item.id })}
            onToggleHidden={() => onToggleHidden({ kind: item.kind, id: item.id })}
          />
        );
      })}
    </div>
  );
}
