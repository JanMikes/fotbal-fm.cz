'use client';

import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, ImageIcon, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Alert from '@/components/ui/Alert';
import {
  fetchSlotImages,
  uploadSlotImage,
  uploadMatchPhoto,
} from '@/hooks/api/use-social-export';
import type { GalleryImageDTO, PlaceholderDirectoryDTO } from '@/lib/social-export/api-types';
import type { StrapiImage } from '@/types/match';

interface ImagePickerModalProps {
  open: boolean;
  onClose: () => void;
  variantId: string;
  imageInputId: string;
  slotLabel: string;
  /** The slot's upload/pick folders (resolved server-side, with names). */
  directories: PlaceholderDirectoryDTO[];
  /** Unrestricted slot — the gallery root is also a valid upload target. */
  includesRoot: boolean;
  matchId: string | null;
  matchImages: StrapiImage[];
  onPick: (image: GalleryImageDTO) => void;
}

/** Sentinel option value for "upload to the gallery root" (sent as no directoryId). */
const ROOT_OPTION = '';

type Tab = 'match' | 'gallery' | 'upload';

export default function ImagePickerModal({
  open,
  onClose,
  variantId,
  imageInputId,
  slotLabel,
  directories,
  includesRoot,
  matchId,
  matchImages,
  onPick,
}: ImagePickerModalProps) {
  const hasMatchPhotos = !!matchId && matchImages.length > 0;
  const [tab, setTab] = useState<Tab>(hasMatchPhotos ? 'match' : 'gallery');

  // Gallery list.
  const [gallery, setGallery] = useState<GalleryImageDTO[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  // Upload target — THE USER'S CHOICE. Defaults to the gallery root for
  // unrestricted slots, else to the slot's first (often only) allowed folder.
  // A restricted multi-folder slot REQUIRES a choice (the API 400s without
  // one), which the always-visible selector guarantees.
  const defaultDirectoryId = includesRoot ? ROOT_OPTION : (directories[0]?.id ?? ROOT_OPTION);
  const fileRef = useRef<HTMLInputElement>(null);
  const [directoryId, setDirectoryId] = useState<string>(defaultDirectoryId);
  const [busy, setBusy] = useState(false);
  const [busyMatchId, setBusyMatchId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // On open: reset the tab/error/target and load the gallery. State updates live
  // inside the async helper (not the effect body) to avoid cascading-render warnings.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function onOpen() {
      setTab(hasMatchPhotos ? 'match' : 'gallery');
      setActionError(null);
      setDirectoryId(defaultDirectoryId);
      setGalleryLoading(true);
      setGalleryError(null);
      try {
        const images = await fetchSlotImages(variantId, imageInputId);
        if (cancelled) return;
        setGallery(images);
      } catch (e) {
        if (!cancelled) setGalleryError((e as Error).message || 'Nepodařilo se načíst obrázky');
      } finally {
        if (!cancelled) setGalleryLoading(false);
      }
    }

    onOpen();
    return () => {
      cancelled = true;
    };
  }, [open, hasMatchPhotos, variantId, imageInputId, defaultDirectoryId]);

  // Folder choices for an upload: the slot's folders, plus the gallery root for
  // unrestricted slots. The selector renders only when there is a real choice.
  const folderOptions = useMemo(() => {
    const options = directories.map((d) => ({ id: d.id, name: d.name }));
    if (includesRoot) options.unshift({ id: ROOT_OPTION, name: 'Galerie (bez složky)' });
    return options;
  }, [directories, includesRoot]);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      e.target.value = ''; // allow re-selecting the same file later
      setBusy(true);
      setActionError(null);
      const res = await uploadSlotImage(variantId, imageInputId, file, directoryId || undefined);
      setBusy(false);
      if (res.error || !res.image) {
        setActionError(res.error ?? 'Nahrání se nezdařilo');
        return;
      }
      onPick(res.image);
      onClose();
    }
  }

  async function handlePickMatch(image: StrapiImage) {
    if (!matchId) return;
    setBusyMatchId(image.id);
    setActionError(null);
    const res = await uploadMatchPhoto(variantId, imageInputId, matchId, image.id, directoryId || undefined);
    setBusyMatchId(null);
    if (res.error || !res.image) {
      setActionError(res.error ?? 'Nahrání se nezdařilo');
      return;
    }
    onPick(res.image);
    onClose();
  }

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'match', label: 'Z tohoto zápasu', show: hasMatchPhotos },
    { key: 'gallery', label: 'Galerie', show: true },
    { key: 'upload', label: 'Nahrát vlastní', show: true },
  ];

  return (
    <Modal open={open} onClose={onClose} title={`Vyberte obrázek — ${slotLabel}`} maxWidthClass="max-w-3xl">
      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-surface-hover p-1">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-white text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {actionError && (
        <Alert variant="error" className="mb-4">
          {actionError}
        </Alert>
      )}

      {/* Match photos (picking one uploads it into the chosen folder) */}
      {tab === 'match' && (
        <div className="space-y-4">
          {folderOptions.length > 1 && (
            <FolderSelect options={folderOptions} value={directoryId} onChange={setDirectoryId} />
          )}
          <ThumbGrid>
            {matchImages.map((img) => (
              <ThumbButton
                key={img.id}
                src={img.formats?.thumbnail?.url ?? img.url}
                busy={busyMatchId === img.id}
                onClick={() => handlePickMatch(img)}
                caption={img.name}
              />
            ))}
          </ThumbGrid>
        </div>
      )}

      {/* Gallery */}
      {tab === 'gallery' && (
        <div>
          {galleryLoading && <CenteredNote icon>Načítání obrázků…</CenteredNote>}
          {!galleryLoading && galleryError && <Alert variant="error">{galleryError}</Alert>}
          {!galleryLoading && !galleryError && gallery.length === 0 && (
            <CenteredNote icon>V galerii zatím nejsou žádné obrázky. Nahrajte vlastní.</CenteredNote>
          )}
          {!galleryLoading && !galleryError && gallery.length > 0 && (
            <ThumbGrid>
              {gallery.map((img) => (
                <ThumbButton
                  key={img.id}
                  src={img.url}
                  onClick={() => {
                    onPick(img);
                    onClose();
                  }}
                  caption={img.directoryName ?? undefined}
                />
              ))}
            </ThumbGrid>
          )}
        </div>
      )}

      {/* Upload */}
      {tab === 'upload' && (
        <div className="space-y-4">
          {folderOptions.length > 1 && (
            <FolderSelect options={folderOptions} value={directoryId} onChange={setDirectoryId} />
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface px-6 py-10 text-center text-text-muted transition-colors hover:border-accent hover:text-text-primary disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <Upload className="h-7 w-7" strokeWidth={1.5} />
            )}
            <span className="text-sm font-medium">
              {busy ? 'Nahrávání…' : 'Klikněte a vyberte obrázek'}
            </span>
            <span className="text-xs">PNG, JPG, WEBP nebo GIF</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function FolderSelect({
  options,
  value,
  onChange,
}: {
  options: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium text-text-primary">Cílová složka</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-white px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-ring-focus"
      >
        {options.map((d) => (
          <option key={d.id || '__root__'} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function ThumbGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-auto sm:grid-cols-3 md:grid-cols-4">
      {children}
    </div>
  );
}

function ThumbButton({
  src,
  onClick,
  busy,
  caption,
}: {
  src: string;
  onClick: () => void;
  busy?: boolean;
  caption?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface text-left transition-all hover:border-accent hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring-focus disabled:opacity-70"
    >
      <span className="flex aspect-square items-center justify-center overflow-hidden bg-surface-hover">
        <img src={src} alt={caption ?? 'obrázek'} className="h-full w-full object-cover" />
      </span>
      {caption && (
        <span className="truncate px-2 py-1 text-[11px] text-text-muted" title={caption}>
          {caption}
        </span>
      )}
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </span>
      )}
    </button>
  );
}

function CenteredNote({ children, icon }: { children: ReactNode; icon?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-text-muted">
      {icon && <ImageIcon className="h-8 w-8" strokeWidth={1.2} />}
      <p className="text-sm">{children}</p>
    </div>
  );
}
