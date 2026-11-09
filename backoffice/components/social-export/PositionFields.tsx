'use client';

import { RotateCcw } from 'lucide-react';
import { clampToRange, describeLimits } from '@/lib/social-export/element-move';
import type { ElementOffset, MovableElementDTO } from '@/lib/social-export/api-types';

interface PositionFieldsProps {
  element: MovableElementDTO;
  offset: ElementOffset;
  onChange: (offset: ElementOffset | null) => void;
  /** Group surfaces: the move applies to this format only. */
  perDimensionNote?: boolean;
}

/**
 * "Poloha" — the exact counterpart of dragging a movable element: one number
 * per allowed axis (canvas px from the designed spot, clamped to the
 * element's range), the designer's limits as a hint and "Vrátit".
 */
export default function PositionFields({ element, offset, onChange, perDimensionNote = false }: PositionFieldsProps) {
  const moved = offset.x !== 0 || offset.y !== 0;

  function set(axis: 'x' | 'y', raw: string) {
    const value = Number.parseFloat(raw.replace(',', '.'));
    const next = clampToRange(element.range, axis === 'x' ? value : offset.x, axis === 'y' ? value : offset.y);
    onChange(next.x === 0 && next.y === 0 ? null : next);
  }

  const field = (axis: 'x' | 'y', label: string, min: number, max: number) => (
    <label className="flex items-center justify-between gap-2 text-xs text-text-secondary">
      <span>{label}</span>
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          step={1}
          min={min}
          max={max}
          value={offset[axis]}
          onChange={(event) => set(axis, event.target.value)}
          className="w-24 rounded-md border border-border bg-white px-2 py-1 text-right text-sm tabular-nums text-text-primary focus:border-accent focus:outline-none"
          aria-label={`${label} (px)`}
        />
        <span className="text-text-muted">px</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-2">
      {element.vertical && field('y', 'Svisle (+ dolů)', element.range.minY, element.range.maxY)}
      {element.horizontal && field('x', 'Vodorovně (+ doprava)', element.range.minX, element.range.maxX)}
      <p className="text-[11px] leading-snug text-text-muted">
        {describeLimits(element)}
        {perDimensionNote ? ' · jen v tomto rozměru' : ''}
      </p>
      <button
        type="button"
        onClick={() => onChange(null)}
        disabled={!moved}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-hover disabled:cursor-not-allowed disabled:text-text-muted"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Vrátit na původní místo
      </button>
    </div>
  );
}
