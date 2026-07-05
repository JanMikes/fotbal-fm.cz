'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import FieldInsertMenu from './FieldInsertMenu';
import RichTextEditor from './RichTextEditor';
import type { RichTextOptionsDTO, TemplateInputDTO } from '@/lib/social-export/api-types';
import type { MatchChip } from '@/lib/social-export/prefill';
import {
  resolveInputLabel,
  validateInputValue,
  type InputFieldState,
} from '@/lib/social-export/field-rules';

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

  // Focus the value input on open for keyboard-first editing (the rich editor
  // focuses itself via autoFocus).
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Set the field to a chosen match-data value (replace), respecting maxLength.
  // Inserted match data is always PLAIN — clear any rich formatting.
  function handleInsert(insertValue: string) {
    let next = insertValue;
    if (input.maxLength != null && next.length > input.maxLength) {
      next = next.slice(0, input.maxLength);
    }
    onChange({ value: next, runs: null });
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

      <div className="flex items-start gap-2">
        <div className="flex-1">
          {isRich && richTextOptions ? (
            <RichTextEditor
              input={input}
              options={richTextOptions}
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
        {chips.length > 0 && (
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
              value.length > input.maxLength ? 'text-danger' : 'text-text-muted'
            }`}
          >
            {value.length}/{input.maxLength}
          </span>
        )}
      </div>

      {validationError && (
        <p className="mt-1.5 text-xs text-danger">{validationError}</p>
      )}
    </div>
  );
}
