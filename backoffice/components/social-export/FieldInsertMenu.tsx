'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { MatchChip } from '@/lib/social-export/prefill';

interface FieldInsertMenuProps {
  /** Available match-data values. */
  chips: MatchChip[];
  /** Called with the chosen value (the parent decides how to apply it). */
  onSelect: (value: string) => void;
  disabled?: boolean;
}

/**
 * Per-field "vložit" (insert) dropdown: lists match-data values (Domácí, Skóre,
 * Datum, …) and inserts the chosen one into THIS field. Unambiguous targeting —
 * each input has its own menu. Renders nothing when there is no match data.
 */
export default function FieldInsertMenu({ chips, onSelect, disabled }: FieldInsertMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (chips.length === 0) return null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium rounded-lg border border-border bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Vložit data zápasu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus className="w-3.5 h-3.5" />
        vložit
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-60 max-h-72 overflow-auto rounded-lg border border-border bg-white shadow-lg py-1"
        >
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              role="menuitem"
              onClick={() => {
                onSelect(chip.value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-surface-hover"
            >
              <span className="text-sm font-medium text-text-primary whitespace-nowrap">{chip.label}</span>
              <span className="text-xs text-text-muted truncate max-w-[55%]" title={chip.value}>
                {chip.value}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
