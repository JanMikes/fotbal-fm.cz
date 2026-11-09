/**
 * Repeatable rows (WBoost 2026-11, container-rows plan P4/P5) — the pure core
 * of the mfkfm port.
 *
 * WBoost lists a repeatable row ONCE (the template row: its members are
 * ordinary `inputs` / `imageInputs` / `shapeInputs`) plus, per row slot up to
 * `max`, the id each member carries in that slot (`slots[k].ids`). We
 * materialise every slot here exactly like the WBoost fill page does
 * server-side ({@link expandRepeatableRows}): a slot is a copy of the template
 * row's fields under its slot ids, one designed pitch lower. Everything
 * downstream (form state, image state, overlay boxes, the reflow mirror, the
 * saved state) then simply keys by slot id — and an old saved state that
 * still holds the ids of hand-numbered rows ("Střelec 3") maps onto its slot
 * for free, because merged rows KEEP those ids as their slot ids.
 *
 * The count of shown rows is separate state (`rowCounts`); slots at or
 * beyond it are inactive (hidden). The render body carries them in `rows`
 * ({@link buildRowsBody}) — keyed by the TEMPLATE member ids, the list
 * length being the count — and never in `inputs` / `images` /
 * `shapeColors` (WBoost answers `ambiguous_row_value` otherwise).
 *
 * Pure + client-safe.
 */

import type {
  ImageFrameDTO,
  RenderImageValue,
  RenderInputValue,
  RenderRow,
  RenderRows,
  RepeatableRowDTO,
  RowSlotRef,
  TemplateContainerDTO,
  TemplateVariantDTO,
} from './api-types';
import { defaultImageSlotState, type ImageSlotState } from './field-rules-image';
import type { InputFieldState } from './field-rules';

// ---------------------------------------------------------------------------
// Expansion
// ---------------------------------------------------------------------------

function translated(frame: ImageFrameDTO | null, dy: number): ImageFrameDTO | null {
  return frame ? { ...frame, y: frame.y + dy } : null;
}

/** The row container + every container nested in it (cycle-safe), in walk order. */
function treeIds(byId: Map<string, TemplateContainerDTO>, rootId: string): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    if (out.includes(id) || !byId.has(id)) return;
    out.push(id);
    for (const child of byId.get(id)!.memberContainerIds ?? []) walk(child);
  };
  walk(rootId);
  return out;
}

/** The top-level container whose tree holds `id` (the id the overflow 400 reports). */
export function rootOf(containers: TemplateContainerDTO[], id: string): TemplateContainerDTO | null {
  let current = id;
  const seen = new Set<string>();
  for (;;) {
    if (seen.has(current)) return null;
    seen.add(current);
    const parent = containers.find((c) => c.id !== current && (c.memberContainerIds ?? []).includes(current));
    if (!parent) return containers.find((c) => c.id === current) ?? null;
    current = parent.id;
  }
}

/**
 * Every slot of every repeatable row materialised as fields of the variant
 * (see the module docblock). The designed geometry mirrors WBoost's
 * `RepeatableRows::expand`: slot k sits `k × pitch` below the template row
 * (pitch = the row's designed extent + the parent's `gap`, else the designed
 * gap to the next item, else 0) and the parent's items below the row move
 * down by `(max − 1) × pitch` so the designed flow order stays true. Without
 * per-row frames from the API the boxes are an estimate — the server preview
 * is authoritative.
 *
 * Idempotent: an expanded variant (or one without rows) comes back as is.
 */
