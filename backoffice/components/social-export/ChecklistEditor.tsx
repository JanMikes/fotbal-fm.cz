'use client';

/**
 * Per-item editor for a dedicated checklist component (`input.checklist`
 * non-null) — used instead of the free WYSIWYG. One row per item: checkbox
 * (enabled only with `toggle`), text (editable only with `editText`), remove
 * button (only with `removeItems`), plus "add item" (only with `addItems`).
 * All four flags off = read-only (the server ignores overrides then).
 *
 * The value is the ordinary checkbox-list envelope: unstyled text, one line
 * per item, every line 'cb' / 'cbx' (see `checklistValue`).
 */

import { useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { TemplateInputDTO } from '@/lib/social-export/api-types';
import type { InputFieldState } from '@/lib/social-export/field-rules';
import {
  checklistItems,
  checklistValue,
  type ChecklistItem,
} from '@/lib/social-export/list-lines';
import { codePointLength } from '@/lib/social-export/rich-text';

interface ChecklistEditorProps {
  input: TemplateInputDTO;
  state: InputFieldState;
  disabled?: boolean;
  onChange: (partial: Partial<InputFieldState>) => void;
}

export default function ChecklistEditor({ input, state, disabled = false, onChange }: ChecklistEditorProps) {
  const flags = input.checklist ?? { toggle: false, editText: false, addItems: false, removeItems: false };
  const readOnly = !flags.toggle && !flags.editText && !flags.addItems && !flags.removeItems;
  const items = checklistItems(state);
  const rowRefs = useRef<(HTMLInputElement | null)[]>([]);

  function commit(next: ChecklistItem[]) {
    onChange(checklistValue(next));
  }

  /** Whether `next` still fits maxLength (the joined text, `\n` included). */
  function fits(next: ChecklistItem[]): boolean {
    if (input.maxLength == null) return true;
    return codePointLength(checklistValue(next).value) <= input.maxLength;
  }

  function addItem(at: number) {
    const next = [...items.slice(0, at), { text: '', checked: false }, ...items.slice(at)];
    if (!fits(next)) return;
    commit(next);
    // Focus the new row once the parent state has re-rendered the list.
    requestAnimationFrame(() => rowRefs.current[at]?.focus());
  }

  return (
    <div className={disabled ? 'opacity-60' : undefined}>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.checked}
                disabled={disabled || !flags.toggle}
                aria-label={`Položka ${index + 1} splněna`}
                onChange={(event) =>
                  commit(items.map((row, i) => (i === index ? { ...row, checked: event.target.checked } : row)))
                }
                className="h-4 w-4 shrink-0 rounded border-border accent-accent disabled:cursor-not-allowed"
              />
              <input
                ref={(element) => {
                  rowRefs.current[index] = element;
                }}
                type="text"
                value={item.text}
                readOnly={!flags.editText}
                disabled={disabled}
                aria-label={`Položka ${index + 1}`}
                placeholder="Položka seznamu"
                onChange={(event) => {
                  const next = items.map((row, i) =>
                    i === index ? { ...row, text: event.target.value.replace(/[\r\n]+/g, ' ') } : row
                  );
                  if (fits(next)) commit(next);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                  event.preventDefault();
                  if (flags.addItems) addItem(index + 1);
                }}
                className={`min-w-0 flex-1 rounded-lg border border-border px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring-focus disabled:cursor-not-allowed ${
                  flags.editText ? 'bg-white' : 'bg-surface-hover'
                } ${input.uppercase ? 'uppercase' : ''}`}
              />
              {flags.removeItems && (
                <button
                  type="button"
                  disabled={disabled || items.length <= 1}
                  onClick={() => commit(items.filter((_, i) => i !== index))}
                  aria-label={`Odebrat položku ${index + 1}`}
                  title={items.length <= 1 ? 'Seznam musí mít aspoň jednu položku' : 'Odebrat položku'}
                  className="shrink-0 rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {flags.addItems && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => addItem(items.length)}
          className="mt-1.5 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Přidat položku
        </button>
      )}

      {readOnly && (
        <p className="mt-1 text-xs text-text-muted">Tento seznam nelze upravovat.</p>
      )}
      {!readOnly && items.length === 0 && !flags.addItems && (
        <p className="text-xs text-text-muted">Seznam je prázdný.</p>
      )}
    </div>
  );
}
