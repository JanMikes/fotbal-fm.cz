'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileDown, FileText, FolderArchive, ImageIcon, Link2, Loader2, Printer } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PreviewPanel from './PreviewPanel';
import ExportInputForm from './ExportInputForm';
import type { ActivePlaceholder } from './PlaceholderOverlay';
import {
  downloadBlob,
  renderDocument,
  sanitizeFilename,
  type RenderResult,
} from '@/hooks/api/use-social-export';
import type {
  DocumentDTO,
  DocumentExportFormat,
  DocumentFieldDTO,
  RenderErrorDetails,
} from '@/lib/social-export/api-types';
import {
  applySharedImage,
  applySharedText,
  buildDocumentFillBody,
  fieldForInput,
  initDocumentFill,
  pageLabel,
  pagesOfField,
  pagesWord,
  sharedImageOf,
  type DocumentFillState,
  type SharedTextValues,
} from '@/lib/social-export/document-fill';
import { extractMatchPrefill, getMatchChips } from '@/lib/social-export/prefill';
import { isEditable, validateInputValue, type InputFieldState } from '@/lib/social-export/field-rules';
import { defaultImageSlotState, type ImageSlotState } from '@/lib/social-export/field-rules-image';
import { codePointLength } from '@/lib/social-export/rich-text';
import { computeTextLayout } from '@/lib/social-export/text-layout';
import { useWboostFonts } from '@/lib/social-export/use-wboost-fonts';
import type { Match } from '@/types/match';

interface DocumentEditorProps {
  document: DocumentDTO;
  match: Match;
}

/**
 * Fill a multi-page DOCUMENT page by page with the ordinary click-into-preview
 * editor (`PreviewPanel`), keeping every page's values separate (two pages may
 * share an input id). Shared fields render once at the top and fill their
 * bound inputs on every page. Previews go through the document preview
 * endpoint (one page at a time); the export produces ONE file — PDF to send,
 * the print PDF (print formats only) or a ZIP of PNGs.
 *
 * Not (yet) here: autosave per match and the export history — see the
 * follow-up issue. Mount with `key={document.id}` so a new document reseeds.
 */
