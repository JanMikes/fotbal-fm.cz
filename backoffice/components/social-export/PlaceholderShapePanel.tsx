'use client';

import { Check, Palette, X } from 'lucide-react';
import { shapeTargetLabel } from '@/lib/social-export/shape-colors';
import type { ShapeInputDTO } from '@/lib/social-export/api-types';

interface PlaceholderShapePanelProps {
  shape: ShapeInputDTO;
  label: string;
  /** The colour the shape shows now (its pick, else the designed colour). */
  current: string;
  /** null = back to the designed colour. */
  onChange: (color: string | null) => void;
  onClose: () => void;
}

/**
 * Floating panel body for one RECOLOURABLE shape: the designer's swatches
 * (the designed colour first — picking it is the reset) and, when the shape
 * allows any colour, a free picker. Only colours WBoost will accept are ever
 * on screen, so a pick can never 400 the render.
 */
export default function PlaceholderShapePanel({ shape, label, current, onChange, onClose }: PlaceholderShapePanelProps) {
  return (
    <div>
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-text-primary">{label}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zavřít"
          className="rounded p-0.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-2 text-[11px] leading-snug text-text-muted">{shapeTargetLabel(shape.target)}</p>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Barva tvaru">
        {shape.colorOptions.map((color, index) => {
          const selected = color === current;
          const title = index === 0 ? `${color} (výchozí)` : color;
          return (
            <button
              key={color}
              type="button"
              aria-pressed={selected}
              aria-label={title}
              title={title}
              onClick={() => onChange(index === 0 ? null : color)}
              className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full border border-border transition-shadow hover:shadow-[0_0_0_2px_rgba(59,130,246,0.4)] ${
                selected ? 'ring-2 ring-accent ring-offset-1' : ''
              }`}
              style={{ backgroundColor: color }}
            >
              {selected && <Check className="h-3.5 w-3.5 text-white mix-blend-difference" />}
            </button>
          );
        })}
        {shape.freeColor && (
          <label
            className={`relative inline-flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border ${
              shape.colorOptions.includes(current) ? '' : 'ring-2 ring-accent ring-offset-1'
            }`}
            style={{ background: 'conic-gradient(#f44, #fb0, #4c4, #19d, #b3f, #f44)' }}
            title="Vlastní barva"
          >
            <Palette className="h-3.5 w-3.5 text-white drop-shadow" />
            <input
              type="color"
              value={current}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Vlastní barva"
              onChange={(event) => {
                const color = event.target.value.toLowerCase();
                onChange(color === shape.defaultColor ? null : color);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
