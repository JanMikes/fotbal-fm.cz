'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import FieldInsertMenu from './FieldInsertMenu';
import ChecklistEditor from './ChecklistEditor';
import FontChoiceSelect from './FontChoiceSelect';
import RichTextEditor from './RichTextEditor';
import type { RichTextOptionsDTO, TemplateInputDTO } from '@/lib/social-export/api-types';
import type { MatchChip } from '@/lib/social-export/prefill';
import {
  resolveInputLabel,
  validateInputValue,
  type InputFieldState,
} from '@/lib/social-export/field-rules';
import { codePointLength } from '@/lib/social-export/rich-text';

interface PlaceholderTextPanelProps {
  input: TemplateInputDTO;
  /** The input's position in the variant's flat list (for the fallback label). */
  index: number;
  state: InputFieldState;
  chips: MatchChip[];
  /** Fonts + swatches for rich-text inputs (variant.richTextOptions). */
  richTextOptions?: RichTextOptionsDTO | null;
  onChange: (partial: Partial<InputFieldState>) => void;
  onClose: () => void;
}

/**
 * Floating panel body for editing one TEXT placeholder. Reuses the same value
 * input, char counter, uppercase hint, hide toggle and chip-insert menu as the
 * flat ExportInputForm — it writes into the SAME form state, so the debounced
 * auto-render keeps the preview in sync. Positioning/anchoring is the caller's job.
 */
export default function PlaceholderTextPanel({
  input,
  index,
  state,
  chips,
  richTextOptions,
  onChange,
  onClose,
}: PlaceholderTextPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const label = resolveInputLabel(input, index);
  const value = state.value;
  const isHidden = state.hidden;
  const validationError = validateInputValue(input, value) ?? undefined;
  const isRich = input.richText && richTextOptions != null;
  // A dedicated checklist component gets per-item rows, never the WYSIWYG.
  const isChecklist = input.checklist != null;
  const length = codePointLength(value);

  // Focus the value input on open for keyboard-first editing (the rich editor
  // focuses itself via autoFocus).
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Set the field to a chosen match-data value (replace), respecting maxLength.
  // Inserted match data is always PLAIN — clear any rich formatting and
  // list structure.
  function handleInsert(insertValue: string) {
    let next = insertValue;
    if (input.maxLength != null && codePointLength(next) > input.maxLength) {
      next = Array.from(next).slice(0, input.maxLength).join('');
    }
    onChange({ value: next, runs: null, lines: null });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-text-primary">{label}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zavřít"
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {input.description && (
        <p className="mb-2 text-xs text-text-muted">{input.description}</p>
      )}

      {/* Font choice (plain inputs the designer opened up): a whole-text
          switch, sent as the value's `fontFamily`. Rich inputs switch faces
          inside the editor instead (its menu is the per-input fontOptions). */}
      {(!isRich || isChecklist) && input.fontOptions && (
        <FontChoiceSelect
          options={input.fontOptions}
          value={state.fontFamily}
          disabled={isHidden}
          onChange={(fontFamily) => onChange({ fontFamily })}
        />
      )}

      <div className="flex items-start gap-2">
        <div className="flex-1">
          {isChecklist ? (
            <ChecklistEditor input={input} state={state} disabled={isHidden} onChange={onChange} />
          ) : isRich && richTextOptions ? (
            <RichTextEditor
              input={input}
              options={input.fontOptions ? { ...richTextOptions, fonts: input.fontOptions } : richTextOptions}
              state={state}
              disabled={isHidden}
              autoFocus
              onChange={onChange}
            />
          ) : (
            <AutoGrowTextarea
              ref={inputRef}
              value={value}
              disabled={isHidden}
              maxLength={input.maxLength ?? undefined}
              onChange={(e) => onChange({ value: e.target.value })}
              error={validationError}
              style={input.uppercase ? { textTransform: 'uppercase' } : undefined}
              placeholder={label}
            />
          )}
        </div>
        {chips.length > 0 && !isChecklist && (
          <FieldInsertMenu chips={chips} disabled={isHidden} onSelect={handleInsert} />
        )}
      </div>

      {/* Hint + char counter row */}
      <div className="mt-1 flex items-center justify-between gap-2 min-h-[1.25rem]">
        <div className="flex flex-col gap-0.5">
          {input.uppercase && (
            <span className="text-xs text-text-muted">zobrazí se VELKÝMI písmeny</span>
          )}
        </div>
        {input.maxLength != null && (
          <span
            className={`text-xs tabular-nums shrink-0 ${
              length > input.maxLength ? 'text-danger' : 'text-text-muted'
            }`}
          >
            {length}/{input.maxLength}
          </span>
        )}
      </div>

      {validationError && (
        <p className="mt-1.5 text-xs text-danger">{validationError}</p>
      )}
    </div>
  );
}
