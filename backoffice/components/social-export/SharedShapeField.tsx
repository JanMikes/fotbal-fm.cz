'use client';

import { Check, Palette, RotateCcw } from 'lucide-react';
import { pagesWord } from '@/lib/social-export/document-fill';

interface SharedShapeFieldProps {
  name: string;
  pageCount: number;
  /** The colours every bound shape accepts (`sharedShapeOptions`). */
  options: { colors: string[]; free: boolean };
  /** The field's pick, or null = every page keeps its own / designed colour. */
  current: string | null;
  onChange: (color: string | null) => void;
}

/**
 * A document's shared SHAPE field at the top of the editor: one colour for
 * the bound recolourable shape on every page. Only colours every bound shape
 * accepts are offered (a free picker only when every shape is free), so a
 * pick can never 400 on another page. "Výchozí" = each page's designed colour.
 */
export default function SharedShapeField({ name, pageCount, options, current, onChange }: SharedShapeFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-secondary">
        {name}{' '}
        <span className="font-normal text-text-muted">
          ({pageCount} {pagesWord(pageCount)})
        </span>
      </span>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Barva — ${name}`}>
        <button
          type="button"
          aria-pressed={current === null}
          onClick={() => onChange(null)}
          title="Výchozí barvy stran"
          className={`inline-flex h-7 items-center gap-1 rounded-full border border-border px-2 text-[11px] text-text-secondary hover:border-accent ${
            current === null ? 'ring-2 ring-accent ring-offset-1' : ''
          }`}
        >
          <RotateCcw className="h-3 w-3" />
          Výchozí
        </button>
        {options.colors.map((color) => {
          const selected = color === current;
          return (
            <button
              key={color}
              type="button"
              aria-pressed={selected}
              aria-label={color}
              title={color}
              onClick={() => onChange(color)}
              className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-border transition-shadow hover:shadow-[0_0_0_2px_rgba(59,130,246,0.4)] ${
                selected ? 'ring-2 ring-accent ring-offset-1' : ''
              }`}
              style={{ backgroundColor: color }}
            >
              {selected && <Check className="h-3.5 w-3.5 text-white mix-blend-difference" />}
            </button>
          );
        })}
        {options.free && (
          <label
            className={`relative inline-flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border ${
              current !== null && !options.colors.includes(current) ? 'ring-2 ring-accent ring-offset-1' : ''
            }`}
            style={{ background: 'conic-gradient(#f44, #fb0, #4c4, #19d, #b3f, #f44)' }}
            title="Vlastní barva"
          >
            <Palette className="h-3.5 w-3.5 text-white drop-shadow" />
            <input
              type="color"
              value={current ?? '#000000'}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Vlastní barva"
              onChange={(event) => onChange(event.target.value.toLowerCase())}
            />
          </label>
        )}
      </div>
    </div>
  );
}
