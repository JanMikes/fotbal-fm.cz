import { describe, it, expect } from 'vitest';
import type { TemplateInputDTO } from '@/lib/social-export/api-types';
import type { InputFieldState } from '@/lib/social-export/field-rules';
import {
  resolveInputLabel,
  validateInputValue,
  buildRenderInputs,
} from '@/lib/social-export/field-rules';

// ---------- Helpers ----------------------------------------------------------

function makeInput(overrides: Partial<TemplateInputDTO> = {}): TemplateInputDTO {
  return {
    id: 'inp-1',
    name: null,
    maxLength: null,
    locked: false,
    uppercase: false,
    description: null,
    hidable: false,
    frame: null,
    containerId: null,
    textStyle: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<InputFieldState> = {}): InputFieldState {
  return { value: '', hidden: false, ...overrides };
}

// ---------- resolveInputLabel ------------------------------------------------

describe('resolveInputLabel', () => {
  it('returns name when name is present', () => {
    const input = makeInput({ name: 'Domácí', description: 'Home team' });
    expect(resolveInputLabel(input, 0)).toBe('Domácí');
  });

  it('returns description when name is null/empty', () => {
    const input = makeInput({ name: null, description: 'Home team name' });
    expect(resolveInputLabel(input, 0)).toBe('Home team name');
  });

  it('returns description when name is whitespace-only', () => {
    const input = makeInput({ name: '   ', description: 'Popis' });
    expect(resolveInputLabel(input, 2)).toBe('Popis');
  });

  it("returns 'Text N' (1-based) when both name and description are absent", () => {
    const input = makeInput({ name: null, description: null });
    expect(resolveInputLabel(input, 0)).toBe('Text 1');
    expect(resolveInputLabel(input, 2)).toBe('Text 3');
  });
});

// ---------- validateInputValue -----------------------------------------------

describe('validateInputValue', () => {
  it('returns null when value is within maxLength', () => {
    const input = makeInput({ maxLength: 20 });
    expect(validateInputValue(input, 'krátký text')).toBeNull();
  });

  it('returns null when maxLength is null (unconstrained)', () => {
    const input = makeInput({ maxLength: null });
    expect(validateInputValue(input, 'libovolně dlouhý text')).toBeNull();
  });

  it('returns a Czech message when value exceeds maxLength', () => {
    const input = makeInput({ maxLength: 5 });
    const msg = validateInputValue(input, 'příliš dlouhý');
    expect(msg).not.toBeNull();
    expect(msg).toContain('5');
    expect(msg).toContain('znaků');
  });

  it('returns null when value length exactly equals maxLength', () => {
    const input = makeInput({ maxLength: 5 });
    expect(validateInputValue(input, 'hello')).toBeNull();
  });
});

// ---------- buildRenderInputs ------------------------------------------------

describe('buildRenderInputs', () => {
  it('skips locked inputs', () => {
    const inputs = [makeInput({ id: 'locked', name: 'Locked', locked: true })];
    const state: Record<string, InputFieldState> = {
      locked: makeState({ value: 'some value' }),
    };
    const payload = buildRenderInputs(inputs, state);
    expect(payload).not.toHaveProperty('locked');
  });

  it('sends plain string for non-empty, non-hidden value', () => {
    const inputs = [makeInput({ id: 'i1' })];
    const state = { i1: makeState({ value: 'FK Fotbal FM' }) };
    const payload = buildRenderInputs(inputs, state);
    expect(payload['i1']).toBe('FK Fotbal FM');
  });

  it('omits empty non-hidden values (use template default)', () => {
    const inputs = [makeInput({ id: 'i1' })];
    const state = { i1: makeState({ value: '' }) };
    const payload = buildRenderInputs(inputs, state);
    expect(payload).not.toHaveProperty('i1');
  });

  it('emits {hide:true} for hidden hidable input with no value', () => {
    const inputs = [makeInput({ id: 'i1', hidable: true })];
    const state = { i1: makeState({ value: '', hidden: true }) };
    const payload = buildRenderInputs(inputs, state);
    expect(payload['i1']).toEqual({ hide: true });
  });

  it('emits {value, hide:true} for hidden hidable input with a value', () => {
    const inputs = [makeInput({ id: 'i1', hidable: true })];
    const state = { i1: makeState({ value: 'Skryté', hidden: true }) };
    const payload = buildRenderInputs(inputs, state);
    expect(payload['i1']).toEqual({ value: 'Skryté', hide: true });
  });

  it('does NOT hide a non-hidable input even if state.hidden is true', () => {
    const inputs = [makeInput({ id: 'i1', hidable: false })];
    const state = { i1: makeState({ value: 'viditelné', hidden: true }) };
    const payload = buildRenderInputs(inputs, state);
    // hidable=false → hidden flag ignored → plain string
    expect(payload['i1']).toBe('viditelné');
  });

  it('skips inputs whose id is absent from state', () => {
    const inputs = [makeInput({ id: 'no-state' })];
    const payload = buildRenderInputs(inputs, {});
    expect(payload).not.toHaveProperty('no-state');
  });

  it('handles mix of locked, empty, and valued inputs correctly', () => {
    const inputs = [
      makeInput({ id: 'locked', locked: true }),
      makeInput({ id: 'empty' }),
      makeInput({ id: 'filled' }),
    ];
    const state = {
      locked: makeState({ value: 'ignored' }),
      empty: makeState({ value: '' }),
      filled: makeState({ value: 'Hodnota' }),
    };
    const payload = buildRenderInputs(inputs, state);
    expect(payload).not.toHaveProperty('locked');
    expect(payload).not.toHaveProperty('empty');
    expect(payload['filled']).toBe('Hodnota');
  });
});
