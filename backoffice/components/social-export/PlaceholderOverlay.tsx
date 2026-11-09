'use client';

import { useMemo, useState } from 'react';
import ImagePlacementGhost from './ImagePlacementGhost';
import MoveHandle from './MoveHandle';
import PlaceholderBox from './PlaceholderBox';
import PlaceholderTools from './PlaceholderTools';
import { resolveInputLabel, isEditable, type InputFieldState } from '@/lib/social-export/field-rules';
import { resolveImageLabel, type ImageSlotState } from '@/lib/social-export/field-rules-image';
import { resolveShapeLabel } from '@/lib/social-export/shape-colors';
import { canvasToDisplay, type DisplayRect } from '@/lib/social-export/geometry';
import { containerLabelOf, sheetOfField, type ContainerSheet } from '@/lib/social-export/container-sheets';
import { deltas } from '@/lib/social-export/element-move';
import type {
  ElementOffset,
  ElementOffsets,
  ImageFrameDTO,
  MovableElementDTO,
  TemplateContainerDTO,
  TemplateVariantDTO,
} from '@/lib/social-export/api-types';

/** Identifies which placeholder (or container sheet / movable element) a box belongs to. */
export type ActivePlaceholder =
  | { kind: 'text'; id: string }
  | { kind: 'image'; id: string }
  | { kind: 'shape'; id: string }
  /** A container sheet: ONE panel for every field of a top-level container. */
  | { kind: 'container'; id: string }
  /** The exact "Poloha" panel of a movable element. */
  | { kind: 'move'; id: string };

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
   * (`computeTextFrames`): measured heights + container reflow + moves.
   * Falls back to the designed frames for inputs missing from the map.
   */
  textFrames?: Record<string, ImageFrameDTO>;
  /**
   * Placeholder hovered in the layers panel — its box is drawn highlighted
   * regardless of the border toggle (a pointing gesture, not a hint).
   */
  hovered?: ActivePlaceholder | null;
  /** Ids of the unused repeatable-row slots: never drawn. */
  inactiveIds?: ReadonlySet<string>;
  /** Containers drawn as ONE box + ONE pencil (see container-sheets). */
  sheets?: ContainerSheet[];
  /** Elements the user may move, with their committed offsets. */
  movables?: MovableElementDTO[];
  offsets?: ElementOffsets;
  onOffsetChange?: (elementId: string, offset: ElementOffset | null) => void;
}

interface OverlayItem {
  key: string;
  kind: 'text' | 'image' | 'shape';
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
  /** Member of a container sheet: an outline only, the sheet owns the tools. */
  inSheet: boolean;
}

const TOOL = 30; // button diameter (px), matches PlaceholderTools
const TOOL_GAP = 4;
const EDGE = 2;
const ZONE_PAD = 4; // container zone horizontal padding around member frames (canvas px)
const NO_IDS: ReadonlySet<string> = new Set();

/**
 * The container ids of the tree rooted at `rootId` (the root + every
 * descendant reachable through `memberContainerIds`). The overflow 400 always
 * reports the TOP-LEVEL container, so highlighting must cover the whole tree.
 */
function containerTreeIds(variant: TemplateVariantDTO, rootId: string): Set<string> {
  const byId = new Map(variant.containers.map((c) => [c.id, c]));
  const ids = new Set<string>();
  const walk = (id: string) => {
    if (ids.has(id)) return;
    ids.add(id);
    for (const childId of byId.get(id)?.memberContainerIds ?? []) {
      if (byId.has(childId)) walk(childId);
    }
  };
  if (byId.has(rootId)) walk(rootId);
  return ids;
}

/**
 * A container's zone rect in display px: from its `y` down `maxHeight`,
 * horizontally spanning the designed frames of its whole TREE (direct members
 * plus nested children's members). Null when no frame can be resolved
 * (nothing to draw). Only drawn for top-level containers — a nested one has
 * no bound of its own.
 */
function containerZoneRect(
  container: TemplateContainerDTO,
  variant: TemplateVariantDTO,
  scale: number,
  shift: [number, number]
): DisplayRect | null {
  const memberFrames = [...containerTreeIds(variant, container.id)]
    .flatMap((containerId) => {
      const entry = variant.containers.find((c) => c.id === containerId);
      return entry ? entry.memberInputIds : [];
    })
    .map((id) => variant.inputs.find((input) => input.id === id)?.frame)
    .filter((frame): frame is NonNullable<typeof frame> => frame != null);
  if (memberFrames.length === 0) return null;

  const left = Math.min(...memberFrames.map((f) => f.x)) - ZONE_PAD + shift[0];
  const right = Math.max(...memberFrames.map((f) => f.x + f.width)) + ZONE_PAD + shift[0];

  return canvasToDisplay(
    { x: left, y: container.y + shift[1], width: right - left, height: container.maxHeight },
    scale
  );
}

