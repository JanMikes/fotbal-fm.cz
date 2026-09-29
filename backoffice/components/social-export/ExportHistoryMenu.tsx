'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, History, Loader2, Pencil, Pin, PinOff, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { ExportVersionDTO } from '@/lib/social-export/api-types';

/** How many unpinned versions the dropdown lists (WBoost's fill page shows 5 too). */
const MENU_RECENT = 5;

const CHANNEL_LABELS: Record<string, string> = {
  web: 'WBoost',
  api: 'Backoffice',
  mcp: 'AI',
  facebook: 'Facebook',
  instagram: 'Instagram',
};

interface ExportHistoryMenuProps {
  versions: ExportVersionDTO[];
  isLoading: boolean;
  error: string | null;
  /** The version currently loaded into the editor (highlighted). */
  loadedVersionId: string | null;
  /** Id of the version being loaded right now (spinner on its row). */
  loadingVersionId: string | null;
  onLoad: (version: ExportVersionDTO) => void;
  onRename: (version: ExportVersionDTO, name: string | null) => Promise<void>;
  onTogglePin: (version: ExportVersionDTO) => Promise<void>;
}

/**
 * "Historie exportů" — the fill surface's shared WBoost export history (every
 * distinct fill that was exported, from here or from WBoost itself): pinned
 * versions first, then the freshest. A version can be loaded back into the
 * editor, renamed and pinned (pinned ones are never pruned). The dropdown
 * shows the pinned + the few latest; "Zobrazit vše" opens the full list.
 */
export default function ExportHistoryMenu(props: ExportHistoryMenuProps) {
  const { versions, isLoading, error } = props;
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pinned = versions.filter((version) => version.pinned);
  const recent = versions.filter((version) => !version.pinned).slice(0, MENU_RECENT);
  const hiddenCount = versions.length - pinned.length - recent.length;

  const loadAndClose = (version: ExportVersionDTO) => {
    setOpen(false);
    setShowAll(false);
    props.onLoad(version);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
      >
        <History className="h-3.5 w-3.5" />
        Historie exportů
        {versions.length > 0 && (
          <span className="rounded-full bg-surface-hover px-1.5 tabular-nums">{versions.length}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-white p-2 shadow-lg">
          {isLoading && (
            <p className="flex items-center gap-2 p-2 text-xs text-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Načítám historii…
            </p>
          )}
          {!isLoading && error && <p className="p-2 text-xs text-danger-text">{error}</p>}
          {!isLoading && !error && versions.length === 0 && (
            <p className="p-2 text-xs text-text-muted">
              Zatím žádný export. Každé stažení se sem uloží a půjde znovu načíst.
            </p>
          )}

          {pinned.length > 0 && <SectionLabel>Připnuté</SectionLabel>}
          {pinned.map((version) => (
            <VersionRow key={version.id} version={version} {...props} onLoad={loadAndClose} compact />
          ))}
          {recent.length > 0 && <SectionLabel>Poslední exporty</SectionLabel>}
          {recent.map((version) => (
            <VersionRow key={version.id} version={version} {...props} onLoad={loadAndClose} compact />
          ))}

          {versions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowAll(true);
              }}
              className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-accent hover:bg-surface-hover"
            >
              Zobrazit vše{hiddenCount > 0 ? ` (${versions.length})` : ''}
            </button>
          )}
        </div>
      )}

      <Modal open={showAll} onClose={() => setShowAll(false)} title="Historie exportů" maxWidthClass="max-w-3xl">
        <p className="mb-3 text-xs text-text-muted">
          Sdílená historie šablony — obsahuje exporty z backoffice i z WBoost. Připnuté verze se nikdy
          nesmažou, z ostatních se drží posledních 100.
        </p>
        <div className="flex flex-col gap-1">
          {versions.map((version) => (
            <VersionRow key={version.id} version={version} {...props} onLoad={loadAndClose} />
          ))}
        </div>
      </Modal>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
      {children}
    </p>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function VersionRow({
  version,
  compact = false,
  loadedVersionId,
  loadingVersionId,
  onLoad,
  onRename,
  onTogglePin,
}: ExportHistoryMenuProps & { version: ExportVersionDTO; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(version.name ?? '');
  const [busy, setBusy] = useState(false);

  const title = version.name ?? formatDate(version.lastExportedAt);
  const texts = version.summary.texts.slice(0, compact ? 2 : 4);
  const loaded = loadedVersionId === version.id;

  const saveName = async () => {
    setBusy(true);
    await onRename(version, draft.trim() === '' ? null : draft.trim());
    setBusy(false);
    setEditing(false);
  };

  const togglePin = async () => {
    setBusy(true);
    await onTogglePin(version);
    setBusy(false);
  };

  return (
    <div
      className={`group flex items-start gap-2 rounded-lg px-2 py-1.5 ${
        loaded ? 'bg-accent/10' : 'hover:bg-surface-hover'
      }`}
    >
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              void saveName();
            }}
          >
            <input
              autoFocus
              value={draft}
              maxLength={120}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setEditing(false);
              }}
              placeholder="Název verze"
              className="min-w-0 flex-1 rounded-md border border-border px-2 py-1 text-xs"
            />
            <button type="submit" disabled={busy} className="rounded p-1 text-success-text hover:bg-surface-hover" title="Uložit název">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded p-1 text-text-muted hover:bg-surface-hover" title="Zrušit">
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => onLoad(version)}
            className="block w-full text-left"
            title="Načíst tuto verzi do editoru"
          >
            <span className="flex items-center gap-1.5">
              {version.pinned && <Pin className="h-3 w-3 shrink-0 text-accent" />}
              <span className="truncate text-xs font-semibold text-text-primary">{title}</span>
              {loadingVersionId === version.id && <Loader2 className="h-3 w-3 animate-spin text-accent" />}
              {version.channel !== 'api' && (
                <span className="shrink-0 rounded bg-surface-hover px-1 text-[10px] text-text-muted">
                  {CHANNEL_LABELS[version.channel] ?? version.channel}
                </span>
              )}
            </span>
            <span className="block truncate text-[11px] text-text-muted">
              {version.name ? `${formatDate(version.lastExportedAt)} · ` : ''}
              {texts.length > 0 ? texts.map((text) => text.value).join(' · ') : 'Výchozí obsah'}
              {version.summary.pictures > 0 ? ` · ${version.summary.pictures}× obrázek` : ''}
              {version.exportCount > 1 ? ` · staženo ${version.exportCount}×` : ''}
            </span>
          </button>
        )}
      </div>

      {!editing && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-60 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => {
              setDraft(version.name ?? '');
              setEditing(true);
            }}
            className="rounded p-1 text-text-muted hover:bg-white hover:text-text-primary"
            title="Přejmenovat"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void togglePin()}
            disabled={busy}
            className="rounded p-1 text-text-muted hover:bg-white hover:text-text-primary disabled:opacity-40"
            title={version.pinned ? 'Odepnout' : 'Připnout'}
          >
            {version.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}
