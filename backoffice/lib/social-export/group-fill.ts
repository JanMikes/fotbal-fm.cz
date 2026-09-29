/**
 * Fill-surface helpers shared by the single-variant and the GROUP editor.
 *
 * A WBoost template GROUP is one design in several dimensions, filled ONCE:
 * member dimensions share their input ids, so the TEXT state is one map for
 * every dimension. Image slots share their ids too, but only the PICTURE is
 * shared — its placement (zoom / pan / rotation) is per dimension, because a
 * crop that works in 1:1 rarely works in 9:16. The editor therefore keeps one
 * `ImageState` per dimension and keeps the picked picture + hide flag in sync
 * across them. A single variant is simply a surface with one dimension.
 *
 * Client-safe (pure functions).
 */

import type {
  GroupPlacements,
  ExportVersionFillDTO,
  ImageInputDTO,
  RenderImageValue,
  RenderInputValue,
  TemplateInputDTO,
  TemplateVariantDTO,
} from './api-types';
import { buildRenderImages, defaultImageSlotState, type ImageSlotState } from './field-rules-image';
import { buildRenderInputs, initialFieldState, type InputFieldState } from './field-rules';
import { applySavedForm, sanitizeSlotState, type StoredImageSlotState } from './saved-state';
import { isStyled, normalizeRuns, plainText } from './rich-text';
import type { ListLineType } from './api-types';

export type ImageState = Record<string, ImageSlotState>;
/** variantId → that dimension's image state. */
export type DimensionImageStates = Record<string, ImageState>;

/** Placement fields — per dimension; everything else of a slot is shared. */
const PLACEMENT_KEYS = ['scale', 'offsetXRatio', 'offsetYRatio', 'rotation'] as const;

/**
 * The surface's text inputs: the union over its dimensions, first dimension
 * wins (labels, limits, options) — WBoost's group fill page rule.
 */
export function unionInputs(members: TemplateVariantDTO[]): TemplateInputDTO[] {
  const seen = new Map<string, TemplateInputDTO>();
  for (const member of members) {
    for (const input of member.inputs) {
      if (!seen.has(input.id)) seen.set(input.id, input);
    }
  }
  return [...seen.values()];
}

/** The surface's image slots (union, first wins). */
export function unionImageInputs(members: TemplateVariantDTO[]): ImageInputDTO[] {
  const seen = new Map<string, ImageInputDTO>();
  for (const member of members) {
    for (const slot of member.imageInputs) {
      if (!seen.has(slot.id)) seen.set(slot.id, slot);
    }
  }
  return [...seen.values()];
}

/** Fresh form state: sample values, overridden by the match prefill. */
export function initSurfaceForm(
  inputs: TemplateInputDTO[],
  prefill: Record<string, string>
): Record<string, InputFieldState> {
  return Object.fromEntries(inputs.map((input) => [input.id, initialFieldState(input, prefill[input.id])]));
}

/** Fresh per-dimension image state (every slot empty, neutral placement). */
export function initDimensionImages(members: TemplateVariantDTO[]): DimensionImageStates {
  return Object.fromEntries(
    members.map((member) => [
      member.id,
      Object.fromEntries(member.imageInputs.map((slot) => [slot.id, defaultImageSlotState()])),
    ])
  );
}

/**
 * Apply an image-slot edit made in the ACTIVE dimension. Picking a picture
 * (which also resets the placement) or hiding the slot is shared by every
 * dimension that carries the slot; a pure placement edit (drag / zoom /
 * rotate) only touches the active dimension.
 */
export function applyImageChange(
  states: DimensionImageStates,
  members: TemplateVariantDTO[],
  activeId: string,
  slotId: string,
  partial: Partial<ImageSlotState>
): DimensionImageStates {
  const shared = 'image' in partial || 'hidden' in partial;
  const next: DimensionImageStates = { ...states };

  for (const member of members) {
    if (!shared && member.id !== activeId) continue;
    if (!member.imageInputs.some((slot) => slot.id === slotId)) continue;

    const current = next[member.id]?.[slotId] ?? defaultImageSlotState();
    // Other dimensions take only the shared part of a partial — unless the
    // partial is a new pick, whose neutral placement applies everywhere.
    const applied =
      member.id === activeId || 'image' in partial ? partial : pickShared(partial);

    next[member.id] = { ...(next[member.id] ?? {}), [slotId]: { ...current, ...applied } };
  }

  return next;
}

function pickShared(partial: Partial<ImageSlotState>): Partial<ImageSlotState> {
  const shared: Partial<ImageSlotState> = { ...partial };
  for (const key of PLACEMENT_KEYS) delete shared[key];
  return shared;
}

/** Which dimensions an image edit re-renders (placement edits: only the active one). */
export function dimensionsAffectedByImageChange(
  members: TemplateVariantDTO[],
  activeId: string,
  partial: Partial<ImageSlotState>
): string[] {
  return 'image' in partial || 'hidden' in partial ? members.map((member) => member.id) : [activeId];
}

