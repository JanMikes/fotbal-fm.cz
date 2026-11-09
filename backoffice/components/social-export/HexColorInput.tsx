'use client';

import { useState } from 'react';
import { parseHexColor } from '@/lib/social-export/hex-color';

/**
 * Hex text field next to a native colour swatch — Safari's native picker has
 * no hex entry, so a brand colour could not be typed or pasted. Applies on
 * Enter / blur; a partial value is left alone while typing, an invalid one on
 * Enter / blur turns the field red and applies nothing.
 */
export default function HexColorInput({
  value,
  onCommit,
  onBeforeFocus,
  disabled = false,
  label = 'Vlastní barva (HEX)',
}: {
  value: string | null;
  onCommit: (color: string) => void;
  /** Runs on mousedown, before focus leaves e.g. a contenteditable. */
  onBeforeFocus?: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const [draft, setDraft] = useState(value ? value.toUpperCase() : '');
  const [invalid, setInvalid] = useState(false);
  // Follow the colour when it changes elsewhere (swatch / native picker) —
  // adjusted during render, React's "storing information from previous
  // renders" pattern, instead of a setState-in-effect.
  const [shownValue, setShownValue] = useState(value);
  if (shownValue !== value) {
    setShownValue(value);
    setDraft(value ? value.toUpperCase() : '');
    setInvalid(false);
  }

  const commit = () => {
    if (draft.trim() === '') {
      setDraft(value ? value.toUpperCase() : '');
      setInvalid(false);
      return;
    }
    const color = parseHexColor(draft);
    if (!color) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(color.toUpperCase());
    if (color !== value) onCommit(color);
  };

  return (
    <input
      type="text"
      inputMode="text"
      spellCheck={false}
      autoComplete="off"
      maxLength={7}
      placeholder="#RRGGBB"
      disabled={disabled}
      aria-label={label}
      aria-invalid={invalid}
      title={invalid ? 'Zadejte barvu jako #RRGGBB (nebo #RGB)' : label}
      value={draft}
      onMouseDown={onBeforeFocus}
      onChange={(event) => {
        setDraft(event.target.value);
        if (invalid) setInvalid(false);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          commit();
        }
      }}
      className={`h-7 w-[5.75rem] rounded-md border bg-background px-2 font-mono text-xs uppercase outline-none focus:ring-2 focus:ring-accent/40 ${
        invalid ? 'border-red-500 ring-2 ring-red-500/30' : 'border-border'
      }`}
    />
  );
}
