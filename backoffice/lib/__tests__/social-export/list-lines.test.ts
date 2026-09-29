import { describe, it, expect } from 'vitest';
import {
  checklistItems,
  checklistValue,
  fitLines,
  insertLineBreak,
  lineIndexAt,
  lineStartOffset,
  normalizeLines,
  ordinalAt,
  reconcileLines,
  selectedLineRange,
  toggleCheckbox,
  toggleListType,
} from '@/lib/social-export/list-lines';

describe('line offsets', () => {
  it('maps offsets to line indexes and back', () => {
    const value = 'ab\ncd\n\nef';
    expect(lineIndexAt(value, 0)).toBe(0);
    expect(lineIndexAt(value, 2)).toBe(0);
    expect(lineIndexAt(value, 3)).toBe(1);
    expect(lineIndexAt(value, 6)).toBe(2);
    expect(lineIndexAt(value, 99)).toBe(3);
    expect(lineStartOffset(value, 0)).toBe(0);
    expect(lineStartOffset(value, 1)).toBe(3);
    expect(lineStartOffset(value, 2)).toBe(6);
    expect(lineStartOffset(value, 3)).toBe(7);
  });
});

describe('fitLines / normalizeLines', () => {
  it('pads, slices and sanitizes to one entry per line', () => {
    expect(fitLines('a\nb\nc', ['ul'])).toEqual(['ul', 'p', 'p']);
    expect(fitLines('a', ['ol', 'ul'])).toEqual(['ol']);
    expect(fitLines('a\nb', ['bogus', 'cbx'])).toEqual(['p', 'cbx']);
    expect(fitLines('', null)).toEqual(['p']);
  });

  it('stores no structure when every line is a paragraph', () => {
    expect(normalizeLines(['p', 'p'])).toBeNull();
    expect(normalizeLines(null)).toBeNull();
    expect(normalizeLines(['p', 'ul'])).toEqual(['p', 'ul']);
  });
});

describe('reconcileLines', () => {
  it('keeps types when typing inside a line', () => {
    expect(reconcileLines('ab\ncd', ['ul', 'ol'], 'abX\ncd', 3)).toEqual(['ul', 'ol']);
    expect(reconcileLines('ab\ncd', ['ul', 'ol'], 'ab\ncXd', 5)).toEqual(['ul', 'ol']);
  });

  it('continues the list type of a split line', () => {
    expect(reconcileLines('abcd', ['ul'], 'ab\ncd', 3)).toEqual(['ul', 'ul']);
    expect(reconcileLines('ab\ncd', ['p', 'ol'], 'ab\ncd\n', 6)).toEqual(['p', 'ol', 'ol']);
  });

  it('uses the caret to split the right line when characters repeat', () => {
    // Enter at the END of "a" (not at the start of "b"): the new line is a ul item.
    expect(reconcileLines('a\nb', ['ul', 'p'], 'a\n\nb', 2)).toEqual(['ul', 'ul', 'p']);
    // Enter at the START of "b": the new empty line belongs to b's paragraph.
    expect(reconcileLines('a\nb', ['ul', 'p'], 'a\n\nb', 3)).toEqual(['ul', 'p', 'p']);
  });

  it('keeps the first line type when lines merge', () => {
    expect(reconcileLines('ab\ncd', ['ul', 'ol'], 'abcd', 2)).toEqual(['ul']);
    // "\nb\nc" deleted from the end of line 0: the survivor 'd' keeps its own type.
    expect(reconcileLines('a\nb\nc\nd', ['p', 'ul', 'ol', 'cb'], 'a\nd', 1)).toEqual(['p', 'cb']);
    // "b\nc\n" deleted from the start of line 1: the merged line keeps line 1's type.
    expect(reconcileLines('a\nb\nc\nd', ['p', 'ul', 'ol', 'cb'], 'a\nd', 2)).toEqual(['p', 'ul']);
  });

  it('gives pasted lines the type of the line they were pasted into', () => {
    expect(reconcileLines('x\ny', ['p', 'ul'], 'x\nyA\nB\nC', 9)).toEqual(['p', 'ul', 'ul', 'ul']);
  });

  it('returns the fitted lines for an unchanged value', () => {
    expect(reconcileLines('a\nb', ['ul'], 'a\nb')).toEqual(['ul', 'p']);
  });
});