export function expandRepeatableRows(variant: TemplateVariantDTO): TemplateVariantDTO {
  const rows = variant.repeatableRows ?? [];
  if (rows.length === 0) return variant;
  if ([...variant.inputs, ...variant.imageInputs].some((field) => field.rowSlot)) return variant;

  let inputs = [...variant.inputs];
  let imageInputs = [...variant.imageInputs];
  let shapeInputs = [...(variant.shapeInputs ?? [])];
  let containers = variant.containers.map((c) => ({ ...c }));

  for (const row of rows) {
    const byId = new Map(containers.map((c) => [c.id, c]));
    const rowContainer = byId.get(row.containerId);
    const parent = row.parentContainerId ? byId.get(row.parentContainerId) : undefined;
    const slots = [...row.slots].sort((a, b) => a.index - b.index);
    if (!rowContainer || slots.length === 0) continue;

    const tree = treeIds(byId, row.containerId);
    const treeSet = new Set(tree);
    const textIds = new Set(tree.flatMap((id) => byId.get(id)!.memberInputIds));
    const imageIds = new Set(tree.flatMap((id) => byId.get(id)!.memberImageInputIds ?? []));
    const shapeIds = new Set(row.members.filter((m) => m.kind === 'shape').map((m) => m.id));

    const memberFrames = [
      ...inputs.filter((i) => textIds.has(i.id)).map((i) => i.frame),
      ...imageInputs.filter((i) => imageIds.has(i.id)).map((i) => i.frame),
      ...shapeInputs.filter((s) => shapeIds.has(s.id)).map((s) => s.frame),
    ].filter((frame): frame is ImageFrameDTO => frame != null);
    if (memberFrames.length === 0) continue;
    const top = Math.min(...memberFrames.map((f) => f.y));
    const bottom = Math.max(...memberFrames.map((f) => f.y + f.height));

    // The gap after the row: the parent's uniform gap, else the designed gap
    // to the next item of the parent flow, else 0.
    let gapAfter = 0;
    if (parent && typeof parent.gap === 'number' && Number.isFinite(parent.gap) && parent.gap >= 0) {
      gapAfter = parent.gap;
    } else if (parent) {
      const nextTops = [
        ...parent.memberInputIds.map((id) => inputs.find((i) => i.id === id)?.frame?.y),
        ...(parent.memberContainerIds ?? [])
          .filter((id) => id !== row.containerId)
          .flatMap((id) => treeIds(byId, id).flatMap((cid) => byId.get(cid)!.memberInputIds))
          .map((id) => inputs.find((i) => i.id === id)?.frame?.y),
      ].filter((y): y is number => typeof y === 'number' && y >= bottom - 0.5);
      if (nextTops.length > 0) gapAfter = Math.max(0, Math.min(...nextTops) - bottom);
    }
    const pitch = Math.max(1, bottom - top + gapAfter);
    const extra = (slots.length - 1) * pitch;

    // Make room below the row inside its top-level tree (designed order only;
    // flowed members are reflowed anyway).
    const root = rootOf(containers, row.containerId);
    if (root && extra > 0) {
      const rootTree = new Set(treeIds(byId, root.id));
      const shifted = new Set(
        [...rootTree].filter((id) => !treeSet.has(id)).flatMap((id) => byId.get(id)!.memberInputIds)
      );
      inputs = inputs.map((input) =>
        shifted.has(input.id) && input.frame && input.frame.y >= bottom - 0.5
          ? { ...input, frame: translated(input.frame, extra) }
          : input
      );
    }

    const slotRef = (slot: number, memberId: string): RowSlotRef => ({ rowId: row.containerId, slot, memberId });
    const mapContainerId = (ids: Record<string, string>, slotContainerId: string, id: string | null | undefined) =>
      id == null ? null : id === row.containerId ? slotContainerId : (ids[id] ?? null);

    // Slot 0 = the template row itself: tag its fields.
    inputs = inputs.map((i) => (textIds.has(i.id) ? { ...i, rowSlot: slotRef(0, i.id) } : i));
    imageInputs = imageInputs.map((i) => (imageIds.has(i.id) ? { ...i, rowSlot: slotRef(0, i.id) } : i));
    shapeInputs = shapeInputs.map((s) => (shapeIds.has(s.id) ? { ...s, rowSlot: slotRef(0, s.id) } : s));
    containers = containers.map((c) => (treeSet.has(c.id) ? { ...c, rowSlot: slotRef(0, c.id) } : c));

    const copies = { inputs: [] as typeof inputs, images: [] as typeof imageInputs, shapes: [] as typeof shapeInputs, containers: [] as typeof containers };
    for (const slot of slots.slice(1)) {
      const dy = slot.index * pitch;
      const ids = slot.ids;
      for (const input of variant.inputs) {
        if (!textIds.has(input.id) || !ids[input.id]) continue;
        const designed = inputs.find((i) => i.id === input.id)!;
        copies.inputs.push({
          ...designed,
          id: ids[input.id],
          frame: translated(designed.frame, dy),
          containerId: mapContainerId(ids, slot.containerId, designed.containerId) ?? designed.containerId,
          layerIndex: designed.layerIndex,
          rowSlot: slotRef(slot.index, input.id),
        });
      }
      for (const image of variant.imageInputs) {
        if (!imageIds.has(image.id) || !ids[image.id]) continue;
        copies.images.push({
          ...image,
          id: ids[image.id],
          frame: translated(image.frame, dy),
          containerId: mapContainerId(ids, slot.containerId, image.containerId ?? null),
          rowSlot: slotRef(slot.index, image.id),
        });
      }
      for (const shape of variant.shapeInputs ?? []) {
        if (!shapeIds.has(shape.id) || !ids[shape.id]) continue;
        copies.shapes.push({ ...shape, id: ids[shape.id], frame: translated(shape.frame, dy), rowSlot: slotRef(slot.index, shape.id) });
      }
      for (const containerId of tree) {
        const container = byId.get(containerId)!;
        const id = mapContainerId(ids, slot.containerId, containerId);
        if (!id) continue;
        copies.containers.push({
          ...container,
          id,
          y: container.y + dy,
          memberInputIds: container.memberInputIds.map((m) => ids[m]).filter((m): m is string => !!m),
          memberImageInputIds: (container.memberImageInputIds ?? []).map((m) => ids[m]).filter((m): m is string => !!m),
          memberContainerIds: (container.memberContainerIds ?? [])
            .map((m) => mapContainerId(ids, slot.containerId, m))
            .filter((m): m is string => !!m),
          repeat: null,
          rowSlot: slotRef(slot.index, containerId),
        });
      }
    }

    // Copies sit right after the template row's last field (labels / layers order).
    const insertAfter = <T extends { id: string }>(list: T[], members: Set<string>, extraItems: T[]): T[] => {
      if (extraItems.length === 0) return list;
      const last = list.reduce((at, item, index) => (members.has(item.id) ? index : at), -1);
      return last < 0 ? [...list, ...extraItems] : [...list.slice(0, last + 1), ...extraItems, ...list.slice(last + 1)];
    };
    inputs = insertAfter(inputs, textIds, copies.inputs);
    imageInputs = insertAfter(imageInputs, imageIds, copies.images);
    shapeInputs = insertAfter(shapeInputs, shapeIds, copies.shapes);
    containers = insertAfter(containers, treeSet, copies.containers);

    // The slot containers flow in the parent right after the template row.
    if (parent) {
      const slotContainerIds = slots.slice(1).map((slot) => slot.containerId);
      containers = containers.map((c) => {
        if (c.id !== parent.id) return c;
        const list = (c.memberContainerIds ?? []).filter((id) => !slotContainerIds.includes(id));
        const at = list.indexOf(row.containerId);
        return {
          ...c,
          memberContainerIds: at < 0 ? [...list, ...slotContainerIds] : [...list.slice(0, at + 1), ...slotContainerIds, ...list.slice(at + 1)],
        };
      });
    }
  }

  return { ...variant, inputs, imageInputs, shapeInputs, containers };
}

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

