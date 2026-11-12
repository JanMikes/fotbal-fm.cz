'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileDown, FileText, FolderArchive, History, ImageIcon, Link2, Loader2, Printer, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import PreviewPanel from './PreviewPanel';
import ExportInputForm from './ExportInputForm';
import ContainerHideToggles from './ContainerHideToggles';
import { hidableContainers } from '@/lib/social-export/container-hides';
import ExportHistoryMenu, { versionTitle } from './ExportHistoryMenu';
import ImagePickerModal from './images/ImagePickerModal';
import SaveStatusBadge, { type SaveStatus } from './SaveStatusBadge';
import SharedShapeField from './SharedShapeField';
import type { ActivePlaceholder } from './PlaceholderOverlay';
import {
  downloadBlob,
  renderDocument,
  saveExportState,
  type SaveExportStatePayload,
  type RenderResult,
  fetchDocumentExportVersion,
  updateDocumentExportVersion,
  useDocumentExportVersions,
} from '@/hooks/api/use-social-export';
import { exportFilename } from '@/lib/social-export/download-filename';
import type {
  DocumentDTO,
  DocumentExportFormat,
  DocumentFieldDTO,
  ElementOffset,
  ExportVersionDTO,
  RenderErrorDetails,
} from '@/lib/social-export/api-types';
import {
  applyRowPlan,
  clampRowCount,
  defaultRowCounts,
  inactiveRowIds,
  planRowAction,
  rootOf,
  type RowAction,
} from '@/lib/social-export/repeatable-rows';
import {
  applySavedDocument,
  applySharedImage,
  applySharedText,
  applySharedTexts,
  buildDocumentFillBody,
  fieldForInput,
  initDocumentFill,
  initSharedText,
  pageLabel,
  pagesOfField,
  nextPreviewRenders,
  pagesWord,
  pickerSlotOf,
  applySharedShape,
  boundShapes,
  documentFillFromVersion,
  sharedShapeOptions,
  textModeHasLines,
  documentRichTextOptions,
  sharedFieldInput,
  sharedFieldsOf,
  sharedImageOf,
  toSavedDocument,
  type DocumentFillState,
  type SharedTextValues,
} from '@/lib/social-export/document-fill';
import { extractMatchPrefill, getMatchChips, matchValueForName } from '@/lib/social-export/prefill';
import { initialFieldState, isEditable, validateInputValue, type InputFieldState } from '@/lib/social-export/field-rules';
import { defaultImageSlotState, type ImageSlotState } from '@/lib/social-export/field-rules-image';
import { computeTextLayout } from '@/lib/social-export/text-layout';
import { useWboostFonts } from '@/lib/social-export/use-wboost-fonts';
import type { SavedExportStateDTO } from '@/lib/social-export/saved-state';
import type { Match } from '@/types/match';

interface DocumentEditorProps {
  document: DocumentDTO;
  match: Match;
  /** The saved fill of this document for this match (read once, on mount). */
  saved?: SavedExportStateDTO;
  /** An autosave (or the unload flush) stored this record. */
  onSaved: (saved: SavedExportStateDTO) => void;
}

/**
 * Fill a multi-page DOCUMENT page by page with the ordinary click-into-preview
 * editor (`PreviewPanel`), keeping every page's values separate (two pages may
 * share an input id). Shared fields render once at the top and fill their
 * bound inputs on every page. Previews go through the document preview
 * endpoint (one page at a time); the export produces ONE file — PDF to send,
 * the print PDF (print formats only) or a ZIP of PNGs.
 *
 * The fill autosaves per match like the single-variant editor (one
 * `social-export-state` record keyed by the document id, `state.document`),
 * and the document's shared WBoost export history can be loaded back,
 * renamed and pinned (`ExportHistoryMenu`). Mount with
 * `key={document.id}` (after the saved states loaded) so a new document reseeds.
 */