export default function DocumentEditor({ document, match }: DocumentEditorProps) {
  const pages = document.pages;
  const chips = useMemo(() => getMatchChips(match), [match]);

  const [fill, setFill] = useState<DocumentFillState>(() =>
    initDocumentFill(document, (page) => extractMatchPrefill(match, page.variant.inputs))
  );
  const [sharedText, setSharedText] = useState<SharedTextValues>({});
  const [activePageId, setActivePageId] = useState<string | null>(pages[0]?.id ?? null);
  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0] ?? null;

  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [renderingIds, setRenderingIds] = useState<ReadonlySet<string>>(new Set());
  // Every page renders its initial state.
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(() => new Set(pages.map((p) => p.id)));
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderErrorDetails, setRenderErrorDetails] = useState<RenderErrorDetails | null>(null);
  const [exportingFormat, setExportingFormat] = useState<DocumentExportFormat | null>(null);

  const [highlightMode, setHighlightMode] = useState(true);
  const [activePlaceholder, setActivePlaceholder] = useState<ActivePlaceholder | null>(null);

  const previewUrlsRef = useRef<Record<string, string>>({});
  const autoPreviewBlockedRef = useRef(false);
  const editSeqRef = useRef(0);

  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const textFields = useMemo(() => document.fields.filter((f) => f.kind === 'text' && f.bindings.length > 0), [document]);
  const imageFields = useMemo(() => document.fields.filter((f) => f.kind === 'image' && f.bindings.length > 0), [document]);

  // Live text frames + predicted container overflow, per page (see the
  // single-variant editor: trustworthy only once the real fonts are loaded).
  const { fontsReady } = useWboostFonts();
  const textLayouts = useMemo(
    () => Object.fromEntries(pages.map((p) => [p.id, computeTextLayout(p.variant, fill.forms[p.id] ?? {})])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages, fill.forms, fontsReady]
  );
  const predictedOverflows = useMemo(() => {
    const result: Record<string, { containerId: string; overflowPx: number }> = {};
    if (!fontsReady) return result;
    for (const [pageId, layout] of Object.entries(textLayouts)) {
      const first = layout.overflows[0];
      if (first) result[pageId] = first;
    }
    return result;
  }, [textLayouts, fontsReady]);

  const invalidPageIds = useMemo(() => {
    const ids = new Set<string>();
    for (const page of pages) {
      const form = fill.forms[page.id] ?? {};
      const bad = page.variant.inputs.some(
        (input) => isEditable(input) && validateInputValue(input, form[input.id]?.value ?? '') !== null
      );
      if (bad) ids.add(page.id);
    }
    return ids;
  }, [pages, fill.forms]);
  const sharedTooLong = textFields.some(
    (f) => f.maxLength != null && codePointLength(sharedText[f.id] ?? '') > f.maxLength
  );
  const invalid = invalidPageIds.size > 0 || sharedTooLong;

  const markEdited = useCallback((pageIds: string[]) => {
    editSeqRef.current += 1;
    autoPreviewBlockedRef.current = false;
    setDirtyIds((prev) => new Set([...prev, ...pageIds]));
  }, []);

  // ---------------------------------------------------------------------------
  // Edits
  // ---------------------------------------------------------------------------

  const setSharedValue = useCallback(
    (field: DocumentFieldDTO, value: string) => {
      setSharedText((prev) => ({ ...prev, [field.id]: value }));
      setFill((prev) => ({ ...prev, forms: applySharedText(document, prev.forms, field.id, value) }));
      markEdited(pagesOfField(field));
    },
    [document, markEdited]
  );

  const handleFormChange = useCallback(
    (inputId: string, partial: Partial<InputFieldState>) => {
      if (!activePage) return;
      const pageId = activePage.id;
      const field = fieldForInput(document, pageId, inputId, 'text');

      // A bound input edits the SHARED value — every page shows it.
      if (field && partial.value !== undefined) {
        setSharedValue(field, partial.value);
        if ('hidden' in partial) {
          setFill((prev) => withPageInput(prev, pageId, inputId, { hidden: partial.hidden ?? false }));
        }
        return;
      }

      setFill((prev) => withPageInput(prev, pageId, inputId, partial));
      markEdited([pageId]);
    },
    [activePage, document, markEdited, setSharedValue]
  );

  const handleImageChange = useCallback(
    (slotId: string, partial: Partial<ImageSlotState>) => {
      if (!activePage) return;
      const pageId = activePage.id;
      const field = fieldForInput(document, pageId, slotId, 'image');

      setFill((prev) => {
        const current = prev.images[pageId]?.[slotId];
        const nextPage = {
          ...(prev.images[pageId] ?? {}),
          [slotId]: { ...(current ?? defaultImageSlotState()), ...partial },
        };
        let images = { ...prev.images, [pageId]: nextPage };
        if (field && 'image' in partial) {
          images = applySharedImage(document, images, field.id, partial.image ?? null, pageId);
        }
        return { ...prev, images };
      });
      markEdited(field && 'image' in partial ? pagesOfField(field) : [pageId]);
    },
    [activePage, document, markEdited]
  );

  const handleShapeColorChange = useCallback(
    (shapeId: string, color: string | null) => {
      if (!activePage) return;
      const pageId = activePage.id;
      setFill((prev) => {
        const next = { ...(prev.shapeColors[pageId] ?? {}) };
        if (color) next[shapeId] = color;
        else delete next[shapeId];
        return { ...prev, shapeColors: { ...prev.shapeColors, [pageId]: next } };
      });
      markEdited([pageId]);
    },
    [activePage, markEdited]
  );

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function showRenderError(result: RenderResult, pageId: string | null) {
    const details: RenderErrorDetails = {
      ...(result.errorDetails ?? {}),
      ...(result.errorDetails?.pageId || !pageId ? {} : { pageId }),
    };
    setRenderError(result.error ?? 'Generování selhalo');
    setRenderErrorDetails(details);

    if (details.pageId && pages.some((p) => p.id === details.pageId)) {
      setActivePageId(details.pageId);
    }
    if (details.inputId) {
      setActivePlaceholder({ kind: 'text', id: details.inputId });
    } else if (details.shapeInputId) {
      setActivePlaceholder({ kind: 'shape', id: details.shapeInputId });
    }
  }

  async function renderDirtyPreviews(): Promise<void> {
    if (!activePage) return;
    const order = [activePage.id, ...pages.map((p) => p.id).filter((id) => id !== activePage.id)].filter((id) =>
      dirtyIds.has(id)
    );

    for (const pageId of order) {
      const seq = editSeqRef.current;
      setRenderingIds(new Set([pageId]));
      const result = await renderDocument({
        documentId: document.id,
        mode: 'preview',
        pageId,
        ...buildDocumentFillBody(document, fill, sharedText, [pageId]),
      });
      setRenderingIds(new Set());

      if (result.error || !result.blob) {
        showRenderError(result, pageId);
        autoPreviewBlockedRef.current = true;
        return;
      }

      const previous = previewUrlsRef.current[pageId];
      if (previous) URL.revokeObjectURL(previous);
      const url = URL.createObjectURL(result.blob);
      previewUrlsRef.current[pageId] = url;
      setPreviews((prev) => ({ ...prev, [pageId]: url }));
      setRenderError(null);
      setRenderErrorDetails(null);

      if (editSeqRef.current === seq) {
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.delete(pageId);
          return next;
        });
      } else {
        // An edit landed meanwhile — let the debounce pick up the new state.
        return;
      }
    }
  }

  // Live preview: debounced 1 s after the fill settles; dirty pages render one
  // after another, the edited page first.
  useEffect(() => {
    if (dirtyIds.size === 0 || renderingIds.size > 0) return;
    if (autoPreviewBlockedRef.current || invalid) return;

    const timer = setTimeout(() => {
      void renderDirtyPreviews();
    }, 1000);
    return () => clearTimeout(timer);
    // renderDirtyPreviews is recreated each render; depending on it would reset the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill, sharedText, dirtyIds, renderingIds, invalid]);

  async function handleExport(format: DocumentExportFormat) {
    if (invalid || exportingFormat) return;

    setExportingFormat(format);
    setRenderError(null);
    setRenderErrorDetails(null);
    try {
      const result = await renderDocument({
        documentId: document.id,
        mode: 'export',
        format,
        ...buildDocumentFillBody(document, fill, sharedText),
      });
      if (result.error || !result.blob) {
        showRenderError(result, null);
        return;
      }
      downloadBlob(
        result.blob,
        result.filename ?? `${sanitizeFilename(document.name) || 'dokument'}.${format === 'png' ? 'zip' : 'pdf'}`
      );
    } finally {
      setExportingFormat(null);
    }
  }

  if (!activePage) {
    return <p className="text-sm text-text-muted">Dokument nemá žádné strany.</p>;
  }

  const activeOverflow = predictedOverflows[activePage.id] ?? null;
  const exportDisabled = exportingFormat !== null || invalid || Object.keys(predictedOverflows).length > 0;
  const failedOnActive =
    renderErrorDetails?.code === 'container_overflow' &&
    (renderErrorDetails.pageId ?? activePage.id) === activePage.id;
  const unplacedInputs = activePage.variant.inputs.filter((input) => isEditable(input) && !input.frame);
  const errorPage =
    renderErrorDetails?.pageId && renderErrorDetails.pageId !== activePage.id
      ? pages.findIndex((p) => p.id === renderErrorDetails.pageId)
      : -1;

  const exportButton = (format: DocumentExportFormat, label: string, icon: ReactNode, variant: 'accent' | 'secondary') => (
    <Button
      key={format}
      variant={variant}
      size="md"
      onClick={() => void handleExport(format)}
      disabled={exportDisabled}
    >
      {exportingFormat === format ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : icon}
      {label}
    </Button>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {exportButton('pdf-screen', 'PDF k odeslání', <FileDown className="mr-2 h-4 w-4" />, 'accent')}
      {document.printFormat && exportButton('pdf', 'PDF pro tisk', <Printer className="mr-2 h-4 w-4" />, 'secondary')}
      {exportButton('png', 'PNG (ZIP)', <FolderArchive className="mr-2 h-4 w-4" />, 'secondary')}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold text-text-primary">
          {document.name} — {pages.length} {pagesWord(pages.length)}, {document.dimension}
        </h2>
        <p className="text-xs text-text-muted">
          Vyplňte každou stranu zvlášť. Společná pole nahoře se propíšou na všechny strany, kde jsou použita.
        </p>
      </div>

      {(textFields.length > 0 || imageFields.length > 0) && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary">
            <Link2 className="h-4 w-4" />
            Společná pole
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {textFields.map((field) => {
              const value = sharedText[field.id] ?? '';
              const tooLong = field.maxLength != null && codePointLength(value) > field.maxLength;
              return (
                <label key={field.id} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-text-secondary">
                    {field.name}{' '}
                    <span className="font-normal text-text-muted">
                      ({pagesOfField(field).length} {pagesWord(pagesOfField(field).length)})
                    </span>
                  </span>
                  <Input
                    value={value}
                    placeholder="Ponechat texty jednotlivých stran"
                    onChange={(e) => setSharedValue(field, e.target.value)}
                    error={tooLong ? `Maximální délka je ${field.maxLength} znaků.` : undefined}
                  />
                  {field.maxLength != null && (
                    <span className={`text-[11px] ${tooLong ? 'text-danger-text' : 'text-text-muted'}`}>
                      {codePointLength(value)} / {field.maxLength}
                    </span>
                  )}
                </label>
              );
            })}
            {imageFields.map((field) => {
              const image = sharedImageOf(field, fill.images);
              const firstBinding = field.bindings[0];
              return (
                <div key={field.id} className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-hover">
                    {image ? (
                      <img src={image.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-text-muted" />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-text-secondary">{field.name}</span>
                    <button
                      type="button"
                      className="text-left text-xs text-accent hover:underline"
                      onClick={() => {
                        setActivePageId(firstBinding.pageId);
                        setActivePlaceholder(null);
                      }}
                    >
                      Obrázek vyberte na kterékoli straně — propíše se na všechny ({pagesOfField(field).length})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex items-start gap-3 overflow-x-auto pb-1" role="tablist" aria-label="Strany dokumentu">
        {pages.map((page, index) => {
          const active = page.id === activePage.id;
          const preview = previews[page.id] ?? null;
          const flagged = predictedOverflows[page.id] != null || invalidPageIds.has(page.id);
          return (
            <button
              key={page.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setActivePageId(page.id);
                setActivePlaceholder(null);
              }}
              className={`flex w-32 shrink-0 flex-col overflow-hidden rounded-xl border bg-surface text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ring-focus ${
                active ? 'border-accent ring-2 ring-accent/30' : flagged ? 'border-danger' : 'border-border hover:border-accent'
              }`}
              title={active ? 'Upravujete tuto stranu' : 'Upravit tuto stranu'}
            >
              <span className="truncate px-2 py-1.5 text-xs font-semibold text-text-primary">{pageLabel(page, index)}</span>
              <span
                className="relative block w-full bg-surface-hover"
                style={{ aspectRatio: `${page.variant.width}/${page.variant.height}` }}
              >
                {preview ? (
                  <img src={preview} alt={`Náhled strany ${index + 1}`} className="h-full w-full object-contain" />
                ) : page.variant.thumbnailUrl ? (
                  <img src={page.variant.thumbnailUrl} alt="" className="h-full w-full object-contain opacity-60" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-text-muted">
                    <FileText className="h-6 w-6" strokeWidth={1.2} />
                  </span>
                )}
                {renderingIds.has(page.id) && (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/50">
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                  </span>
                )}
                {flagged && (
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    <AlertTriangle className="h-3 w-3" />
                    Opravit
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <PreviewPanel
        key={activePage.id}
        variant={activePage.variant}
        previewUrl={previews[activePage.id] ?? null}
        isRendering={renderingIds.has(activePage.id)}
        highlightMode={highlightMode}
        onToggleHighlight={() => setHighlightMode((on) => !on)}
        active={activePlaceholder}
        onSelect={setActivePlaceholder}
        onCloseActive={() => setActivePlaceholder(null)}
        formState={fill.forms[activePage.id] ?? {}}
        onFormChange={handleFormChange}
        chips={chips}
        imageState={fill.images[activePage.id] ?? {}}
        onImageChange={handleImageChange}
        shapeColors={fill.shapeColors[activePage.id] ?? {}}
        onShapeColorChange={handleShapeColorChange}
        matchId={match.id}
        matchImages={match.images}
        onDownload={() => void handleExport('pdf-screen')}
        actionsDisabled={exportDisabled}
        actions={actions}
        renderError={renderError && errorPage >= 0 ? `${renderError} (strana ${errorPage + 1})` : renderError}
        overflowContainerId={
          (failedOnActive ? (renderErrorDetails?.containerId ?? null) : null) ?? activeOverflow?.containerId ?? null
        }
        overflowWarning={
          activeOverflow && !renderError
            ? `Texty se nevejdou do vymezené oblasti (přesah ${Math.ceil(activeOverflow.overflowPx)} px). Zkraťte prosím zvýrazněné texty.`
            : null
        }
        textFrames={textLayouts[activePage.id]?.frames ?? {}}
      />

      {unplacedInputs.length > 0 && (
        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-text-secondary">Pole bez pozice v náhledu</h3>
          <p className="mb-3 mt-0.5 text-xs text-text-muted">
            Tato pole nemají v náhledu vlastní oblast — upravte je zde.
          </p>
          <ExportInputForm
            variant={{ ...activePage.variant, inputs: unplacedInputs, imageInputs: [] }}
            chips={chips}
            state={fill.forms[activePage.id] ?? {}}
            onChange={handleFormChange}
            showActions={false}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withPageInput(
  state: DocumentFillState,
  pageId: string,
  inputId: string,
  partial: Partial<InputFieldState>
): DocumentFillState {
  const page = state.forms[pageId] ?? {};
  return {
    ...state,
    forms: {
      ...state.forms,
      [pageId]: { ...page, [inputId]: { ...(page[inputId] ?? { value: '', hidden: false }), ...partial } },
    },
  };
}