/** A requested count clamped to the row's [min, max]; junk → the default (WBoost's rule). */
export function clampRowCount(row: Pick<RepeatableRowDTO, 'repeat'>, value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  const count = Number.isFinite(parsed) ? Math.trunc(parsed) : row.repeat.default;
  return Math.max(row.repeat.min || 1, Math.min(row.repeat.max || 1, count || 1));
}

/** Every row at its `default` count (a fresh fill). */
export function defaultRowCounts(rows: RepeatableRowDTO[] | undefined): Record<string, number> {
  return Object.fromEntries((rows ?? []).map((row) => [row.containerId, clampRowCount(row, row.repeat.default)]));
}

/**
 * Counts for a restored fill: a stored count wins (clamped). Without one (a
 * record from before rows), a value addressed to slot k by its slot id —
 * typically an old hand-numbered row's id — shows at least k + 1 rows, never
 * fewer than the default (WBoost's own inference).
 */
export function inferRowCounts(
  rows: RepeatableRowDTO[] | undefined,
  saved: Record<string, number> | null | undefined,
  presentIds: Iterable<string>
): Record<string, number> {
  const present = new Set(presentIds);
  const counts: Record<string, number> = {};
  for (const row of rows ?? []) {
    const stored = saved?.[row.containerId];
    if (typeof stored === 'number') {
      counts[row.containerId] = clampRowCount(row, stored);
      continue;
    }
    let count = row.repeat.default;
    for (const slot of row.slots) {
      if (slot.index === 0) continue;
      if (Object.values(slot.ids).some((id) => present.has(id))) count = Math.max(count, slot.index + 1);
    }
    counts[row.containerId] = clampRowCount(row, count);
  }
  return counts;
}

/** Every id (fields + slot containers) of the slots at or beyond each row's count. */
export function inactiveRowIds(rows: RepeatableRowDTO[] | undefined, counts: Record<string, number>): Set<string> {
  const ids = new Set<string>();
  for (const row of rows ?? []) {
    const count = clampRowCount(row, counts[row.containerId] ?? row.repeat.default);
    for (const slot of row.slots) {
      if (slot.index < count) continue;
      ids.add(slot.containerId);
      Object.values(slot.ids).forEach((id) => ids.add(id));
    }
  }
  return ids;
}

