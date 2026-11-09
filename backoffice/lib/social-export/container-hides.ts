/**
 * Whole-container hide (WBoost 2026-11): a container the designer marked
 * `hidable` gets ONE toggle that hides it with everything inside it. The
 * toggle lives in the regular form state, keyed by the CONTAINER id
 * (`{ value: '', hidden }`), and is sent in the same `inputs` map as
 * `{ hide: true }` — exactly the API contract (docs/api/consumer-prompt.md,
 * "Hiding a whole container").
 *
 * Semantics mirrored here: the container hide WINS over the members' own
 * hide toggles without touching them, so showing it again restores them.
 * Pure + client-safe.
 */

import type { RenderInputValue, TemplateContainerDTO, TemplateVariantDTO } from './api-types';
import type { InputFieldState } from './field-rules';

/** The hidable containers of one variant, in listing order. */
export function hidableContainers(containers: TemplateContainerDTO[] | undefined): TemplateContainerDTO[] {
  return (containers ?? []).filter((container) => container.hidable === true);
}

/** The hidable containers of a surface (group members share ids; first wins). */
export function unionHidableContainers(members: TemplateVariantDTO[]): TemplateContainerDTO[] {
  const seen = new Map<string, TemplateContainerDTO>();
  for (const member of members) {
    for (const container of hidableContainers(member.containers)) {
      if (!seen.has(container.id)) seen.set(container.id, container);
    }
  }
  return [...seen.values()];
}

/** Toggle label: the designer's name, else a numbered fallback (WBoost's own). */
export function containerLabel(container: TemplateContainerDTO, index: number): string {
  const name = container.name?.trim();
  return name ? name : `Skupina prvků ${index + 1}`;
}

/** Whether the user switched this container off. */
export function isContainerHidden(container: TemplateContainerDTO, state: Record<string, InputFieldState>): boolean {
  return container.hidable === true && state[container.id]?.hidden === true;
}

/**
 * Every LISTED input id inside the hidden containers' trees (own members +
 * every nested container's, recursively, cycle-safe) — what the client-side
 * reflow must treat as hidden. Decorative members are not listed by the API;
 * the server hides those itself.
 */
export function containerHiddenInputIds(
  containers: TemplateContainerDTO[] | undefined,
  state: Record<string, InputFieldState>
): Set<string> {
  const list = containers ?? [];
  const byId = new Map(list.map((container) => [container.id, container]));
  const hidden = new Set<string>();

  const walk = (container: TemplateContainerDTO, seen: Set<string>) => {
    if (seen.has(container.id)) return;
    seen.add(container.id);
    container.memberInputIds.forEach((id) => hidden.add(id));
    for (const childId of container.memberContainerIds ?? []) {
      const child = byId.get(childId);
      if (child) walk(child, seen);
    }
  };

  for (const container of list) {
    if (isContainerHidden(container, state)) walk(container, new Set());
  }

  return hidden;
}

/** The `inputs` entries for the switched-off containers: `{ hide: true }` each. */
export function buildContainerHides(
  containers: TemplateContainerDTO[] | undefined,
  state: Record<string, InputFieldState>
): Record<string, RenderInputValue> {
  const payload: Record<string, RenderInputValue> = {};
  for (const container of hidableContainers(containers)) {
    if (isContainerHidden(container, state)) payload[container.id] = { hide: true };
  }
  return payload;
}

/**
 * Container toggles out of a saved form / a loaded export version
 * (`fill.inputs[<containerId>] = { hide: true }`) — only for containers that
 * are still hidable, so a stale record can never hide a fixed one.
 */
export function restoreContainerHides(
  containers: TemplateContainerDTO[] | undefined,
  saved: Record<string, InputFieldState | RenderInputValue | undefined> | null | undefined
): Record<string, InputFieldState> {
  const restored: Record<string, InputFieldState> = {};
  for (const container of hidableContainers(containers)) {
    const entry = saved?.[container.id];
    if (entry && typeof entry === 'object') {
      const hidden = 'hidden' in entry ? entry.hidden === true : 'hide' in entry && entry.hide === true;
      if (hidden) restored[container.id] = { value: '', hidden: true };
    }
  }
  return restored;
}