export default function DocumentEditor({ document, match, saved, onSaved }: DocumentEditorProps) {
  const pages = document.pages;
  const chips = useMemo(() => getMatchChips(match), [match]);

  // Seed once per mount: sample texts + the match prefill per page, then the
  // shared text fields whose name matches a match field, mirrored into their
  // bound inputs — all overlaid with the saved fill of this match.
  const [seed] = useState(() => {
    const base = initDocumentFill(document, (page) => extractMatchPrefill(match, page.variant.inputs));
    const shared = initSharedText(document, (name) => matchValueForName(match, name));
    const prefilled = { ...base, forms: applySharedTexts(document, base.forms, shared) };
    return applySavedDocument(document, prefilled, shared, saved?.state.document);
  });
  const [fill, setFill] = useState<DocumentFillState>(seed.fill);
  const [sharedText, setSharedText] = useState<SharedTextValues>(seed.sharedText);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(seed.restored ? 'saved' : 'idle');
  const [activePageId, setActivePageId] = useState<string | null>(pages[0]?.id ?? null);
  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0] ?? null;

  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [renderingIds, setRenderingIds] = useState<ReadonlySet<string>>(new Set());
  // Every page starts stale; the active page renders first, the others only
  // once their thumbnail scrolls into view (see nextPreviewRenders).
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(() => new Set(pages.map((p) => p.id)));
  // Pages whose last auto-render failed — not retried until edited / opened.
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  // Pages whose thumbnail is on screen.
  const [visibleIds, setVisibleIds] = useState<ReadonlySet<string>>(new Set());
  // The last failed render / export: message + structured details (pageId…).
  const [failure, setFailure] = useState<{ message: string; details: RenderErrorDetails } | null>(null);
  const renderError = failure?.message ?? null;
  // The export WBoost refused with `unfilled_pictures` (grey stand-ins left by
  // an AI scan): the format "Exportovat přesto" resends with `allowUnfilled`.
  const [unfilledExport, setUnfilledExport] = useState<DocumentExportFormat | null>(null);
  const renderErrorDetails = failure?.details ?? null;
  const [exportingFormat, setExportingFormat] = useState<DocumentExportFormat | null>(null);

  // Export history (shared with WBoost): which version is loaded / loading.
  const {
    versions,
    isLoading: versionsLoading,
    error: versionsError,
    mutate: mutateVersions,
  } = useDocumentExportVersions(document.id);
  const [loadedVersion, setLoadedVersion] = useState<{ id: string; title: string } | null>(null);
  const [loadingVersionId, setLoadingVersionId] = useState<string | null>(null);

  // The shared image field whose own gallery picker is open.
  const [pickerFieldId, setPickerFieldId] = useState<string | null>(null);

  const [highlightMode, setHighlightMode] = useState(true);
  const [activePlaceholder, setActivePlaceholder] = useState<ActivePlaceholder | null>(null);

  const previewUrlsRef = useRef<Record<string, string>>({});
  // Per-page edit counter: a finished render clears its page's stale flag only
  // when no edit hit that page while it was in flight.
  const pageSeqRef = useRef<Record<string, number>>({});
  // When the last edit happened — the live preview waits 1 s after it.
  const lastEditAtRef = useRef(0);
  // The page each render lane is busy with (see nextPreviewRenders).
  const lanesRef = useRef<{ active: string | null; background: string | null }>({ active: null, background: null });
  const mountedRef = useRef(true);
  const thumbRefs = useRef(new Map<string, HTMLElement>());
  // True while there are edits the autosave hasn't persisted yet — seeding /
  // prefill alone never creates a saved record.
  const hasUnsavedRef = useRef(false);
  // Latest savable payload, for the debounced autosave and the unload flush.
  const latestSaveRef = useRef<SaveExportStatePayload | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const urls = previewUrlsRef.current;
    return () => {
      mountedRef.current = false;
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Track which page thumbnails are on screen (the strip scrolls sideways).
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setVisibleIds(new Set(pages.map((p) => p.id)));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      setVisibleIds((prev) => {
        const next = new Set(prev);
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.pageId;
          if (!id) continue;
          if (entry.isIntersecting) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    });
    thumbRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pages]);

  const textFields = useMemo(() => document.fields.filter((f) => f.kind === 'text' && f.bindings.length > 0), [document]);
  const imageFields = useMemo(() => document.fields.filter((f) => f.kind === 'image' && f.bindings.length > 0), [document]);
  const shapeFields = useMemo(
    () => document.fields.filter((f) => f.kind === 'shape' && boundShapes(document, f).length > 0),
    [document]
  );

  // Live text frames + predicted container overflow, per page (see the
  // single-variant editor: trustworthy only once the real fonts are loaded).
  const { fontsReady } = useWboostFonts();
  // Per page: the shown row counts and the ids of the unused row slots.
  const pageRowCounts = useMemo(
    () =>
      Object.fromEntries(
        pages.map((p) => [p.id, fill.rowCounts?.[p.id] ?? defaultRowCounts(p.variant.repeatableRows)])
      ) as Record<string, Record<string, number>>,
    [pages, fill.rowCounts]
  );
  const pageInactiveIds = useMemo(
    () => Object.fromEntries(pages.map((p) => [p.id, inactiveRowIds(p.variant.repeatableRows, pageRowCounts[p.id])])),
    [pages, pageRowCounts]
  );
  const textLayouts = useMemo(
    () =>
      Object.fromEntries(
        pages.map((p) => [
          p.id,
          computeTextLayout(p.variant, fill.forms[p.id] ?? {}, undefined, {
            hiddenIds: pageInactiveIds[p.id],
            offsets: fill.offsets?.[p.id],
          }),
        ])
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages, fill.forms, fill.offsets, pageInactiveIds, fontsReady]
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
        (input) =>
          isEditable(input) &&
          !pageInactiveIds[page.id]?.has(input.id) &&
          validateInputValue(input, form[input.id]?.value ?? '') !== null
      );
      if (bad) ids.add(page.id);
    }
    return ids;
  }, [pages, fill.forms, pageInactiveIds]);
  // The shared text fields as template inputs (editor, validation, render value).
  const sharedInputs = useMemo(
    () => textFields.map((f) => sharedFieldInput(document, f)).filter((i): i is NonNullable<typeof i> => i != null),
    [document, textFields]
  );
  const sharedRichTextOptions = useMemo(() => documentRichTextOptions(document), [document]);
  const sharedTooLong = sharedInputs.some(
    (input) => validateInputValue(input, sharedText[input.id]?.value ?? '') !== null
  );
  const invalid = invalidPageIds.size > 0 || sharedTooLong;

  const markEdited = useCallback((pageIds: string[]) => {
    for (const id of pageIds) pageSeqRef.current[id] = (pageSeqRef.current[id] ?? 0) + 1;
    lastEditAtRef.current = Date.now();
    hasUnsavedRef.current = true;
    setDirtyIds((prev) => new Set([...prev, ...pageIds]));
    // A fresh edit re-enables the live preview of those pages.
    setFailedIds((prev) => (pageIds.some((id) => prev.has(id)) ? withoutIds(prev, pageIds) : prev));
  }, []);

  /** Open a page in the big editor (a page whose preview failed gets one more try). */
  const openPage = useCallback((pageId: string) => {
    setActivePageId(pageId);
    setActivePlaceholder(null);
    setFailedIds((prev) => (prev.has(pageId) ? withoutIds(prev, [pageId]) : prev));
  }, []);

  // ---------------------------------------------------------------------------
  // Autosave (the single-variant editor's mechanism, one record per document)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    latestSaveRef.current = {
      matchId: match.id,
      templateId: document.id,
      variantId: document.id,
      state: { formState: {}, imageState: {}, document: toSavedDocument(fill, sharedText) },
    };
  });

  // Fire-and-forget save of edits the debounced autosave hasn't sent yet
  // (refresh, tab close, navigating away). The cache is updated optimistically.
  const flushPendingSave = useCallback(() => {
    const payload = latestSaveRef.current;
    if (!hasUnsavedRef.current || !payload) return;
    hasUnsavedRef.current = false;
    onSaved({
      variantId: payload.variantId,
      templateId: payload.templateId,
      state: payload.state,
      updatedAt: new Date().toISOString(),
    });
    void saveExportState(payload, { keepalive: true });
  }, [onSaved]);

  async function doSave(): Promise<void> {
    const payload = latestSaveRef.current;
    if (!payload) return;
    setSaveStatus('saving');
    hasUnsavedRef.current = false;

    const result = await saveExportState(payload);
    if (result.error || !result.state) {
      // Unsaved again: the next edit (or the unload flush) retries.
      hasUnsavedRef.current = true;
      setSaveStatus('error');
      return;
    }
    setSaveStatus('saved');
    onSaved(result.state);
  }

  // Persist 800 ms after the fill settles.
  useEffect(() => {
    if (!hasUnsavedRef.current) return;
    const timer = setTimeout(() => {
      void doSave();
    }, 800);
    return () => clearTimeout(timer);
    // doSave is recreated each render; depending on it would reset the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill, sharedText]);

  useEffect(() => {
    window.addEventListener('pagehide', flushPendingSave);
    return () => {
      window.removeEventListener('pagehide', flushPendingSave);
      flushPendingSave();
    };
  }, [flushPendingSave]);

  // ---------------------------------------------------------------------------
  // Edits
  // ---------------------------------------------------------------------------

  /**
   * Edit a shared TEXT field. A text change (value / runs) is mirrored into
   * the bound inputs; the field-wide hide / font only ride the field value
   * (WBoost applies them on every page).
   */
  const setSharedState = useCallback(
    (field: DocumentFieldDTO, partial: Partial<InputFieldState>) => {
      const current = sharedText[field.id] ?? { value: '', hidden: false };
      const next: InputFieldState = { ...current, ...partial };
      if (!field.richText) next.runs = null;
      if (!textModeHasLines(field.textMode)) next.lines = null;
      setSharedText((prev) => ({ ...prev, [field.id]: next }));
      if ('value' in partial || 'runs' in partial || 'lines' in partial) {
        setFill((prev) => ({ ...prev, forms: applySharedText(document, prev.forms, field.id, next) }));
      }
      markEdited(pagesOfField(field));
    },
    [document, markEdited, sharedText]
  );

  const handleSharedFormChange = useCallback(
    (fieldId: string, partial: Partial<InputFieldState>) => {
      const field = textFields.find((f) => f.id === fieldId);
      if (field) setSharedState(field, partial);
    },
    [textFields, setSharedState]
  );

  const handleFormChange = useCallback(
    (inputId: string, partial: Partial<InputFieldState>) => {
      if (!activePage) return;
      const pageId = activePage.id;
      const field = fieldForInput(document, pageId, inputId, 'text');

      if (field) {
        // A bound input: its TEXT is the shared value (every page shows it),
        // its hide / font pick stay on this page.
        const { value, runs, lines, ...pageOwn } = partial;
        if (value !== undefined || runs !== undefined || lines !== undefined) {
          setSharedState(field, {
            ...(value !== undefined ? { value } : {}),
            ...(runs !== undefined ? { runs } : {}),
            ...(lines !== undefined ? { lines } : {}),
          });
        }
        if (Object.keys(pageOwn).length > 0) {
          setFill((prev) => withPageInput(prev, pageId, inputId, pageOwn));
          markEdited([pageId]);
        }
        return;
      }

      setFill((prev) => withPageInput(prev, pageId, inputId, partial));
      markEdited([pageId]);
    },
    [activePage, document, markEdited, setSharedState]
  );

  const handleImageChange = useCallback(
    (slotId: string, partial: Partial<ImageSlotState>) => {
      if (!activePage) return;
      const pageId = activePage.id;
      const field = fieldForInput(document, pageId, slotId, 'image');
      // Slots that share no folder ([]) are picked page by page, never mirrored.
      const mirrored = field && field.allowedDirectoryIds?.length !== 0 ? field : null;

      setFill((prev) => {
        const current = prev.images[pageId]?.[slotId];
        const nextPage = {
          ...(prev.images[pageId] ?? {}),
          [slotId]: { ...(current ?? defaultImageSlotState()), ...partial },
        };
        let images = { ...prev.images, [pageId]: nextPage };
        if (mirrored && 'image' in partial) {
          images = applySharedImage(document, images, mirrored.id, partial.image ?? null, pageId);
        }
        return { ...prev, images };
      });
      markEdited(mirrored && 'image' in partial ? pagesOfField(mirrored) : [pageId]);
    },
    [activePage, document, markEdited]
  );

  /** The shared image field's own pick (null = remove): every bound slot, from its neutral placement. */
  const setSharedImage = useCallback(
    (field: DocumentFieldDTO, image: ImageSlotState['image']) => {
      setFill((prev) => ({ ...prev, images: applySharedImage(document, prev.images, field.id, image) }));
      markEdited(pagesOfField(field));
    },
    [document, markEdited]
  );

  const handleShapeColorChange = useCallback(
    (shapeId: string, color: string | null) => {
      if (!activePage) return;
      const pageId = activePage.id;
      // A bound shape recolours the SHARED field — every bound page.
      const field = fieldForInput(document, pageId, shapeId, 'shape');
      if (field) {
        setFill((prev) => applySharedShape(document, prev, field.id, color));
        markEdited(pagesOfField(field));
        return;
      }
      setFill((prev) => {
        const next = { ...(prev.shapeColors[pageId] ?? {}) };
        if (color) next[shapeId] = color;
        else delete next[shapeId];
        return { ...prev, shapeColors: { ...prev.shapeColors, [pageId]: next } };
      });
      markEdited([pageId]);
    },
    [activePage, document, markEdited]
  );

  /** A repeatable-row action on the ACTIVE page (rows are per page, never shared). */
  const handleRowAction = useCallback(
    (rowId: string, action: RowAction, slot: number | null) => {
      if (!activePage) return;
      const pageId = activePage.id;
      const row = (activePage.variant.repeatableRows ?? []).find((r) => r.containerId === rowId);
      if (!row) return;
      const count = clampRowCount(row, pageRowCounts[pageId]?.[rowId] ?? row.repeat.default);
      const plan = planRowAction(row, count, action, slot);
      if (!plan) return;
      setFill((prev) => {
        const next = applyRowPlan(
          {
            formState: prev.forms[pageId] ?? {},
            imageStates: { [pageId]: prev.images[pageId] ?? {} },
            shapeColors: prev.shapeColors[pageId] ?? {},
          },
          row,
          plan,
          {
            text: (memberId) => {
              const input = activePage.variant.inputs.find((i) => i.id === memberId);
              return input ? initialFieldState(input) : { value: '', hidden: false };
            },
          }
        );
        return {
          ...prev,
          forms: { ...prev.forms, [pageId]: next.formState },
          images: { ...prev.images, [pageId]: next.imageStates[pageId] ?? {} },
          shapeColors: { ...prev.shapeColors, [pageId]: next.shapeColors },
          rowCounts: { ...(prev.rowCounts ?? {}), [pageId]: { ...(pageRowCounts[pageId] ?? {}), [rowId]: plan.count } },
        };
      });
      setFailure(null);
      markEdited([pageId]);
    },
    [activePage, pageRowCounts, markEdited]
  );

  /** Move an element on the ACTIVE page (null = back to its designed spot). */
  const handleOffsetChange = useCallback(
    (elementId: string, offset: ElementOffset | null) => {
      if (!activePage) return;
      const pageId = activePage.id;
      setFill((prev) => {
        const page = { ...(prev.offsets?.[pageId] ?? {}) };
        if (offset && (offset.x !== 0 || offset.y !== 0)) page[elementId] = offset;
        else delete page[elementId];
        return { ...prev, offsets: { ...(prev.offsets ?? {}), [pageId]: page } };
      });
      markEdited([pageId]);
    },
    [activePage, markEdited]
  );

  /** The shared shape field's own pick (null = every page's designed colour). */
  const setSharedShape = useCallback(
    (field: DocumentFieldDTO, color: string | null) => {
      setFill((prev) => applySharedShape(document, prev, field.id, color));
      markEdited(pagesOfField(field));
    },
    [document, markEdited]
  );

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  /**
   * Show a failed render. `focus` jumps to the failing page + placeholder —
   * not for a background thumbnail render, which must not pull the user off
   * the page they are editing (its thumbnail is flagged instead).
   */
  function showRenderError(result: RenderResult, pageId: string | null, focus = true) {
    if (!focus) return;
    const details: RenderErrorDetails = {
      ...(result.errorDetails ?? {}),
      ...(result.errorDetails?.pageId || !pageId ? {} : { pageId }),
    };
    setFailure({ message: result.error ?? 'Generování selhalo', details });

    if (details.pageId && pages.some((p) => p.id === details.pageId)) {
      setActivePageId(details.pageId);
    }
    // A value refused inside `rows` names the TEMPLATE member: open its slot.
    const page = pages.find((p) => p.id === details.pageId) ?? activePage;
    const rowSlotId = (memberId: string) => {
      const row = page?.variant.repeatableRows?.find((r) => r.containerId === details.rowContainerId);
      return row?.slots.find((s) => s.index === details.rowIndex)?.ids[memberId] ?? memberId;
    };
    if (details.inputId) {
      setActivePlaceholder({ kind: 'text', id: rowSlotId(details.inputId) });
    } else if (details.shapeInputId) {
      setActivePlaceholder({ kind: 'shape', id: rowSlotId(details.shapeInputId) });
    } else if (details.elementId) {
      setActivePlaceholder({ kind: 'move', id: details.elementId });
    }
  }

  async function renderPagePreview(pageId: string, lane: 'active' | 'background'): Promise<void> {
    lanesRef.current[lane] = pageId;
    const seq = pageSeqRef.current[pageId] ?? 0;
    setRenderingIds((prev) => new Set([...prev, pageId]));

    const result = await renderDocument({
      documentId: document.id,
      mode: 'preview',
      pageId,
      ...buildDocumentFillBody(document, fill, sharedText, [pageId]),
    });

    lanesRef.current[lane] = null;
    if (!mountedRef.current) return;
    setRenderingIds((prev) => withoutIds(prev, [pageId]));

    if (result.error || !result.blob) {
      setFailedIds((prev) => new Set([...prev, pageId]));
      showRenderError(result, pageId, lane === 'active');
      return;
    }

    const previous = previewUrlsRef.current[pageId];
    if (previous) URL.revokeObjectURL(previous);
    const url = URL.createObjectURL(result.blob);
    previewUrlsRef.current[pageId] = url;
    setPreviews((prev) => ({ ...prev, [pageId]: url }));
    // This page's error is resolved; a page-less one (e.g. a network error) by
    // the next good render of the active page.
    setFailure((prev) =>
      prev && (prev.details.pageId === pageId || (!prev.details.pageId && lane === 'active')) ? null : prev
    );

    // An edit that landed meanwhile keeps the page stale for the next round.
    if ((pageSeqRef.current[pageId] ?? 0) === seq) {
      setDirtyIds((prev) => withoutIds(prev, [pageId]));
    }
  }

  // Live preview: 1 s after the last edit, start what nextPreviewRenders
  // picks — the active page first, then visible stale thumbnails, two at most.
  useEffect(() => {
    if (!activePage) return;
    const blocked = new Set([...failedIds, ...invalidPageIds]);
    if (sharedTooLong) pages.forEach((p) => blocked.add(p.id));

    const delay = Math.max(0, lastEditAtRef.current + PREVIEW_DEBOUNCE_MS - Date.now());
    const timer = setTimeout(() => {
      const next = nextPreviewRenders({
        pageIds: pages.map((p) => p.id),
        activeId: activePage.id,
        dirty: dirtyIds,
        rendering: renderingIds,
        blocked,
        visible: visibleIds,
        activeLaneBusy: lanesRef.current.active !== null,
        backgroundLaneBusy: lanesRef.current.background !== null,
      });
      if (next.active) void renderPagePreview(next.active, 'active');
      if (next.background) void renderPagePreview(next.background, 'background');
    }, delay);
    return () => clearTimeout(timer);
    // renderPagePreview is recreated each render; depending on it would reset the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill, sharedText, dirtyIds, renderingIds, failedIds, visibleIds, invalidPageIds, sharedTooLong, activePage?.id]);

  async function handleExport(format: DocumentExportFormat, allowUnfilled = false) {
    if (invalid || exportingFormat) return;

    setExportingFormat(format);
    setFailure(null);
    setUnfilledExport(null);
    try {
      const result = await renderDocument({
        documentId: document.id,
        mode: 'export',
        format,
        ...buildDocumentFillBody(document, fill, sharedText),
        ...(allowUnfilled ? { allowUnfilled: true } : {}),
      });
      if (result.error || !result.blob) {
        if (result.errorDetails?.code === 'unfilled_pictures') setUnfilledExport(format);
        showRenderError(result, null);
        return;
      }
      downloadBlob(
        result.blob,
        result.filename ?? exportFilename([document.name], format === 'png' ? 'zip' : 'pdf', 'dokument')
      );
      // WBoost recorded the export as a version.
      void mutateVersions();
    } finally {
      setExportingFormat(null);
    }
  }

  /** Load a history version: it replaces the fill and becomes this match's working draft (autosave). */
  async function handleLoadVersion(version: ExportVersionDTO) {
    setLoadingVersionId(version.id);
    const result = await fetchDocumentExportVersion(version.id);
    setLoadingVersionId(null);

    if (!result.version) {
      setFailure({ message: result.error ?? 'Verzi se nepodařilo načíst', details: {} });
      return;
    }

    const loaded = documentFillFromVersion(document, result.version.fill);
    setFill(loaded.fill);
    setSharedText(loaded.sharedText);
    setActivePlaceholder(null);
    setFailure(null);
    setLoadedVersion({ id: version.id, title: versionTitle(version) });
    // Every page re-renders the loaded fill.
    markEdited(pages.map((p) => p.id));
  }

  async function handleRenameVersion(version: ExportVersionDTO, name: string | null) {
    const result = await updateDocumentExportVersion(version.id, { name });
    if (result.error) setFailure({ message: result.error, details: {} });
    void mutateVersions();
  }

  async function handleTogglePinVersion(version: ExportVersionDTO) {
    const result = await updateDocumentExportVersion(version.id, { pinned: !version.pinned });
    if (result.error) setFailure({ message: result.error, details: {} });
    void mutateVersions();
  }

  if (!activePage) {
    return <p className="text-sm text-text-muted">Dokument nemá žádné strany.</p>;
  }

  const activeOverflow = predictedOverflows[activePage.id] ?? null;
  const activeSharedText = sharedFieldsOf(document, activePage.id, 'text');
  const activeSharedImages = sharedFieldsOf(document, activePage.id, 'image');
  const activeSharedShapes = sharedFieldsOf(document, activePage.id, 'shape');
  const pickerField = imageFields.find((f) => f.id === pickerFieldId) ?? null;
  const pickerTarget = pickerField ? pickerSlotOf(document, pickerField) : null;
  const exportDisabled = exportingFormat !== null || invalid || Object.keys(predictedOverflows).length > 0;
  const failedOnActive =
    renderErrorDetails?.code === 'container_overflow' &&
    (renderErrorDetails.pageId ?? activePage.id) === activePage.id;
  const unplacedInputs = activePage.variant.inputs.filter(
    (input) => isEditable(input) && !input.frame && !pageInactiveIds[activePage.id]?.has(input.id)
  );
  // "+ Přidat řádek" waits while the row's container overflows (predicted or reported).
  const rowAddBlockedReason = (rowId: string): string | null => {
    const root = rootOf(activePage.variant.containers, rowId)?.id;
    if (!root) return null;
    const failed = failedOnActive && renderErrorDetails?.containerId === root;
    return failed || activeOverflow?.containerId === root
      ? 'Řádky se už nevejdou — zkraťte texty nebo řádek odeberte'
      : null;
  };
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            {document.name} — {pages.length} {pagesWord(pages.length)}, {document.dimension}
          </h2>
          <p className="text-xs text-text-muted">
            Vyplňte každou stranu zvlášť. Společná pole nahoře se propíšou na všechny strany, kde jsou použita.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatusBadge status={saveStatus} />
          <ExportHistoryMenu
            versions={versions}
            isLoading={versionsLoading}
            error={versionsError}
            loadedVersionId={loadedVersion?.id ?? null}
            loadingVersionId={loadingVersionId}
            onLoad={(version) => void handleLoadVersion(version)}
            onRename={handleRenameVersion}
            onTogglePin={handleTogglePinVersion}
          />
        </div>
      </div>

      {loadedVersion && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-accent" />
            Načtena verze <strong className="text-text-primary">{loadedVersion.title}</strong> — úpravy se ukládají
            jako rozpracovaný stav tohoto zápasu.
          </span>
          <button
            type="button"
            onClick={() => setLoadedVersion(null)}
            className="rounded p-0.5 text-text-muted hover:bg-white"
            aria-label="Skrýt"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {(textFields.length > 0 || imageFields.length > 0 || shapeFields.length > 0) && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary">
            <Link2 className="h-4 w-4" />
            Společná pole
          </h3>
          {sharedInputs.length > 0 && (
            <ExportInputForm
              variant={{
                ...activePage.variant,
                inputs: sharedInputs,
                imageInputs: [],
                richTextOptions: sharedRichTextOptions,
              }}
              chips={chips}
              state={sharedText}
              onChange={handleSharedFormChange}
              showActions={false}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {shapeFields.map((field) => (
              <SharedShapeField
                key={field.id}
                name={field.name}
                pageCount={pagesOfField(field).length}
                options={sharedShapeOptions(document, field)}
                current={fill.sharedShapes[field.id] ?? null}
                onChange={(color) => setSharedShape(field, color)}
              />
            ))}
            {imageFields.map((field) => {
              const image = sharedImageOf(field, fill.images);
              const pageCount = pagesOfField(field).length;
              // [] = the bound slots share no gallery folder: no pick passes every page.
              const pickable = pickerSlotOf(document, field) != null && field.allowedDirectoryIds?.length !== 0;
              return (
                <div key={field.id} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPickerFieldId(field.id)}
                    disabled={!pickable}
                    title="Vybrat obrázek"
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-hover transition-colors hover:border-accent focus:outline-none focus:ring-2 focus:ring-ring-focus"
                  >
                    {image ? (
                      <img src={image.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-text-muted" />
                    )}
                  </button>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-xs font-medium text-text-secondary">
                      {field.name}{' '}
                      <span className="font-normal text-text-muted">
                        ({pageCount} {pagesWord(pageCount)})
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                      <button
                        type="button"
                        className="text-accent hover:underline disabled:text-text-muted disabled:no-underline"
                        onClick={() => setPickerFieldId(field.id)}
                        disabled={!pickable}
                      >
                        {image ? 'Změnit obrázek' : 'Vybrat obrázek'}
                      </button>
                      {!pickable && field.allowedDirectoryIds?.length === 0 && (
                        <span className="text-text-muted">
                          Strany nemají společnou složku obrázků — vyberte obrázek na každé straně.
                        </span>
                      )}
                      {image && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-0.5 text-text-muted hover:text-danger-text"
                          onClick={() => setSharedImage(field, null)}
                        >
                          <X className="h-3 w-3" />
                          Odebrat
                        </button>
                      )}
                    </span>
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
          const flagged =
            predictedOverflows[page.id] != null || invalidPageIds.has(page.id) || failedIds.has(page.id);
          return (
            <button
              key={page.id}
              ref={(el) => {
                if (el) thumbRefs.current.set(page.id, el);
                else thumbRefs.current.delete(page.id);
              }}
              data-page-id={page.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => openPage(page.id)}
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
        renderErrorAction={
          unfilledExport && renderErrorDetails?.code === 'unfilled_pictures'
            ? {
                label: 'Exportovat přesto',
                onClick: () => void handleExport(unfilledExport, true),
                disabled: exportingFormat !== null,
              }
            : null
        }
        overflowContainerId={
          (failedOnActive ? (renderErrorDetails?.containerId ?? null) : null) ?? activeOverflow?.containerId ?? null
        }
        overflowWarning={
          activeOverflow && !renderError
            ? `Texty se nevejdou do vymezené oblasti (přesah ${Math.ceil(activeOverflow.overflowPx)} px). Zkraťte prosím zvýrazněné texty.`
            : null
        }
        textFrames={textLayouts[activePage.id]?.frames ?? {}}
        sharedTextFields={activeSharedText}
        sharedImageFields={activeSharedImages}
        sharedShapeFields={activeSharedShapes}
        rowControls={
          (activePage.variant.repeatableRows ?? []).length > 0
            ? {
                counts: pageRowCounts[activePage.id] ?? {},
                onAction: handleRowAction,
                addBlockedReason: rowAddBlockedReason,
                fitsRows: (rowId) => activePage.variant.repeatableRows?.find((r) => r.containerId === rowId)?.fitsRows ?? null,
              }
            : undefined
        }
        offsets={fill.offsets?.[activePage.id]}
        onOffsetChange={handleOffsetChange}
      />

      {/* Whole-container hides of the active page (per page, never shared). */}
      <ContainerHideToggles
        containers={hidableContainers(activePage.variant.containers).filter((container) => !container.rowSlot)}
        state={fill.forms[activePage.id] ?? {}}
        onChange={handleFormChange}
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
            sharedFields={activeSharedText}
          />
        </div>
      )}

      {/* A shared image field's own picker — lists / uploads through one bound
          slot (pickerSlotOf), the pick fills every bound slot. */}
      {pickerField && pickerTarget && (
        <ImagePickerModal
          open
          onClose={() => setPickerFieldId(null)}
          variantId={pickerTarget.page.variant.id}
          imageInputId={pickerTarget.slot.id}
          slotLabel={pickerField.name}
          directories={pickerTarget.slot.directories}
          includesRoot={pickerTarget.slot.includesRoot}
          allowedDirectoryIds={pickerField.allowedDirectoryIds}
          matchId={match.id}
          matchImages={match.images}
          onPick={(picked) => {
            setSharedImage(pickerField, { id: picked.id, url: picked.url });
            setPickerFieldId(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The live preview waits this long after the last edit. */
const PREVIEW_DEBOUNCE_MS = 1000;

function withoutIds(set: ReadonlySet<string>, ids: readonly string[]): ReadonlySet<string> {
  const next = new Set(set);
  ids.forEach((id) => next.delete(id));
  return next;
}

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

