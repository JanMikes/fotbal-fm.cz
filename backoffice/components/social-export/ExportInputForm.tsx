'use client';

import { Eye, Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import Alert from '@/components/ui/Alert';
import FieldInsertMenu from './FieldInsertMenu';
import FontChoiceSelect from './FontChoiceSelect';
import RichTextEditor from './RichTextEditor';
import { TemplateVariantDTO } from '@/lib/social-export/api-types';
import { MatchChip } from '@/lib/social-export/prefill';
import {
  resolveInputLabel,
  isEditable,
  validateInputValue,
  InputFieldState,
} from '@/lib/social-export/field-rules';

interface ExportInputFormProps {
  variant: TemplateVariantDTO;
  chips: MatchChip[];
  state: Record<string, InputFieldState>;
  onChange: (inputId: string, partial: Partial<InputFieldState>) => void;
  /** When false, the render error + Náhled/Stáhnout actions are not rendered
   *  (used for the secondary "fields without a preview position" fallback list). */
  showActions?: boolean;
  onPreview?: () => void;
  onDownload?: () => void;
  isRendering?: boolean;
  renderError?: string | null;
}

/**
 * Form for editing template inputs before rendering/downloading.
 * Supports chip insertion, locked fields, hidable fields, uppercase hints and char counters.
 */
export default function ExportInputForm({
  variant,
  chips,
  state,
  onChange,
  showActions = true,
  onPreview,
  onDownload,
  isRendering = false,
  renderError,
}: ExportInputFormProps) {
  // Check if any editable field has a validation error
  const hasValidationErrors = variant.inputs.some((input) => {
    if (!isEditable(input)) return false;
    const value = state[input.id]?.value ?? '';
    return validateInputValue(input, value) !== null;
  });

  const isDisabled = isRendering || hasValidationErrors;

  // Set a field to a chosen match-data value (replace), respecting maxLength.
  // Inserted match data is always PLAIN — clear any rich formatting.
  function handleInsert(inputId: string, value: string) {
    const input = variant.inputs.find((i) => i.id === inputId);
    if (!input) return;

    let next = value;
    if (input.maxLength != null && next.length > input.maxLength) {
      next = next.slice(0, input.maxLength);
    }

    onChange(inputId, { value: next, runs: null });
  }

  return (
    <div>
      {/* Input fields */}
      <div className="space-y-1">
        {variant.inputs.map((input, index) => {
          const label = resolveInputLabel(input, index);
          const fieldState = state[input.id] ?? { value: '', hidden: false };
          const value = fieldState.value;
          const isHidden = fieldState.hidden;
          const editable = isEditable(input);
          const validationError = editable ? validateInputValue(input, value) ?? undefined : undefined;

          // Build hint text
          const hints: string[] = [];
          if (input.description && input.name) {
            // show description as hint when name is used as label
            hints.push(input.description);
          }
          if (input.uppercase) hints.push('zobrazí se VELKÝMI písmeny');
          const hintText = hints.join(' · ') || undefined;

          if (!editable) {
            // Locked / read-only row
            return (
              <div key={input.id} className="mb-5 p-3 rounded-lg bg-surface-hover border border-border opacity-70">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-text-primary">{label}</span>
                  <span className="text-xs text-text-muted bg-white border border-border px-2 py-0.5 rounded-full">
                    uzamčeno
                  </span>
                </div>
                {input.description && (
                  <p className="text-xs text-text-muted">{input.description}</p>
                )}
              </div>
            );
          }

          return (
            <FormField
              key={input.id}
              label={label}
              hint={hintText}
              error={validationError}
            >
              {/* Font choice for plain inputs the designer opened up; rich
                  inputs get the per-input faces as their editor menu. */}
              {!(input.richText && variant.richTextOptions) && input.fontOptions && (
                <FontChoiceSelect
                  options={input.fontOptions}
                  value={fieldState.fontFamily}
                  disabled={isHidden}
                  onChange={(fontFamily) => onChange(input.id, { fontFamily })}
                />
              )}
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  {input.richText && variant.richTextOptions ? (
                    <RichTextEditor
                      input={input}
                      options={input.fontOptions ? { ...variant.richTextOptions, fonts: input.fontOptions } : variant.richTextOptions}
                      state={fieldState}
                      disabled={isHidden}
                      onChange={(partial) => onChange(input.id, partial)}
                    />
                  ) : (
                    <AutoGrowTextarea
                      value={value}
                      disabled={isHidden}
                      maxLength={input.maxLength ?? undefined}
                      onChange={(e) => onChange(input.id, { value: e.target.value })}
                      error={validationError}
                      style={input.uppercase ? { textTransform: 'uppercase' } : undefined}
                      placeholder={label}
                    />
                  )}
                </div>
                {chips.length > 0 && (
                  <FieldInsertMenu
                    chips={chips}
                    disabled={isHidden}
                    onSelect={(v) => handleInsert(input.id, v)}
                  />
                )}
              </div>

              {/* Char counter and hidable toggle below the input */}
              <div className="flex items-center justify-between mt-1 min-h-[1.25rem]">
                <div>
                  {input.hidable && (
                    <label className="inline-flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isHidden}
                        onChange={(e) => onChange(input.id, { hidden: e.target.checked })}
                        className="rounded border-border"
                      />
                      Skrýt prvek
                    </label>
                  )}
                </div>
                {input.maxLength != null && (
                  <span
                    className={`text-xs tabular-nums ${
                      value.length > input.maxLength ? 'text-danger' : 'text-text-muted'
                    }`}
                  >
                    {value.length}/{input.maxLength}
                  </span>
                )}
              </div>
            </FormField>
          );
        })}
      </div>

      {showActions && (
        <>
          {/* Render error */}
          {renderError && (
            <Alert variant="error" className="mb-4">
              {renderError}
            </Alert>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <Button variant="primary" size="md" onClick={onPreview} disabled={isDisabled}>
              <Eye className="w-4 h-4 mr-2" />
              Náhled
            </Button>
            <Button variant="accent" size="md" onClick={onDownload} disabled={isDisabled}>
              <Download className="w-4 h-4 mr-2" />
              Stáhnout PNG
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
