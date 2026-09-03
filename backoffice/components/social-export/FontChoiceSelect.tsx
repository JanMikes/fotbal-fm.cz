'use client';

import type { RichTextFontOptionDTO } from '@/lib/social-export/api-types';

interface FontChoiceSelectProps {
  /** The input's `fontOptions` — designed face first. */
  options: RichTextFontOptionDTO[];
  /** The current pick (one of `options[].family`), or null for the default. */
  value: string | null | undefined;
  disabled?: boolean;
  onChange: (family: string | null) => void;
}

/**
 * The whole-text font switch for a plain input the designer opened up
 * (`fontOptions` non-null). The first option is the designed face and maps to
 * "no pick" (null → the value's `fontFamily` is omitted); the rest are grouped
 * by font and previewed in their own face — the same menu the WBoost fill
 * page shows.
 */
export default function FontChoiceSelect({ options, value, disabled = false, onChange }: FontChoiceSelectProps) {
  if (options.length < 2) return null;

  const [designed, ...switchable] = options;
  const groups = new Map<string, RichTextFontOptionDTO[]>();
  for (const font of switchable) {
    const group = groups.get(font.fontName) ?? [];
    group.push(font);
    groups.set(font.fontName, group);
  }

  return (
    <label className="mb-1 flex items-center gap-2 text-xs text-text-muted">
      <span className="shrink-0">Písmo</span>
      <select
        className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring-focus disabled:opacity-50"
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="" style={{ fontFamily: `"${designed.family}"` }}>
          {designed.faceName} (výchozí)
        </option>
        {[...groups.entries()].map(([fontName, faces]) => (
          <optgroup key={fontName} label={fontName}>
            {faces.map((font) => (
              <option key={font.family} value={font.family} style={{ fontFamily: `"${font.family}"` }}>
                {font.faceName}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