describe('insertLineBreak', () => {
  it('splits a list item and continues the list', () => {
    expect(insertLineBreak('ab', ['ol'], 1, 1)).toEqual({
      kind: 'break',
      value: 'a\nb',
      lines: ['ol', 'ol'],
      caret: 2,
    });
  });

  it('replaces a selection with the break', () => {
    expect(insertLineBreak('abcd', ['p'], 1, 3)).toEqual({
      kind: 'break',
      value: 'a\nd',
      lines: ['p', 'p'],
      caret: 2,
    });
  });

  it('turns an EMPTY list item back into a paragraph instead of breaking', () => {
    expect(insertLineBreak('a\n', ['ul', 'ul'], 2, 2)).toEqual({ kind: 'exitList', lines: ['ul', 'p'] });
    expect(insertLineBreak('', ['cbx'], 0, 0)).toEqual({ kind: 'exitList', lines: ['p'] });
  });

  it('breaks normally on an empty paragraph line', () => {
    expect(insertLineBreak('a\n', ['ul', 'p'], 2, 2)).toMatchObject({
      kind: 'break',
      value: 'a\n\n',
      lines: ['ul', 'p', 'p'],
    });
  });
});

describe('selectedLineRange', () => {
  it('covers the caret line for a collapsed selection', () => {
    expect(selectedLineRange('ab\ncd\nef', 4, 4)).toEqual([1, 1]);
  });

  it('covers every touched line, excluding a line the selection only reaches the start of', () => {
    expect(selectedLineRange('ab\ncd\nef', 1, 7)).toEqual([0, 2]);
    expect(selectedLineRange('ab\ncd\nef', 0, 6)).toEqual([0, 1]);
    expect(selectedLineRange('ab\ncd\nef', 7, 1)).toEqual([0, 2]);
  });
});

describe('toggleListType / toggleCheckbox / ordinalAt', () => {
  it('turns lines into list items and back', () => {
    const on = toggleListType(['p', 'p', 'p'], 0, 1, 'ul');
    expect(on).toEqual(['ul', 'ul', 'p']);
    expect(toggleListType(on, 0, 1, 'ul')).toEqual(['p', 'p', 'p']);
  });

  it('switches a mixed range to the requested type', () => {
    expect(toggleListType(['ul', 'p', 'ol'], 0, 2, 'ol')).toEqual(['ol', 'ol', 'ol']);
  });

  it('treats cb and cbx as the same checkbox list (checked items stay checked)', () => {
    expect(toggleListType(['cbx', 'p'], 0, 1, 'cb')).toEqual(['cbx', 'cb']);
    expect(toggleListType(['cbx', 'cb'], 0, 1, 'cb')).toEqual(['p', 'p']);
  });

  it('flips only checkbox lines', () => {
    expect(toggleCheckbox(['cb', 'cbx', 'ul'], 0)).toEqual(['cbx', 'cbx', 'ul']);
    expect(toggleCheckbox(['cb', 'cbx', 'ul'], 1)).toEqual(['cb', 'cb', 'ul']);
    expect(toggleCheckbox(['cb', 'cbx', 'ul'], 2)).toEqual(['cb', 'cbx', 'ul']);
  });

  it('numbers ol items within their run', () => {
    const lines = ['ol', 'ol', 'p', 'ol'] as const;
    expect([0, 1, 3].map((i) => ordinalAt([...lines], i))).toEqual([1, 2, 1]);
  });
});

describe('checklist value building', () => {
  it('reads rows from value + lines (cbx = checked)', () => {
    expect(checklistItems({ value: 'First\nSecond', lines: ['cbx', 'cb'] })).toEqual([
      { text: 'First', checked: true },
      { text: 'Second', checked: false },
    ]);
  });

  it('reads rows unchecked when the structure is missing or stale', () => {
    expect(checklistItems({ value: 'a\nb', lines: null })).toEqual([
      { text: 'a', checked: false },
      { text: 'b', checked: false },
    ]);
    expect(checklistItems({ value: 'a\nb', lines: ['cbx'] })).toEqual([
      { text: 'a', checked: false },
      { text: 'b', checked: false },
    ]);
  });

  it('distinguishes an empty checklist from one empty item', () => {
    expect(checklistItems({ value: '', lines: null })).toEqual([]);
    expect(checklistItems({ value: '', lines: ['cb'] })).toEqual([{ text: '', checked: false }]);
  });

  it('builds an unstyled all-checkbox value', () => {
    expect(
      checklistValue([
        { text: 'First', checked: false },
        { text: 'Sec\r\nond', checked: true },
      ])
    ).toEqual({ value: 'First\nSec ond', runs: null, lines: ['cb', 'cbx'] });
    expect(checklistValue([])).toEqual({ value: '', runs: null, lines: null });
  });

  it('round-trips rows through the field state', () => {
    const rows = [
      { text: 'a', checked: true },
      { text: '', checked: false },
    ];
    expect(checklistItems(checklistValue(rows))).toEqual(rows);
  });
});
