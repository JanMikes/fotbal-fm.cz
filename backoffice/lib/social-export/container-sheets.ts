/**
 * "One pencil per container" (WBoost container-rows plan P1, mirrored from
 * `src/Services/SocialNetwork/FillContainerSheets.php`): which containers of
 * a variant get ONE box + ONE pencil on the preview instead of a pencil per
 * member, and what the panel that pencil opens lists.
 *
 * Owners are the TOP-LEVEL containers ({@link PENCIL_LEVEL}) whose tree holds
 * at least {@link MIN_FIELDS} EDITABLE fields — an unlocked text or a
 * fillable (non-background) image slot, counted over the EXPANDED variant
 * (every repeatable-row slot, like WBoost) — so a single-text repeatable row
 * qualifies through its slots. Nested containers become sections; a
 * repeatable row's slots are sections carrying `row` ("Řádek n" with ↑ / ↓ /
 * −) and a `rowAdd` entry follows a row's last slot. Recolourable shapes of a
 * row slot are listed in that slot's section (shapes are no container
 * members in the listing otherwise).
 *
 * Pure + client-safe.
 */

import type { TemplateContainerDTO, TemplateVariantDTO } from './api-types';

/** Today: one sheet per top-level container (Jan's decision, 2026-11-09). */
export const PENCIL_LEVEL = 'top' as const;

/** A container with fewer editable fields keeps per-field pencils. */
export const MIN_FIELDS = 2;

export type SheetEntry =
  | { kind: 'field'; field: 'text' | 'image' | 'shape'; id: string; depth: number }
  | {
      kind: 'section';
      id: string;
      depth: number;
      name: string | null;
      hidable: boolean;
      /** A repeatable row's slot section. */
      row: { rowId: string; slot: number } | null;
    }
  | { kind: 'rowAdd'; rowId: string; depth: number };

export interface ContainerSheet {
  /** The owner (top-level) container id. */
  id: string;
  name: string | null;
  hidable: boolean;
  /** Every listed text of the tree (editable or not) — their boxes join the sheet's box. */
  textIds: string[];
  /** Every image slot of the tree. */
  imageIds: string[];
  /** Shapes of row slots in the tree. */
  shapeIds: string[];
  /** Every container id of the tree (the owner included). */
  containerIds: string[];
  /** The editable fields in panel order. */
  fieldIds: string[];
  entries: SheetEntry[];
  /** Repeatable rows inside the tree. */
  rowIds: string[];
}

/** Top-level = not referenced by another container and not flagged nested. */
function topLevel(containers: TemplateContainerDTO[]): TemplateContainerDTO[] {
  const claimed = new Set(
    containers.flatMap((c) => (c.memberContainerIds ?? []).filter((id) => id !== c.id))
  );
  return containers.filter((c) => !claimed.has(c.id) && c.nested !== true);
}