/** Position the tool cluster glued to the box's top-right, above when there's room. */
function clusterPosition(rect: DisplayRect, buttons: number, stageWidth: number, stageHeight: number) {
  const clusterW = buttons * TOOL + (buttons - 1) * TOOL_GAP;
  const right = rect.left + rect.width;
  let left = right - clusterW;
  left = Math.min(Math.max(EDGE, left), Math.max(EDGE, stageWidth - clusterW - EDGE));
  // Prefer just above the box; tuck inside the top edge when there's no room.
  let top = rect.top - TOOL - TOOL_GAP;
  if (top < EDGE) top = rect.top + TOOL_GAP;
  top = Math.min(Math.max(EDGE, top), Math.max(EDGE, stageHeight - TOOL - EDGE));
  return { left, top };
}

function shifted(frame: ImageFrameDTO, delta: [number, number] | undefined): ImageFrameDTO {
  return delta ? { ...frame, x: frame.x + delta[0], y: frame.y + delta[1] } : frame;
}

/** The bounding box of display rects, or null. */
function union(rects: DisplayRect[]): DisplayRect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.left + r.width));
  const bottom = Math.max(...rects.map((r) => r.top + r.height));
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Absolutely-positioned overlay (sized to the rendered image rect) drawn in
 * layers: container zones, the dashed boundary boxes, the draggable pictures,
 * and on top the interactive tool clusters (pencil / eye / move), so every
 * tool paints above all boxes' borders.
 *
 * A top-level container with ≥ 2 editable fields (a "sheet") is ONE box
 * around its members with ONE pencil — its members are thin outlines without
 * tools (WBoost P1). Movable elements get a ✥ / ↕ / ↔ handle on their own
 * cluster, or a move-only box when they have no editable box (decorative
 * image, plain shape, a container without a sheet). While a handle is
 * dragged the element's boxes follow the pointer; the render follows on
 * release. Unused repeatable-row slots are never drawn.
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
  inactiveIds = NO_IDS,
  sheets = [],
  movables = [],
  offsets = {},
  onOffsetChange,
}: PlaceholderOverlayProps) {
  // The live drag of a move handle: that element's boxes follow it.
  const [dragPreview, setDragPreview] = useState<{ id: string; offset: ElementOffset } | null>(null);

  const committedMoves = useMemo(() => deltas(variant.containers, offsets), [variant.containers, offsets]);
  const previewMoves = useMemo(() => {
    if (!dragPreview) return {};
    const committed = offsets[dragPreview.id] ?? { x: 0, y: 0 };
    return deltas(variant.containers, {
      [dragPreview.id]: { x: dragPreview.offset.x - committed.x, y: dragPreview.offset.y - committed.y },
    });
  }, [dragPreview, offsets, variant.containers]);

  /** A text's live frame (layout = measured + reflowed + moved) plus the drag delta. */
  const textRect = (id: string, frame: ImageFrameDTO) =>
    canvasToDisplay(shifted(textFrames?.[id] ?? shifted(frame, committedMoves[id]), previewMoves[id]), scale);
  /** An image / shape: its designed frame + committed and live moves. */
  const fieldRect = (id: string, frame: ImageFrameDTO) =>
    canvasToDisplay(shifted(shifted(frame, committedMoves[id]), previewMoves[id]), scale);

  const items: OverlayItem[] = [];

  // The overflow 400 reports the TOP-LEVEL container — members of its whole
  // nested tree share the blame highlight.
  const overflowTree =
    overflowContainerId != null ? containerTreeIds(variant, overflowContainerId) : null;

  variant.inputs.forEach((input, index) => {
    if (!input.frame || inactiveIds.has(input.id)) return;
    items.push({
      key: `text-${input.id}`,
      kind: 'text',
      id: input.id,
      rect: textRect(input.id, input.frame),
      label: resolveInputLabel(input, index),
      editable: isEditable(input),
      hidable: input.hidable,
      hidden: formState[input.id]?.hidden ?? false,
      active: active?.kind === 'text' && active.id === input.id,
      hovered: hovered?.kind === 'text' && hovered.id === input.id,
      error: overflowTree != null && input.containerId != null && overflowTree.has(input.containerId),
      inSheet: sheetOfField(sheets, input.id) != null,
    });
  });

  variant.imageInputs.forEach((input, index) => {
    if (!input.frame || inactiveIds.has(input.id)) return;
    items.push({
      key: `image-${input.id}`,
      kind: 'image',
      id: input.id,
      rect: fieldRect(input.id, input.frame),
      label: resolveImageLabel(input, index),
      editable: true,
      hidable: input.hidable,
      hidden: imageState[input.id]?.hidden ?? false,
      active: active?.kind === 'image' && active.id === input.id,
      hovered: hovered?.kind === 'image' && hovered.id === input.id,
      inSheet: sheetOfField(sheets, input.id) != null,
    });
  });

  // Recolourable shapes: a colour field, never hidable.
  (variant.shapeInputs ?? []).forEach((shape, index) => {
    if (!shape.frame || inactiveIds.has(shape.id)) return;
    items.push({
      key: `shape-${shape.id}`,
      kind: 'shape',
      id: shape.id,
      rect: fieldRect(shape.id, shape.frame),
      label: resolveShapeLabel(shape, index),
      editable: true,
      hidable: false,
      hidden: false,
      active: active?.kind === 'shape' && active.id === shape.id,
      hovered: hovered?.kind === 'shape' && hovered.id === shape.id,
      inSheet: sheetOfField(sheets, shape.id) != null,
    });
  });

  // One box per container sheet: the union of its SHOWN members' boxes.
  const sheetBoxes = sheets
    .map((sheet, index) => {
      const members = items.filter(
        (item) => sheet.textIds.includes(item.id) || sheet.imageIds.includes(item.id) || sheet.shapeIds.includes(item.id)
      );
      const rect = union(members.map((m) => m.rect));
      if (!rect) return null;
      const pad = 4;
      return {
        sheet,
        label: containerLabelOf(sheet, variant, index),
        rect: { left: rect.left - pad, top: rect.top - pad, width: rect.width + 2 * pad, height: rect.height + 2 * pad },
        active: active?.kind === 'container' && active.id === sheet.id,
        hidden: sheet.hidable && (formState[sheet.id]?.hidden ?? false),
        error: overflowContainerId === sheet.id,
      };
    })
    .filter((box): box is NonNullable<typeof box> => box != null);

  // Movable elements: a handle on an existing cluster, else a move-only box.
  const movableById = new Map(movables.filter((m) => m.vertical || m.horizontal).map((m) => [m.id, m]));
  const moveOnly = [...movableById.values()]
    .filter((element) => !items.some((i) => i.id === element.id && !i.inSheet) && !sheetBoxes.some((b) => b.sheet.id === element.id))
    .map((element) => {
      let rect: DisplayRect | null = null;
      if (element.kind === 'container') {
        const tree = containerTreeIds(variant, element.id);
        rect = union(
          items
            .filter((item) => {
              const input = variant.inputs.find((i) => i.id === item.id);
              const image = variant.imageInputs.find((i) => i.id === item.id);
              const containerId = input?.containerId ?? image?.containerId ?? null;
              return containerId != null && tree.has(containerId);
            })
            .map((item) => item.rect)
        );
      }
      if (!rect && element.frame) rect = fieldRect(element.id, element.frame);
      return rect ? { element, rect } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  const moveHandle = (id: string, label: string) => {
    const element = movableById.get(id);
    if (!element || !onOffsetChange) return null;
    return (
      <MoveHandle
        element={element}
        label={label}
        scale={scale}
        offset={offsets[id] ?? { x: 0, y: 0 }}
        active={active?.kind === 'move' && active.id === id}
        onPreview={(offset) => setDragPreview(offset ? { id, offset } : null)}
        onCommit={(offset) => onOffsetChange(id, offset.x === 0 && offset.y === 0 ? null : offset)}
        onOpen={() => onSelect({ kind: 'move', id })}
      />
    );
  };

  const dragging = dragPreview?.id ?? null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Layer 0 — container zones ("smart text areas"): member texts reflow
          within them at render time, so the zone marks where the flow may
          extend. Drawn with the highlight toggle; forced (red) when the last
          render failed with that container's overflow. */}
      {variant.containers.map((container) => {
        // Nested containers have no bound of their own — only top-level zones
        // are meaningful to draw.
        if (container.nested === true) return null;
        const isOverflowing = overflowContainerId === container.id;
        if (!showBorders && !isOverflowing) return null;
        const own = offsets[container.id];
        const live = dragPreview?.id === container.id ? dragPreview.offset : own;
        const rect = containerZoneRect(container, variant, scale, live ? [live.x, live.y] : [0, 0]);
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
          hidden slots. Members of a container sheet are thin outlines; the
          sheet's own box carries the name + tools. A box being dragged is
          always shown. */}
      {items.map((item) =>
        showBorders || item.active || item.hovered || item.error || dragging === item.id ? (
          item.inSheet ? (
            <div
              key={`box-${item.key}`}
              className={`pointer-events-none absolute rounded-sm border ${
                item.error ? 'border-danger' : item.hidden ? 'border-dashed border-text-muted' : 'border-dashed border-accent/60'
              } ${item.active || item.hovered ? 'bg-accent/10' : ''}`}
              style={{ left: `${item.rect.left}px`, top: `${item.rect.top}px`, width: `${item.rect.width}px`, height: `${item.rect.height}px` }}
              aria-hidden="true"
            />
          ) : (
            <PlaceholderBox
              key={`box-${item.key}`}
              rect={item.rect}
              active={item.active || dragging === item.id}
              hovered={item.hovered}
              readOnly={!item.editable}
              hidden={item.hidden}
              error={item.error}
              label={item.label}
            />
          )
        ) : null
      )}

      {sheetBoxes.map((box) =>
        showBorders || box.active || box.error || dragging === box.sheet.id ? (
          <PlaceholderBox
            key={`sheet-${box.sheet.id}`}
            rect={box.rect}
            active={box.active || dragging === box.sheet.id}
            hidden={box.hidden}
            error={box.error}
            label={box.label}
          />
        ) : null
      )}

      {moveOnly.map(({ element, rect }) =>
        showBorders || dragging === element.id || (active?.kind === 'move' && active.id === element.id) ? (
          <PlaceholderBox
            key={`move-${element.id}`}
            rect={rect}
            active={dragging === element.id || (active?.kind === 'move' && active.id === element.id)}
            readOnly
            label={element.name ?? 'Posunutelný prvek'}
          />
        ) : null
      )}

      {/* Layer 1.5 — the draggable pictures. Above the decorative boxes (so a
          neighbour's border never eats the grab area) but below the tool
          clusters, which must stay clickable over a picture. */}
      {variant.imageInputs.map((input, index) => {
        const state = imageState[input.id];
        if (!input.frame || !state?.image || state.hidden || inactiveIds.has(input.id)) return null;
        const frame = shifted(input.frame, committedMoves[input.id]);

        return (
          <ImagePlacementGhost
            key={`ghost-${input.id}`}
            input={input}
            frame={frame}
            rect={canvasToDisplay(frame, scale)}
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
      {items
        .filter((item) => !item.inSheet)
        .map((item) => {
          const move = moveHandle(item.id, item.label);
          const buttons = 1 + (move ? 1 : 0) + (item.hidable ? 1 : 0);
          const { left, top } = clusterPosition(item.rect, buttons, stageWidth, stageHeight);
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
              extra={move}
            />
          );
        })}

      {sheetBoxes.map((box) => {
        const move = moveHandle(box.sheet.id, box.label);
        const buttons = 1 + (move ? 1 : 0) + (box.sheet.hidable ? 1 : 0);
        const { left, top } = clusterPosition(box.rect, buttons, stageWidth, stageHeight);
        return (
          <PlaceholderTools
            key={`sheet-tools-${box.sheet.id}`}
            left={left}
            top={top}
            label={box.label}
            active={box.active}
            readOnly={false}
            hidable={box.sheet.hidable}
            hidden={box.hidden}
            onEdit={() => onSelect({ kind: 'container', id: box.sheet.id })}
            onToggleHidden={() => onToggleHidden({ kind: 'container', id: box.sheet.id })}
            extra={move}
          />
        );
      })}

      {moveOnly.map(({ element, rect }) => {
        const label = element.name ?? 'Posunutelný prvek';
        const { left, top } = clusterPosition(rect, 1, stageWidth, stageHeight);
        return (
          <PlaceholderTools
            key={`move-tools-${element.id}`}
            left={left}
            top={top}
            label={label}
            active={active?.kind === 'move' && active.id === element.id}
            readOnly
            hidable={false}
            hidden={false}
            showEdit={false}
            onEdit={() => onSelect({ kind: 'move', id: element.id })}
            onToggleHidden={() => undefined}
            extra={moveHandle(element.id, label)}
          />
        );
      })}
    </div>
  );
}
