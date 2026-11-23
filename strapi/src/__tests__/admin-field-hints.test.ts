import { describe, expect, it } from 'vitest';
import schema from '../api/deep-link/content-types/deep-link/schema.json';
import { applyFieldHints, DEEP_LINK_FIELD_HINTS } from '../admin-field-hints';

const defaults = (fields: string[]) =>
  Object.fromEntries(
    fields.map((f) => [f, { edit: { label: f, description: '', placeholder: '', visible: true, editable: true }, list: { label: f, searchable: true, sortable: true } }]),
  );

describe('admin field hints', () => {
  it('covers every deep-link attribute', () => {
    expect(Object.keys(DEEP_LINK_FIELD_HINTS).sort()).toEqual(Object.keys(schema.attributes).sort());
  });

  it('writes labels, hints and read-only flags over Strapi defaults', () => {
    const result = applyFieldHints(defaults(['code', 'url']), DEEP_LINK_FIELD_HINTS)!;
    expect(result.code.edit).toMatchObject({ label: 'Kód odkazu', editable: true, visible: true });
    expect(result.code.edit!.description).toContain('Nechte prázdné');
    expect(result.url.edit).toMatchObject({ label: 'Odkaz ke sdílení', editable: false });
    expect(result.url.list).toMatchObject({ label: 'Odkaz', searchable: true });
  });

  it('leaves a label an admin customised by hand', () => {
    const metadatas = defaults(['code']);
    metadatas.code.edit.label = 'Můj kód';
    expect(applyFieldHints(metadatas, DEEP_LINK_FIELD_HINTS)).toBeNull();
  });

  it('is idempotent, but re-applies changed texts', () => {
    const once = applyFieldHints(defaults(['code']), DEEP_LINK_FIELD_HINTS)!;
    expect(applyFieldHints(once, DEEP_LINK_FIELD_HINTS)).toBeNull();

    const edited = { ...DEEP_LINK_FIELD_HINTS, code: { ...DEEP_LINK_FIELD_HINTS.code, description: 'nový text' } };
    expect(applyFieldHints(once, edited)!.code.edit!.description).toBe('nový text');
  });

  it('skips fields missing from the stored config', () => {
    expect(applyFieldHints({}, DEEP_LINK_FIELD_HINTS)).toBeNull();
  });
});
