/**
 * Pure helpers for rendering the export input form and building the render
 * payload, mirroring the WBoost API's per-input rules. Client-safe (no imports
 * beyond shared types).
 *
 * API rules reflected here:
 *  - label: name → description → "Text N"
 *  - locked: never editable, never sent (always renders its canvas default)
 *  - maxLength: enforced (over-length → 400), so block before sending
 *  - hidable: may be hidden via `{ hide: true }`; ignored on non-hidable inputs
 *  - uppercase: the server uppercases automatically — we never transform the value
 *  - omitted inputs keep their default text
 */

import type {
  RenderInputValue,
  RichRunDTO,
  TemplateInputDTO,
} from './api-types';
import { isStyled } from './rich-text';

/** Resolve the field label: name, else description, else a generic "Text N". */
export function resolveInputLabel(input: TemplateInputDTO, index: number): string {
  const name = input.name?.trim();
  if (name) return name;
  const description = input.description?.trim();
  if (description) return description;
  return `Text ${index + 1}`;
}

/** Whether the input is user-editable (locked inputs are not). */
export function isEditable(input: TemplateInputDTO): boolean {
  return !input.locked;
}

/**
 * Validate a value against the input's maxLength.
 * Returns a Czech error message when invalid, or null when OK.
 */
export function validateInputValue(
  input: TemplateInputDTO,
  value: string
): string | null {
  if (input.maxLength != null && value.length > input.maxLength) {
    return `Maximální délka je ${input.maxLength} znaků.`;
  }
  return null;
}

/** Per-input editable form state. */
export interface InputFieldState {
  /**
   * The PLAIN text projection — always maintained, even for rich inputs
   * (counters, validation, prefill and old clients all read it). Invariant
   * for rich values: `plainText(runs) === value`.
   */
  value: string;
  /** Whether the user toggled "hide this element" (only meaningful if hidable). */
  hidden: boolean;
  /**
   * Styled runs for `richText: true` inputs, or null/absent when the value is
   * unstyled (plain string is then sent — today's wire shape). Never set for
   * non-rich inputs.
   */
  runs?: RichRunDTO[] | null;
}

/**
 * Build the `inputs` payload for the render request from the form state, applying
 * the API rules:
 *  - locked inputs are skipped (they always render their default)
 *  - a hidden, hidable input is sent as `{ value?, hide: true }`
 *  - a non-empty value is sent as a plain string
 *  - an empty, non-hidden value is omitted (keeps the template default)
 *
 * Over-length values are caller's responsibility to block first (see
 * `validateInputValue`) — they would otherwise return 400 from the API.
 */
export function buildRenderInputs(
  inputs: TemplateInputDTO[],
  state: Record<string, InputFieldState>
): Record<string, RenderInputValue> {
  const payload: Record<string, RenderInputValue> = {};

  for (const input of inputs) {
    if (input.locked) continue;

    const fieldState = state[input.id];
    if (!fieldState) continue;

    const value = fieldState.value ?? '';
    const hidden = input.hidable && fieldState.hidden;
    // Rich runs are sent ONLY for richText inputs (the API 400s otherwise)
    // and only when actually styled — unstyled values keep the plain shape.
    const runs = input.richText && isStyled(fieldState.runs) ? fieldState.runs : null;

    if (hidden) {
      if (runs) {
        payload[input.id] = { runs, hide: true };
      } else {
        payload[input.id] = value ? { value, hide: true } : { hide: true };
      }
      continue;
    }

    if (runs) {
      payload[input.id] = { runs };
      continue;
    }

    if (value) {
      payload[input.id] = value;
    }
    // empty + not hidden → omit (use template default)
  }

  return payload;
}