/** Which row / slot / role (template member id) a slot id belongs to. */
export function rowOfId(
  rows: RepeatableRowDTO[] | undefined,
  id: string
): { row: RepeatableRowDTO; slot: number; role: string } | null {
  for (const row of rows ?? []) {
    for (const slot of row.slots) {
      for (const [role, slotId] of Object.entries(slot.ids)) {
        if (slotId === id) return { row, slot: slot.index, role };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Add / remove / reorder (WBoost assets/controllers/fill_rows.js semantics)
// ---------------------------------------------------------------------------

export type RowAction = 'add' | 'remove' | 'up' | 'down';

/** Is `action` allowed on `slot` of a row showing `count` rows? (The height gate is the caller's.) */
export function canApplyRowAction(row: RepeatableRowDTO, count: number, action: RowAction, slot: number | null = null): boolean {
  const isSlot = Number.isInteger(slot) && slot !== null;
  switch (action) {
    case 'add':
      return count < row.repeat.max;
    case 'remove':
      return count > row.repeat.min && isSlot && slot >= 0 && slot < count;
    case 'up':
      return isSlot && slot > 0 && slot < count;
    case 'down':
      return isSlot && slot >= 0 && slot < count - 1;
    default:
      return false;
  }
}

export interface RowPlan {
  count: number;
  /** target slot → source slot (null = reset to pristine); other slots keep their values. */
  sources: Map<number, number | null>;
}

/**
 * add: one more row (it shows what its slot holds — pristine, since a
 * remove always resets the slot it frees); remove row i: rows i+1… shift up,
 * the freed last slot resets; up / down: swap two rows.
 */
export function planRowAction(row: RepeatableRowDTO, count: number, action: RowAction, slot: number | null = null): RowPlan | null {
  if (!canApplyRowAction(row, count, action, slot)) return null;
  const sources = new Map<number, number | null>();
  if (action === 'add') return { count: count + 1, sources };
  if (action === 'remove') {
    for (let target = slot!; target < count - 1; target++) sources.set(target, target + 1);
    sources.set(count - 1, null);
    return { count: count - 1, sources };
  }
  const other = action === 'up' ? slot! - 1 : slot! + 1;
  sources.set(slot!, other);
  sources.set(other, slot!);
  return { count, sources };
}

/** The fill state a row action permutes (all maps keyed by slot id). */
export interface RowFillState {
  formState: Record<string, InputFieldState>;
  /** variantId (or any surface key) → slot id → picture state. */
  imageStates: Record<string, Record<string, ImageSlotState>>;
  shapeColors: Record<string, string>;
}

function roleKind(row: RepeatableRowDTO, role: string): 'text' | 'image' | 'shape' | 'container' {
  if (role === row.containerId) return 'container';
  return row.members.find((m) => m.id === role)?.kind ?? 'container';
}

function cloneValue<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/**
 * Apply a plan: every slot id of a target slot takes the value its role has
 * in the source slot (or the pristine value). Pristine = the template row's
 * sample for a text (`pristine.text(memberId)`), "not hidden" for a
 * container, no picture / neutral placement for an image slot, the designed
 * colour for a shape. Returns NEW maps.
 */
export function applyRowPlan(
  state: RowFillState,
  row: RepeatableRowDTO,
  plan: RowPlan,
  pristine: { text: (memberId: string) => InputFieldState }
): RowFillState {
  const formState = { ...state.formState };
  const imageStates = Object.fromEntries(Object.entries(state.imageStates).map(([key, map]) => [key, { ...map }]));
  const shapeColors = { ...state.shapeColors };
  const slotIds = (slot: number) => row.slots.find((s) => s.index === slot)?.ids ?? {};

  for (const [target, source] of plan.sources) {
    const targetIds = slotIds(target);
    const sourceIds = source === null ? null : slotIds(source);
    for (const role of Object.keys(slotIds(0))) {
      const to = targetIds[role];
      if (!to) continue;
      const from = sourceIds?.[role];
      switch (roleKind(row, role)) {
        case 'text':
          formState[to] = from && state.formState[from] ? cloneValue(state.formState[from]) : pristine.text(role);
          break;
        case 'container':
          if (from && state.formState[from]) formState[to] = cloneValue(state.formState[from]);
          else delete formState[to];
          break;
        case 'image':
          for (const [key, map] of Object.entries(state.imageStates)) {
            if (!(to in map) && !(from && from in map)) continue;
            imageStates[key][to] = from && map[from] ? cloneValue(map[from]) : defaultImageSlotState();
          }
          break;
        case 'shape':
          if (from && state.shapeColors[from]) shapeColors[to] = state.shapeColors[from];
          else delete shapeColors[to];
          break;
      }
    }
  }

  return { formState, imageStates, shapeColors };
}

// ---------------------------------------------------------------------------
// Render body + history
// ---------------------------------------------------------------------------

/**
 * Move every repeatable-row value out of the flat maps (built over the
 * expanded variant, i.e. keyed by slot ids) into `rows`: for each row, one
 * object per SHOWN slot keyed by the template member ids. Slot ids of every
 * slot are removed from the flat maps (WBoost's `ambiguous_row_value`); only
 * the row's declared members are sent (`unknown_row_input` otherwise).
 */
export function buildRowsBody(
  rows: RepeatableRowDTO[] | undefined,
  counts: Record<string, number>,
  flat: {
    inputs: Record<string, RenderInputValue>;
    images: Record<string, RenderImageValue>;
    shapeColors: Record<string, string>;
  }
): {
  inputs: Record<string, RenderInputValue>;
  images: Record<string, RenderImageValue>;
  shapeColors: Record<string, string>;
  rows: RenderRows;
} {
  const inputs = { ...flat.inputs };
  const images = { ...flat.images };
  const shapeColors = { ...flat.shapeColors };
  const body: RenderRows = {};

  for (const row of rows ?? []) {
    const count = clampRowCount(row, counts[row.containerId] ?? row.repeat.default);
    const members = new Map(row.members.map((m) => [m.id, m.kind]));
    const list: RenderRow[] = [];
    for (const slot of [...row.slots].sort((a, b) => a.index - b.index)) {
      const entry: RenderRow = {};
      for (const [role, id] of Object.entries(slot.ids)) {
        const kind = members.get(role);
        const source = kind === 'image' ? images : kind === 'shape' ? shapeColors : inputs;
        const value = source[id];
        if (slot.index < count && kind && value !== undefined && !(kind === 'shape' && value === '')) {
          entry[role] = value as RenderInputValue;
        }
        delete inputs[id];
        delete images[id];
        delete shapeColors[id];
      }
      if (slot.index < count) list.push(entry);
    }
    body[row.containerId] = list.slice(0, count);
  }

  return { inputs, images, shapeColors, rows: body };
}

/** The slot ids of the unused rows of a group's per-dimension placements are dropped. */
export function dropInactive<T>(map: Record<string, T>, inactive: Set<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(map).filter(([id]) => !inactive.has(id)));
}

/**
 * A version's `fill.rows` (or any `rows` body) back onto the slot ids, ready
 * to merge into `fill.inputs` / `images` / `shapeColors`; `counts` = each
 * known row's list length (clamped). Unknown rows / members are ignored.
 */
export function flattenFillRows(
  rows: RepeatableRowDTO[] | undefined,
  fillRows: RenderRows | null | undefined
): {
  inputs: Record<string, RenderInputValue>;
  images: Record<string, RenderImageValue & { url?: string }>;
  shapeColors: Record<string, string>;
  counts: Record<string, number>;
} {
  const inputs: Record<string, RenderInputValue> = {};
  const images: Record<string, RenderImageValue & { url?: string }> = {};
  const shapeColors: Record<string, string> = {};
  const counts: Record<string, number> = {};

  for (const row of rows ?? []) {
    const list = fillRows?.[row.containerId];
    if (!Array.isArray(list)) continue;
    counts[row.containerId] = clampRowCount(row, list.length);
    list.forEach((entry, index) => {
      const slot = row.slots.find((s) => s.index === index);
      if (!slot || !entry || typeof entry !== 'object') return;
      for (const [role, value] of Object.entries(entry)) {
        const id = slot.ids[role];
        const kind = row.members.find((m) => m.id === role)?.kind;
        if (!id || !kind) continue;
        if (kind === 'image') images[id] = value as RenderImageValue & { url?: string };
        else if (kind === 'shape') {
          if (typeof value === 'string') shapeColors[id] = value;
        } else inputs[id] = value as RenderInputValue;
      }
    });
  }

  return { inputs, images, shapeColors, counts };
}

/** "Řádek 2" — the 1-based row label of a slot. */
export function rowLabel(slot: number): string {
  return `Řádek ${slot + 1}`;
}

/** Czech "řádek / řádky / řádků". */
export function rowsWord(count: number): string {
  if (count === 1) return 'řádek';
  return count >= 2 && count <= 4 ? 'řádky' : 'řádků';
}
