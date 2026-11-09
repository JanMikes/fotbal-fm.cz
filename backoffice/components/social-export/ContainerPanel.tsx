'use client';

import { type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Minus, Move, Plus, X } from 'lucide-react';
import PlaceholderTextPanel from './PlaceholderTextPanel';
import PlaceholderImagePanel from './PlaceholderImagePanel';
import PlaceholderShapePanel from './PlaceholderShapePanel';
import PositionFields from './PositionFields';
import { resolveInputLabel, type InputFieldState } from '@/lib/social-export/field-rules';
import { defaultImageSlotState, resolveImageLabel, type ImageSlotState } from '@/lib/social-export/field-rules-image';
import { currentShapeColor, resolveShapeLabel, type ShapeColorState } from '@/lib/social-export/shape-colors';
import { visibleEntries, type ContainerSheet } from '@/lib/social-export/container-sheets';
import {
  canApplyRowAction,
  clampRowCount,
  rowLabel,
  rowsWord,
  type RowAction,
} from '@/lib/social-export/repeatable-rows';
import { boundShapeView, type SharedFieldRef } from '@/lib/social-export/document-fill';
import type {
  ElementOffset,
  MovableElementDTO,
  RichTextOptionsDTO,
  TemplateVariantDTO,
} from '@/lib/social-export/api-types';
import type { MatchChip } from '@/lib/social-export/prefill';

export interface RowControls {
  /** row id → shown rows. */
  counts: Record<string, number>;
  onAction: (rowId: string, action: RowAction, slot: number | null) => void;
  /** Why "+ Přidat řádek" is off beyond `max` (e.g. the last render overflowed), or null. */
  addBlockedReason?: (rowId: string) => string | null;
  /** The designed estimate of how many rows fit (group: the smallest size's). */
  fitsRows?: (rowId: string) => number | null;
}

interface ContainerPanelProps {
  variant: TemplateVariantDTO;
  sheet: ContainerSheet;
  label: string;
  inactiveIds: ReadonlySet<string>;
  formState: Record<string, InputFieldState>;
  onFormChange: (id: string, partial: Partial<InputFieldState>) => void;
  chips: MatchChip[];
  richTextOptions: RichTextOptionsDTO | null;
  imageState: Record<string, ImageSlotState>;
  onImageChange: (slotId: string, partial: Partial<ImageSlotState>) => void;
  /** Open the gallery picker for a slot. */
  onPickImage: (slotId: string) => void;
  shapeColors: ShapeColorState;
  onShapeColorChange: (shapeId: string, color: string | null) => void;
  rows?: RowControls;
  /** The container's own move (when the designer allowed it). */
  movable?: MovableElementDTO | null;
  offset?: ElementOffset;
  onOffsetChange?: (offset: ElementOffset | null) => void;
  perDimensionMoves?: boolean;
  onClose: () => void;
  sharedTextFields?: Record<string, SharedFieldRef>;
  sharedImageFields?: Record<string, SharedFieldRef>;
  sharedShapeFields?: Record<string, SharedFieldRef>;
}

const iconButton =
  'flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-secondary';

function EyeToggle({ hidden, label, onToggle }: { hidden: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hidden}
      aria-label={hidden ? `Zobrazit: ${label}` : `Skrýt: ${label}`}
      title={hidden ? `Zobrazit: ${label}` : `Skrýt: ${label}`}
      className={`${iconButton} ${hidden ? 'bg-text-muted text-white hover:text-white' : ''}`}
    >
      {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  );
}

/**
 * ONE panel for a whole top-level container (WBoost "one pencil per
 * container", P1): the existing text / image / shape panel bodies stacked in
 * flow order, nested containers as sections with their hide toggle, and the
 * members' own eyes. Repeatable rows are "Řádek n" sections with ↑ / ↓ / −
 * and "+ Přidat řádek" (WBoost P4). A movable container shows its "Poloha".
 */