/**
 * The WBoost group render body: shared `inputs`, the shared picks as `images`
 * (image id or `{ hide: true }` — no transform) and each dimension's placement
 * in `placements` (only the fields that slot allows, via buildRenderImages).
 */
export function buildGroupRenderBody(
  members: TemplateVariantDTO[],
  formState: Record<string, InputFieldState>,
  imageStates: DimensionImageStates
): {
  inputs: Record<string, RenderInputValue>;
  images: Record<string, RenderImageValue>;
  placements: GroupPlacements;
} {
  const inputs = buildRenderInputs(unionInputs(members), formState);
  const images: Record<string, RenderImageValue> = {};
  const placements: GroupPlacements = {};

  for (const member of members) {
    const perDimension = buildRenderImages(member.imageInputs, imageStates[member.id] ?? {});

    for (const [slotId, value] of Object.entries(perDimension)) {
      if (typeof value === 'string') {
        images[slotId] ??= value;
        continue;
      }

      if (value.hide) {
        images[slotId] ??= { hide: true };
        continue;
      }

      if (!value.imageId) continue;
      images[slotId] ??= value.imageId;

      const transform: GroupPlacements[string][string] = {};
      for (const key of PLACEMENT_KEYS) {
        const candidate = value[key];
        if (typeof candidate === 'number') transform[key] = candidate;
      }
      if (Object.keys(transform).length > 0) {
        placements[member.id] = { ...(placements[member.id] ?? {}), [slotId]: transform };
      }
    }
  }

  return { inputs, images, placements };
}

/**
 * A loaded export version (its fill in the render request shape, already
 * seeded against the current design by WBoost) → editor state. Inputs the
 * version does not address start from their sample text — exactly what the
 * render used for them — never from the match prefill.
 */
export function fillToEditorState(
  fill: ExportVersionFillDTO,
  members: TemplateVariantDTO[]
): { formState: Record<string, InputFieldState>; imageStates: DimensionImageStates } {
  const inputs = unionInputs(members);
  const base = initSurfaceForm(inputs, {});
  const loaded: Record<string, InputFieldState> = {};

  for (const input of inputs) {
    const value = fill.inputs?.[input.id];
    if (value === undefined) continue;
    loaded[input.id] = inputValueToState(value, base[input.id]);
  }

  const formState = applySavedForm(inputs, base, loaded);
  const imageStates = initDimensionImages(members);

  for (const member of members) {
    for (const slot of member.imageInputs) {
      const entry = fill.images?.[slot.id];
      if (entry === undefined) continue;

      const placement = fill.placements?.[member.id]?.[slot.id];
      const stored = imageValueToStored(entry, placement);
      if (stored) {
        imageStates[member.id][slot.id] = sanitizeSlotState(stored, slot.frame);
      }
    }
  }

  return { formState, imageStates };
}

function inputValueToState(value: RenderInputValue, fallback: InputFieldState): InputFieldState {
  if (typeof value === 'string') {
    return { value, hidden: false };
  }

  const hidden = value.hide === true;
  const fontFamily = typeof value.fontFamily === 'string' ? value.fontFamily : null;
  const font = fontFamily ? { fontFamily } : {};

  if ('runs' in value) {
    const runs = normalizeRuns(value.runs) ?? [];
    const text = plainText(runs);
    const lines = Array.isArray(value.lines) ? (value.lines as ListLineType[]) : null;
    return {
      value: text,
      hidden,
      ...(isStyled(runs) ? { runs } : {}),
      ...(lines ? { lines } : {}),
      ...font,
    };
  }

  // `{ hide }` / `{ fontFamily }` alone keeps the (sample) text.
  return {
    ...(typeof value.value === 'string' ? { value: value.value } : { value: fallback.value, runs: fallback.runs, lines: fallback.lines }),
    hidden,
    ...font,
  };
}

function imageValueToStored(
  entry: RenderImageValue & { url?: string },
  placement: GroupPlacements[string][string] | undefined
): StoredImageSlotState | null {
  if (typeof entry === 'string') return null; // no url → nothing to show; WBoost always sends objects

  const base = defaultImageSlotState();

  if (entry.hide === true) {
    return { ...base, hidden: true };
  }

  if (!entry.imageId || !entry.url) return null;

  const transform = placement ?? entry;

  return {
    ...base,
    image: { id: entry.imageId, url: entry.url },
    scale: transform.scale ?? base.scale,
    rotation: transform.rotation ?? base.rotation,
    offsetXRatio: transform.offsetXRatio,
    offsetYRatio: transform.offsetYRatio,
    ...(placement ? {} : { offsetX: entry.offsetX, offsetY: entry.offsetY }),
  };
}