export function containerSheets(variant: TemplateVariantDTO, minFields: number = MIN_FIELDS): ContainerSheet[] {
  const byId = new Map<string, TemplateContainerDTO>();
  for (const container of variant.containers) if (!byId.has(container.id)) byId.set(container.id, container);
  const inputs = new Map(variant.inputs.map((input) => [input.id, input]));
  const images = new Map(variant.imageInputs.map((image) => [image.id, image]));
  const shapes = variant.shapeInputs ?? [];

  const isEditableText = (id: string) => {
    const input = inputs.get(id);
    return input != null && !input.locked;
  };
  const isEditableImage = (id: string) => {
    const image = images.get(id);
    return image != null && !image.isBackground;
  };

  // A slot container's shapes: the expanded shapes tagged with its row + slot.
  const slotShapes = (container: TemplateContainerDTO): string[] => {
    const ref = container.rowSlot;
    if (!ref || ref.memberId !== ref.rowId) return [];
    return shapes.filter((s) => s.rowSlot?.rowId === ref.rowId && s.rowSlot.slot === ref.slot).map((s) => s.id);
  };

  const sheets: ContainerSheet[] = [];
  for (const owner of topLevel(variant.containers)) {
    const sheet: ContainerSheet = {
      id: owner.id,
      name: owner.name ?? null,
      hidable: owner.hidable === true,
      textIds: [],
      imageIds: [],
      shapeIds: [],
      containerIds: [],
      fieldIds: [],
      entries: [],
      rowIds: [],
    };

    const treeTop = (container: TemplateContainerDTO, seen: Set<string>): number => {
      if (seen.has(container.id)) return Infinity;
      seen.add(container.id);
      const tops = [
        ...container.memberInputIds.map((id) => inputs.get(id)?.frame?.y ?? Infinity),
        ...(container.memberImageInputIds ?? []).map((id) => images.get(id)?.frame?.y ?? Infinity),
        ...(container.memberContainerIds ?? []).map((id) => {
          const child = byId.get(id);
          return child ? treeTop(child, seen) : Infinity;
        }),
      ];
      return tops.length ? Math.min(...tops) : Infinity;
    };

    const walk = (container: TemplateContainerDTO, depth: number, visiting: Set<string>) => {
      visiting.add(container.id);
      sheet.containerIds.push(container.id);

      type Item = { top: number; order: number } & (
        | { kind: 'field'; field: 'text' | 'image' | 'shape'; id: string }
        | { kind: 'container'; id: string }
      );
      const items: Item[] = [];
      for (const id of container.memberInputIds) {
        sheet.textIds.push(id);
        if (isEditableText(id)) items.push({ top: inputs.get(id)?.frame?.y ?? Infinity, order: items.length, kind: 'field', field: 'text', id });
      }
      for (const id of container.memberImageInputIds ?? []) {
        sheet.imageIds.push(id);
        if (isEditableImage(id)) items.push({ top: images.get(id)?.frame?.y ?? Infinity, order: items.length, kind: 'field', field: 'image', id });
      }
      for (const id of slotShapes(container)) {
        sheet.shapeIds.push(id);
        const frame = shapes.find((s) => s.id === id)?.frame;
        items.push({ top: frame?.y ?? Infinity, order: items.length, kind: 'field', field: 'shape', id });
      }
      for (const childId of container.memberContainerIds ?? []) {
        const child = byId.get(childId);
        if (!child || visiting.has(childId)) continue;
        items.push({ top: treeTop(child, new Set()), order: items.length, kind: 'container', id: childId });
      }
      items.sort((a, b) => a.top - b.top || a.order - b.order);

      const rowEnds = new Map<string, number>();
      for (const item of items) {
        if (item.kind === 'field') {
          sheet.entries.push({ kind: 'field', field: item.field, id: item.id, depth });
          sheet.fieldIds.push(item.id);
          continue;
        }
        const child = byId.get(item.id)!;
        const ref = child.rowSlot && child.rowSlot.memberId === child.rowSlot.rowId ? child.rowSlot : null;
        const at = sheet.entries.length;
        sheet.entries.push({
          kind: 'section',
          id: child.id,
          depth,
          name: child.name ?? null,
          hidable: child.hidable === true,
          row: ref ? { rowId: ref.rowId, slot: ref.slot } : null,
        });
        const before = sheet.entries.length;
        walk(child, depth + 1, new Set(visiting));
        if (sheet.entries.length === before) {
          // Nothing editable inside: no empty heading.
          sheet.entries.splice(at, 1);
          continue;
        }
        if (ref) rowEnds.set(ref.rowId, sheet.entries.length - 1);
      }

      // "+ Přidat řádek" right after each row's last slot (inserted back to front).
      [...rowEnds.entries()]
        .sort((a, b) => b[1] - a[1])
        .forEach(([rowId, end]) => {
          sheet.entries.splice(end + 1, 0, { kind: 'rowAdd', rowId, depth });
          if (!sheet.rowIds.includes(rowId)) sheet.rowIds.unshift(rowId);
        });
    };

    walk(owner, 0, new Set());
    if (sheet.fieldIds.length >= minFields) sheets.push(sheet);
  }

  return sheets;
}

/** The sheet whose tree holds a field (text / image / shape id), or null. */
export function sheetOfField(sheets: ContainerSheet[], id: string): ContainerSheet | null {
  return sheets.find((s) => s.textIds.includes(id) || s.imageIds.includes(id) || s.shapeIds.includes(id)) ?? null;
}

/**
 * The entries to show: the unused row slots (and their fields) dropped. A
 * field whose id is inactive goes, and so does a section of an inactive slot.
 */
export function visibleEntries(sheet: ContainerSheet, inactive: ReadonlySet<string>): SheetEntry[] {
  return sheet.entries.filter((entry) => {
    if (entry.kind === 'rowAdd') return true;
    return !inactive.has(entry.id);
  });
}

/**
 * The sheet's label: the designer's container name, else the name of a
 * repeatable row inside it, else WBoost's numbered fallback.
 */
export function containerLabelOf(sheet: ContainerSheet, variant: TemplateVariantDTO, index: number): string {
  const own = sheet.name?.trim();
  if (own) return own;
  const rowName = (variant.repeatableRows ?? [])
    .filter((row) => sheet.rowIds.includes(row.containerId))
    .map((row) => row.name?.trim())
    .find((name) => !!name);
  return rowName || `Skupina prvků ${index + 1}`;
}