export default function ContainerPanel({
  variant,
  sheet,
  label,
  inactiveIds,
  formState,
  onFormChange,
  chips,
  richTextOptions,
  imageState,
  onImageChange,
  onPickImage,
  shapeColors,
  onShapeColorChange,
  rows,
  movable = null,
  offset = { x: 0, y: 0 },
  onOffsetChange,
  perDimensionMoves = false,
  onClose,
  sharedTextFields,
  sharedImageFields,
  sharedShapeFields,
}: ContainerPanelProps) {
  const entries = visibleEntries(sheet, inactiveIds);
  const firstText = entries.find((e) => e.kind === 'field' && e.field === 'text');
  const firstTextId = firstText?.kind === 'field' ? firstText.id : null;
  const ownHidden = sheet.hidable && (formState[sheet.id]?.hidden ?? false);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    onClose();
  }

  const rowOf = (rowId: string) => (variant.repeatableRows ?? []).find((row) => row.containerId === rowId) ?? null;

  const renderField = (id: string, field: 'text' | 'image' | 'shape'): ReactNode => {
    if (field === 'text') {
      const index = variant.inputs.findIndex((i) => i.id === id);
      const input = variant.inputs[index];
      if (!input) return null;
      const name = resolveInputLabel(input, index);
      const state = formState[id] ?? { value: '', hidden: false };
      return (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text-primary">{name}</span>
            {input.hidable && <EyeToggle hidden={state.hidden} label={name} onToggle={() => onFormChange(id, { hidden: !state.hidden })} />}
          </div>
          <PlaceholderTextPanel
            embedded
            autoFocus={id === firstTextId}
            input={input}
            index={index}
            state={state}
            chips={chips}
            richTextOptions={richTextOptions}
            onChange={(partial) => onFormChange(id, partial)}
            onClose={onClose}
            sharedField={sharedTextFields?.[id] ?? null}
          />
        </div>
      );
    }
    if (field === 'image') {
      const index = variant.imageInputs.findIndex((i) => i.id === id);
      const input = variant.imageInputs[index];
      if (!input) return null;
      const name = resolveImageLabel(input, index);
      const state = imageState[id] ?? defaultImageSlotState();
      return (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-text-primary">{name}</span>
            {input.hidable && <EyeToggle hidden={state.hidden} label={name} onToggle={() => onImageChange(id, { hidden: !state.hidden })} />}
          </div>
          {state.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={state.image.url} alt="" className="mb-2 h-14 w-full rounded-md border border-border object-contain" />
          )}
          <PlaceholderImagePanel
            embedded
            input={input}
            state={state}
            label={name}
            onChange={(partial) => onImageChange(id, partial)}
            onReplace={() => onPickImage(id)}
            onClose={onClose}
            sharedFieldName={sharedImageFields?.[id]?.name ?? null}
          />
        </div>
      );
    }
    const index = (variant.shapeInputs ?? []).findIndex((s) => s.id === id);
    const shape = variant.shapeInputs?.[index];
    if (!shape) return null;
    const name = resolveShapeLabel(shape, index);
    return (
      <div>
        <span className="mb-1 block text-xs font-semibold text-text-primary">{name}</span>
        <PlaceholderShapePanel
          embedded
          shape={boundShapeView(shape, sharedShapeFields?.[id])}
          label={name}
          current={currentShapeColor(shape, shapeColors)}
          onChange={(color) => onShapeColorChange(id, color)}
          onClose={onClose}
          sharedFieldName={sharedShapeFields?.[id]?.name ?? null}
        />
      </div>
    );
  };

  return (
    <div onKeyDown={handleKeyDown}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-text-primary">{label}</span>
        <div className="-mr-1 -mt-1 flex items-center gap-1">
          {sheet.hidable && (
            <EyeToggle hidden={ownHidden} label={label} onToggle={() => onFormChange(sheet.id, { value: '', hidden: !ownHidden })} />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="shrink-0 rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {ownHidden && (
        <p className="mb-2 rounded-md bg-surface px-2 py-1.5 text-xs text-text-muted">
          Celá skupina je skrytá — v exportu se nezobrazí.
        </p>
      )}

      {movable && onOffsetChange && (
        <details className="mb-3 rounded-lg border border-border px-2.5 py-2">
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-text-secondary">
            <Move className="h-3.5 w-3.5" /> Poloha skupiny
          </summary>
          <div className="mt-2">
            <PositionFields element={movable} offset={offset} onChange={onOffsetChange} perDimensionNote={perDimensionMoves} />
          </div>
        </details>
      )}

      <div className="space-y-3">
        {entries.map((entry) => {
          const indent = { marginLeft: `${Math.min(entry.depth, 3) * 10}px` };

          if (entry.kind === 'field') {
            return (
              <div key={`f-${entry.id}`} style={indent} className={ownHidden ? 'opacity-50' : ''}>
                {renderField(entry.id, entry.field)}
              </div>
            );
          }

          if (entry.kind === 'section') {
            const hidden = entry.hidable && (formState[entry.id]?.hidden ?? false);
            const row = entry.row ? rowOf(entry.row.rowId) : null;
            const count = row && rows ? clampRowCount(row, rows.counts[row.containerId] ?? row.repeat.default) : 0;
            const slot = entry.row?.slot ?? null;
            const title = entry.row ? rowLabel(entry.row.slot) : (entry.name ?? 'Skupina');
            return (
              <div
                key={`s-${entry.id}`}
                style={indent}
                className="flex items-center justify-between gap-2 border-t border-border pt-2"
              >
                <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">{title}</span>
                <span className="flex items-center gap-1">
                  {row && rows && slot !== null && (
                    <>
                      <button
                        type="button"
                        className={iconButton}
                        disabled={!canApplyRowAction(row, count, 'up', slot)}
                        onClick={() => rows.onAction(row.containerId, 'up', slot)}
                        aria-label={`Posunout ${title.toLowerCase()} výš`}
                        title="Posunout výš"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className={iconButton}
                        disabled={!canApplyRowAction(row, count, 'down', slot)}
                        onClick={() => rows.onAction(row.containerId, 'down', slot)}
                        aria-label={`Posunout ${title.toLowerCase()} níž`}
                        title="Posunout níž"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className={`${iconButton} hover:!border-danger hover:!text-danger`}
                        disabled={!canApplyRowAction(row, count, 'remove', slot)}
                        onClick={() => rows.onAction(row.containerId, 'remove', slot)}
                        aria-label={`Odebrat ${title.toLowerCase()}`}
                        title={count <= row.repeat.min ? `Šablona vyžaduje aspoň ${row.repeat.min} ${rowsWord(row.repeat.min)}` : 'Odebrat řádek'}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  {entry.hidable && (
                    <EyeToggle hidden={hidden} label={title} onToggle={() => onFormChange(entry.id, { value: '', hidden: !hidden })} />
                  )}
                </span>
              </div>
            );
          }

          // "+ Přidat řádek"
          const row = rowOf(entry.rowId);
          if (!row || !rows) return null;
          const count = clampRowCount(row, rows.counts[row.containerId] ?? row.repeat.default);
          const atMax = !canApplyRowAction(row, count, 'add');
          const blocked = atMax ? null : (rows.addBlockedReason?.(row.containerId) ?? null);
          const fits = rows.fitsRows?.(row.containerId) ?? null;
          const reason = atMax ? `Maximum je ${row.repeat.max} ${rowsWord(row.repeat.max)}` : blocked;
          return (
            <div key={`add-${entry.rowId}`} style={indent} className="border-t border-border pt-2">
              <button
                type="button"
                disabled={atMax || blocked != null}
                onClick={() => rows.onAction(row.containerId, 'add', null)}
                title={reason ?? 'Přidat další řádek'}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-accent/60 bg-accent/5 px-2.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-text-muted"
              >
                <Plus className="h-3.5 w-3.5" /> Přidat řádek
              </button>
              <p className="mt-1 text-[11px] leading-snug text-text-muted">
                {count} z {row.repeat.max} {rowsWord(row.repeat.max)}
                {fits != null && fits < row.repeat.max ? ` · vejde se ~${fits}` : ''}
                {reason ? ` · ${reason}` : ''}
                {!reason && fits != null && count >= fits && count < row.repeat.max
                  ? ' · další řádek se nejspíš nevejde'
                  : ''}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
