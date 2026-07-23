'use client';

import ImagePlacementGhost from './ImagePlacementGhost';
import PlaceholderBox from './PlaceholderBox';
import PlaceholderTools from './PlaceholderTools';
import { resolveInputLabel, isEditable, type InputFieldState } from '@/lib/social-export/field-rules';
import { resolveImageLabel, type ImageSlotState } from '@/lib/social-export/field-rules-image';
import { canvasToDisplay, type DisplayRect } from '@/lib/social-export/geometry';
import type {
  TemplateVariantDTO,
  TemplateContainerDTO,
  ImageFrameDTO,
} from '@/lib/social-export/api-types';

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
  /** Placement edits from dragging / zooming a picture on the preview. */
  onImageChange: (slotId: string, partial: Partial<ImageSlotState>) => void;
  /**
   * The preview currently on screen. A new one means the server has caught up
   * with the placement, so the drag stand-ins step aside for it.
   */
  previewUrl?: string | null;
  /**
   * Container whose filled texts overflowed on the last render
   * (`container_overflow` 400): its zone + member boxes go red.
   */
  overflowContainerId?: string | null;
  /**
   * Live text-box frames (canvas px) computed from the typed values
   * (`computeTextFrames`): measured heights + container reflow. Falls back to
   * the designed frames for inputs missing from the map.
   */
  textFrames?: Record<string, ImageFrameDTO>;
  /**
   * Placeholder hovered in the layers panel — its box is drawn highlighted
   * regardless of the border toggle (a pointing gesture, not a hint).
   */
  hovered?: ActivePlaceholder | null;
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
  /** Hovered in the layers panel. */
  hovered: boolean;
  /** Member of the container that overflowed on the last render. */
  error?: boolean;
}

const TOOL = 30; // button diameter (px), matches PlaceholderTools
const TOOL_GAP = 4;
const EDGE = 2;
const ZONE_PAD = 4; // container zone horizontal padding around member frames (canvas px)

/**
 * A container's zone rect in display px: from its `y` down `maxHeight`,
 * horizontally spanning its members' designed frames. Null when no member
 * frame can be resolved (nothing to draw).
 */
function containerZoneRect(
  container: TemplateContainerDTO,
  variant: TemplateVariantDTO,
  scale: number
): DisplayRect | null {
  const memberFrames = container.memberInputIds
    .map((id) => variant.inputs.find((input) => input.id === id)?.frame)
    .filter((frame): frame is NonNullable<typeof frame> => frame != null);
  if (memberFrames.length === 0) return null;

  const left = Math.min(...memberFrames.map((f) => f.x)) - ZONE_PAD;
  const right = Math.max(...memberFrames.map((f) => f.x + f.width)) + ZONE_PAD;

  return canvasToDisplay(
    { x: left, y: container.y, width: right - left, height: container.maxHeight },
    scale
  );
}

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
  onImageChange,
  previewUrl = null,
  overflowContainerId = null,
  textFrames,
  hovered = null,
}: PlaceholderOverlayProps) {
  const items: OverlayItem[] = [];

  variant.inputs.forEach((input, index) => {
    if (!input.frame) return;
    items.push({
      key: `text-${input.id}`,
      kind: 'text',
      id: input.id,
      rect: canvasToDisplay(textFrames?.[input.id] ?? input.frame, scale),
      label: resolveInputLabel(input, index),
      editable: isEditable(input),
      hidable: input.hidable,
      hidden: formState[input.id]?.hidden ?? false,
      active: active?.kind === 'text' && active.id === input.id,
      hovered: hovered?.kind === 'text' && hovered.id === input.id,
      error: overflowContainerId != null && input.containerId === overflowContainerId,
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
      hovered: hovered?.kind === 'image' && hovered.id === input.id,
    });
  });

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Layer 0 — container zones ("smart text areas"): member texts reflow
          within them at render time, so the zone marks where the flow may
          extend. Drawn with the highlight toggle; forced (red) when the last
          render failed with that container's overflow. */}
      {variant.containers.map((container) => {
        const isOverflowing = overflowContainerId === container.id;
        if (!showBorders && !isOverflowing) return null;
        const rect = containerZoneRect(container, variant, scale);
        if (!rect) return null;
        return (
          <div
            key={`zone-${container.id}`}
            className={`pointer-events-none absolute rounded border border-dashed ${
              isOverflowing ? 'border-danger bg-danger/5' : 'border-info/60 bg-info/5'
            }`}
            style={{
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
            }}
            aria-hidden="true"
          />
        );
      })}

      {/* Layer 1 — boundary boxes (decorative). Shown only when the highlight
          toggle is on (or this box is being edited); the hatched fill then marks
          hidden slots. When highlight is off, no borders at all — hidden state is
          conveyed solely by the eye icon. Overflowing container members are
          always shown, in the error treatment. */}
      {items.map((item) =>
        showBorders || item.active || item.hovered || item.error ? (
          <PlaceholderBox
            key={`box-${item.key}`}
            rect={item.rect}
            active={item.active}
            hovered={item.hovered}
            readOnly={!item.editable}
            hidden={item.hidden}
            error={item.error}
            label={item.label}
          />
        ) : null
      )}

      {/* Layer 1.5 — the draggable pictures. Above the decorative boxes (so a
          neighbour's border never eats the grab area) but below the tool
          clusters, which must stay clickable over a picture. */}
      {variant.imageInputs.map((input, index) => {
        const state = imageState[input.id];
        if (!input.frame || !state?.image || state.hidden) return null;

        return (
          <ImagePlacementGhost
            key={`ghost-${input.id}`}
            input={input}
            frame={input.frame}
            rect={canvasToDisplay(input.frame, scale)}
            scale={scale}
            state={state}
            label={resolveImageLabel(input, index)}
            previewUrl={previewUrl}
            onChange={(partial) => onImageChange(input.id, partial)}
            onSelect={() => onSelect({ kind: 'image', id: input.id })}
          />
        );
      })}

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
