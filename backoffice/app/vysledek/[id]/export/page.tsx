'use client';

import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Download,
  FolderArchive,
  History,
  Loader2,
  X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import {
  useSocialExportTemplates,
  useSavedExportStates,
  useExportVersions,
  saveExportState,
  renderVariant,
  renderGroup,
  fetchExportVersion,
  updateExportVersion,
  downloadBlob,
  sanitizeFilename,
  type RenderResult,
  type SaveExportStatePayload,
} from '@/hooks/api/use-social-export';
import TemplateGrid from '@/components/social-export/TemplateGrid';
import VariantChooser from '@/components/social-export/VariantChooser';
import ExportInputForm from '@/components/social-export/ExportInputForm';
import PreviewPanel from '@/components/social-export/PreviewPanel';
import DimensionStrip from '@/components/social-export/DimensionStrip';
import ExportHistoryMenu from '@/components/social-export/ExportHistoryMenu';
import type { ActivePlaceholder } from '@/components/social-export/PlaceholderOverlay';
import type {
  ExportVersionDTO,
  RenderErrorDetails,
  TemplateDTO,
  TemplateVariantDTO,
} from '@/lib/social-export/api-types';
import { extractMatchPrefill, getMatchChips } from '@/lib/social-export/prefill';
import { buildRenderInputs, InputFieldState, validateInputValue, isEditable } from '@/lib/social-export/field-rules';
import { buildRenderImages, type ImageSlotState } from '@/lib/social-export/field-rules-image';
import { NEUTRAL_PLACEMENT } from '@/lib/social-export/image-placement';
import {
  applySavedForm,
  applySavedImages,
  type SavedExportStateDTO,
  type StoredImageSlotState,
} from '@/lib/social-export/saved-state';
import {
  applyImageChange,
  buildGroupRenderBody,
  dimensionsAffectedByImageChange,
  fillToEditorState,
  initDimensionImages,
  initSurfaceForm,
  unionInputs,
  type DimensionImageStates,
} from '@/lib/social-export/group-fill';
import { computeTextLayout } from '@/lib/social-export/text-layout';
import { useWboostFonts } from '@/lib/social-export/use-wboost-fonts';
import { Match } from '@/types/match';

interface PageProps {
  params: Promise<{ id: string }>;
}

/** `?varianta=` value that opens a template GROUP (all member dimensions at once). */
const GROUP_PARAM = 'skupina';

type FormState = Record<string, InputFieldState>;

/**
 * What the editor fills: ONE variant, or a template GROUP (member dimensions
 * sharing one fill). `id` is the fill surface's id — the variant id or the
 * group id — which keys the autosave record and the WBoost export history.
 */
type Surface =
  | { kind: 'variant'; id: string; template: TemplateDTO; members: TemplateVariantDTO[] }
  | { kind: 'group'; id: string; template: TemplateDTO; members: TemplateVariantDTO[] };

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SocialExportPage({ params }: PageProps) {
  // useSearchParams() (used inside) must be wrapped in a Suspense boundary.
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SocialExportPageContent params={params} />
    </Suspense>
  );
}

function SocialExportPageContent({ params }: PageProps) {
  const { id } = use(params);
  const { user, loading: userLoading } = useRequireAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Match data
  const [match, setMatch] = useState<Match | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Templates
  const { templates, isLoading: templatesLoading, error: templatesError } = useSocialExportTemplates();

  // Globally saved editor states for this match (one per fill surface —
  // variant or group), written after every change so an accidental refresh
  // doesn't lose work. A fetch error degrades to "nothing saved".
  const {
    states: savedStates,
    isLoading: savedStatesLoading,
    mutate: mutateSavedStates,
  } = useSavedExportStates(user ? id : null);

  // Wizard selection lives in the URL (?sablona=&varianta=) so it survives a
  // refresh and is deep-linkable. `varianta=skupina` opens a template group.
  const selectedTemplateId = searchParams.get('sablona');
  const selectedVariantParam = searchParams.get('varianta');

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );

  const surface = useMemo<Surface | null>(() => {
    if (!selectedTemplate || !selectedVariantParam) return null;

    if (selectedVariantParam === GROUP_PARAM && selectedTemplate.group) {
      const members = selectedTemplate.variants.filter((v) => v.groupMember);
      return members.length > 0
        ? { kind: 'group', id: selectedTemplate.group.id, template: selectedTemplate, members }
        : null;
    }

    const variant = selectedTemplate.variants.find((v) => v.id === selectedVariantParam);
    return variant
      ? { kind: 'variant', id: variant.id, template: selectedTemplate, members: [variant] }
      : null;
  }, [selectedTemplate, selectedVariantParam]);

  const members = useMemo(() => surface?.members ?? [], [surface]);
  const inputs = useMemo(() => unionInputs(members), [members]);

  // The dimension edited in the big preview (a group shows every dimension in
  // the strip; texts are shared, picture placement is per dimension).
  const [activeDimensionId, setActiveDimensionId] = useState<string | null>(null);
  const activeVariant = members.find((m) => m.id === activeDimensionId) ?? members[0] ?? null;
  const activeId = activeVariant?.id ?? null;

  const savedBySubject = useMemo(
    () => new Map(savedStates.map((s) => [s.variantId, s])),
    [savedStates]
  );
  const savedSubjectIds = useMemo(
    () => new Set(savedStates.map((s) => s.variantId)),
    [savedStates]
  );

  // Form state (keyed by input id, shared by every dimension)
  const [formState, setFormState] = useState<FormState>({});
  // Image-slot state per dimension (variantId → slotId → state)
  const [imageStates, setImageStates] = useState<DimensionImageStates>({});

  // Render state — per dimension
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [renderingIds, setRenderingIds] = useState<ReadonlySet<string>>(new Set());
  const [dirtyIds, setDirtyIds] = useState<ReadonlySet<string>>(new Set());
  const [renderError, setRenderError] = useState<string | null>(null);
  // Structured details of the last failed render / export (container_overflow
  // → the offending container; value errors → inputId / imageInputId; group →
  // the variantId of the dimension that failed).
  const [renderErrorDetails, setRenderErrorDetails] = useState<RenderErrorDetails | null>(null);
  const [exporting, setExporting] = useState(false);

  // Autosave status shown next to the editor title. 'saved' also means a
  // previously saved state was restored when the surface loaded.
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Export history (shared with WBoost): which version is loaded / loading.
  const [loadedVersion, setLoadedVersion] = useState<{ id: string; title: string } | null>(null);
  const [loadingVersionId, setLoadingVersionId] = useState<string | null>(null);

  // Click-into-preview editing: whether the dashed boundary boxes are shown, and
  // which placeholder's floating panel is open.
  const [highlightMode, setHighlightMode] = useState(true);
  const [activePlaceholder, setActivePlaceholder] = useState<ActivePlaceholder | null>(null);

  const historySubject = useMemo(
    () =>
      surface
        ? surface.kind === 'group'
          ? { groupId: surface.id }
          : { variantId: surface.id }
        : null,
    [surface]
  );
  const {
    versions,
    isLoading: versionsLoading,
    error: versionsError,
    mutate: mutateVersions,
  } = useExportVersions(historySubject);

  // Load the real WBoost fonts into document.fonts so the live box measurement
  // wraps like the render (fallback faces give approximate wrap points).
  const { fontsReady } = useWboostFonts();

  // Live text-box frames + predicted container overflow, per dimension.
  // fontsReady is a legitimate extra dependency: the same inputs measure
  // differently once the real fonts land in document.fonts.
  const textLayouts = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, computeTextLayout(m, formState)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members, formState, fontsReady]
  );

  // The overflow pre-check (red zone + blocked download BEFORE the render
  // 400s) is trustworthy only with the real fonts loaded.
  const predictedOverflows = useMemo(() => {
    const result: Record<string, { containerId: string; overflowPx: number }> = {};
    if (!fontsReady) return result;
    for (const [variantId, layout] of Object.entries(textLayouts)) {
      const first = layout.overflows[0];
      if (first) result[variantId] = first;
    }
    return result;
  }, [textLayouts, fontsReady]);

  const failedDimensionId =
    renderErrorDetails?.code === 'container_overflow'
      ? (renderErrorDetails.variantId ?? activeId)
      : null;
  const overflowingIds = useMemo(() => {
    const ids = new Set(Object.keys(predictedOverflows));
    if (failedDimensionId) ids.add(failedDimensionId);
    return ids;
  }, [predictedOverflows, failedDimensionId]);

  // Object URLs of the previews, revoked when replaced / on unmount.
  const previewUrlsRef = useRef<Record<string, string>>({});
  // Set when a debounced auto-preview render fails, to stop it retrying the same
  // failing input state in a loop. Cleared on the next edit.
  const autoPreviewBlockedRef = useRef(false);
  // Bumped on every edit: a render only clears a dimension's dirty flag when
  // no edit happened while it was in flight.
  const editSeqRef = useRef(0);
  // True while there are edits the autosave hasn't persisted yet — gates every
  // save path, so seeding/prefill alone never creates a saved record.
  const hasUnsavedRef = useRef(false);
  // Latest savable payload, kept in a ref so the unload/navigation flush sees
  // the current state without re-subscribing listeners on every keystroke.
  const latestSaveRef = useRef<SaveExportStatePayload | null>(null);
  // "matchId:surfaceId" the editor was last seeded for — stops the saved-states
  // cache refresh from re-seeding over the user's in-progress edits.
  const seededKeyRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Fetch match
  useEffect(() => {
    if (!user) return;

    const fetchMatch = async () => {
      try {
        setMatchLoading(true);
        const res = await fetch(`/api/matches/${id}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Nepodařilo se načíst zápas');
        setMatch(data.data.match);
      } catch (err) {
        setMatchError(err instanceof Error ? err.message : 'Nepodařilo se načíst zápas');
      } finally {
        setMatchLoading(false);
      }
    };

    fetchMatch();
  }, [user, id]);

  // Fire-and-forget save of edits the debounced autosave hasn't sent yet.
  // keepalive lets the PUT finish even while the document unloads (the
  // accidental-refresh case this persistence exists for). The local SWR cache
  // is updated optimistically so re-entering the surface seeds from the
  // flushed state without waiting for the server round-trip.
  const flushPendingSave = useCallback(() => {
    if (!hasUnsavedRef.current) return;
    const payload = latestSaveRef.current;
    if (!payload) return;
    hasUnsavedRef.current = false;

    void mutateSavedStates(
      (prev) => {
        const dto: SavedExportStateDTO = {
          variantId: payload.variantId,
          templateId: payload.templateId,
          state: payload.state,
          updatedAt: new Date().toISOString(),
        };
        return [...(prev ?? []).filter((s) => s.variantId !== dto.variantId), dto];
      },
      { revalidate: false }
    );
    void saveExportState(payload, { keepalive: true });
  }, [mutateSavedStates]);

  const revokeAllPreviews = useCallback(() => {
    Object.values(previewUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = {};
  }, []);

  // When a surface is chosen, seed the form state with sample texts + match
  // prefill, overlaid with the globally saved state for this (match, surface).
  useEffect(() => {
    const seedKey = surface ? `${id}:${surface.id}` : null;

    // Surface switched or editor left: flush pending edits of the previous
    // surface before its snapshot is replaced.
    if (seededKeyRef.current !== seedKey) {
      flushPendingSave();
    }

    if (!surface) {
      seededKeyRef.current = null;
      return;
    }
    if (!match || savedStatesLoading) return;
    if (seededKeyRef.current === seedKey) return;
    seededKeyRef.current = seedKey;

    const prefill = extractMatchPrefill(match, inputs);
    const saved = savedBySubject.get(surface.id) ?? legacyGroupSave(surface, savedStates);
    const seededImages = initDimensionImages(surface.members);

    for (const member of surface.members) {
      seededImages[member.id] = applySavedImages(
        member.imageInputs,
        seededImages[member.id],
        savedImagesFor(saved, member.id)
      );
    }

    setFormState(applySavedForm(inputs, initSurfaceForm(inputs, prefill), saved?.state.formState));
    setImageStates(seededImages);
    setSaveStatus(saved ? 'saved' : 'idle');
    hasUnsavedRef.current = false;
    revokeAllPreviews();
    setPreviews({});
    setActiveDimensionId(surface.members[0]?.id ?? null);
    // Every dimension renders the initial state.
    setDirtyIds(new Set(surface.members.map((m) => m.id)));
    setRenderError(null);
    setRenderErrorDetails(null);
    setActivePlaceholder(null);
    setLoadedVersion(null);
    autoPreviewBlockedRef.current = false;
  }, [surface, inputs, match, id, savedStatesLoading, savedBySubject, savedStates, flushPendingSave, revokeAllPreviews]);

  // Snapshot the latest savable payload for the debounced autosave and the
  // unload flush. Runs after the seeding effect, and only once the current
  // surface has actually been seeded, so a stale form is never snapshotted.
  useEffect(() => {
    latestSaveRef.current =
      surface && seededKeyRef.current === `${id}:${surface.id}`
        ? {
            matchId: id,
            templateId: surface.template.id,
            variantId: surface.id,
            state: {
              formState,
              // Single variant: its one image state. Group: the first
              // dimension here (older readers) + every dimension below.
              imageState: imageStates[surface.members[0]?.id] ?? {},
              ...(surface.kind === 'group' ? { dimensionImageStates: imageStates } : {}),
            },
          }
        : null;
  });

  // Autosave: persist 800ms after the form settles.
  useEffect(() => {
    if (!hasUnsavedRef.current) return;
    const timer = setTimeout(() => {
      void doSave();
    }, 800);
    return () => clearTimeout(timer);
    // doSave is recreated each render; depending on it would reset the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState, imageStates]);

  // Flush pending edits when the page unloads (refresh, tab close) or the
  // component unmounts (SPA navigation back to the match page).
  useEffect(() => {
    window.addEventListener('pagehide', flushPendingSave);
    return () => {
      window.removeEventListener('pagehide', flushPendingSave);
      flushPendingSave();
    };
  }, [flushPendingSave]);

  // Live preview: debounced 1s after the form settles, the dirty dimensions
  // re-render one after another — the edited one first. Skips while a render is
  // in flight, while inputs are invalid, or after a failed auto-render.
  useEffect(() => {
    if (!surface || dirtyIds.size === 0 || renderingIds.size > 0) return;
    if (autoPreviewBlockedRef.current) return;
    if (hasValidationErrors()) return;

    const timer = setTimeout(() => {
      void renderDirtyPreviews();
    }, 1000);
    return () => clearTimeout(timer);
    // renderDirtyPreviews/hasValidationErrors are recreated each render;
    // depending on them would reset the debounce on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState, imageStates, dirtyIds, renderingIds, surface]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  // All step navigation flows through the URL so refresh/back behave naturally.
  const navigate = useCallback(
    (templateId: string | null, variantParam: string | null) => {
      const params = new URLSearchParams();
      if (templateId) params.set('sablona', templateId);
      if (variantParam) params.set('varianta', variantParam);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  function handleSelectTemplate(template: TemplateDTO) {
    // A group whose every variant is a member opens the group editor right
    // away; one with extra hand-added variants lets the user choose.
    if (template.group) {
      const allMembers = template.variants.every((v) => v.groupMember);
      navigate(template.id, allMembers ? GROUP_PARAM : null);
      return;
    }
    // Skip the variant step when there's exactly one variant.
    navigate(template.id, template.variants.length === 1 ? template.variants[0].id : null);
  }

  function handleSelectVariant(variant: TemplateVariantDTO) {
    navigate(selectedTemplateId, variant.id);
  }

  function handleBackToTemplates() {
    navigate(null, null);
  }

  function handleBackToVariants() {
    // A group without extra variants has no variant step to go back to.
    if (surface?.kind === 'group' && selectedTemplate?.variants.every((v) => v.groupMember)) {
      navigate(null, null);
      return;
    }
    navigate(selectedTemplateId, null);
  }

  const markEdited = useCallback((dimensionIds: string[]) => {
    editSeqRef.current += 1;
    hasUnsavedRef.current = true;
    // A fresh edit re-enables the debounced live preview.
    autoPreviewBlockedRef.current = false;
    setDirtyIds((prev) => new Set([...prev, ...dimensionIds]));
  }, []);

  const handleFormChange = useCallback(
    (inputId: string, partial: Partial<InputFieldState>) => {
      setFormState((prev) => ({
        ...prev,
        [inputId]: { ...(prev[inputId] ?? { value: '', hidden: false }), ...partial },
      }));
      markEdited(members.map((m) => m.id));
    },
    [members, markEdited]
  );

  const handleImageChange = useCallback(
    (slotId: string, partial: Partial<ImageSlotState>) => {
      if (!activeId) return;
      setImageStates((prev) => applyImageChange(prev, members, activeId, slotId, partial));
      markEdited(dimensionsAffectedByImageChange(members, activeId, partial));
    },
    [members, activeId, markEdited]
  );

  const handleToggleHighlight = useCallback(() => {
    setHighlightMode((on) => !on);
  }, []);

  function hasValidationErrors(): boolean {
    return inputs.some((input) => {
      if (!isEditable(input)) return false;
      const value = formState[input.id]?.value ?? '';
      return validateInputValue(input, value) !== null;
    });
  }

  async function doSave(): Promise<void> {
    const payload = latestSaveRef.current;
    if (!payload) return;

    setSaveStatus('saving');
    hasUnsavedRef.current = false;

    const result = await saveExportState(payload);
    if (result.error || !result.state) {
      // Mark unsaved again so the next edit (or the unload flush) retries.
      hasUnsavedRef.current = true;
      setSaveStatus('error');
      return;
    }

    setSaveStatus('saved');
    const saved = result.state;
    void mutateSavedStates(
      (prev) => [...(prev ?? []).filter((s) => s.variantId !== saved.variantId), saved],
      { revalidate: false }
    );
  }

  /** Render one dimension with the current fill (`preview` = WebP, `export` = recorded). */
  function renderDimension(variantId: string | null, mode: 'preview' | 'export'): Promise<RenderResult> {
    if (!surface) return Promise.resolve({ error: 'Není vybraná šablona' });

    if (surface.kind === 'group') {
      return renderGroup(
        {
          groupId: surface.id,
          ...(variantId ? { variantId } : {}),
          ...buildGroupRenderBody(surface.members, formState, imageStates),
        },
        mode
      );
    }

    const variant = surface.members[0];
    return renderVariant(
      variant.id,
      buildRenderInputs(variant.inputs, formState),
      buildRenderImages(variant.imageInputs, imageStates[variant.id] ?? {}),
      mode
    );
  }

  /** Surface a failed render / export: message + structured details (+ jump to it). */
  function showRenderError(result: RenderResult, variantId: string | null) {
    const details: RenderErrorDetails = {
      ...(result.errorDetails ?? {}),
      ...(result.errorDetails?.variantId || !variantId ? {} : { variantId }),
    };
    setRenderError(result.error ?? 'Generování selhalo');
    setRenderErrorDetails(details);

    // Point at the culprit: its dimension, then its field.
    if (details.variantId && members.some((m) => m.id === details.variantId)) {
      setActiveDimensionId(details.variantId);
    }
    if (details.inputId) {
      setActivePlaceholder({ kind: 'text', id: details.inputId });
    }
  }

  async function renderDirtyPreviews(): Promise<void> {
    if (!surface || !activeId) return;

    const order = [activeId, ...members.map((m) => m.id).filter((mid) => mid !== activeId)].filter(
      (mid) => dirtyIds.has(mid)
    );

    for (const variantId of order) {
      const seq = editSeqRef.current;
      setRenderingIds(new Set([variantId]));
      const result = await renderDimension(variantId, 'preview');
      setRenderingIds(new Set());

      if (result.error || !result.blob) {
        showRenderError(result, variantId);
        // Stop the debounced preview from retrying the same failing state.
        autoPreviewBlockedRef.current = true;
        return;
      }

      const previous = previewUrlsRef.current[variantId];
      if (previous) URL.revokeObjectURL(previous);
      const url = URL.createObjectURL(result.blob);
      previewUrlsRef.current[variantId] = url;
      setPreviews((prev) => ({ ...prev, [variantId]: url }));
      setRenderError(null);
      setRenderErrorDetails(null);

      if (editSeqRef.current === seq) {
        setDirtyIds((prev) => {
          const next = new Set(prev);
          next.delete(variantId);
          return next;
        });
      }
    }
  }

  /**
   * Download: a single variant as PNG, a group dimension as PNG, or the whole
   * group as ZIP (`variantId` null). Always a fresh EXPORT render — it is
   * recorded in the WBoost export history (the preview is not).
   */
  async function handleExport(variantId: string | null) {
    if (!surface || hasValidationErrors() || exporting) return;

    setExporting(true);
    setRenderError(null);
    setRenderErrorDetails(null);

    try {
      const result = await renderDimension(variantId, 'export');
      if (result.error || !result.blob) {
        showRenderError(result, variantId);
        return;
      }

      downloadBlob(result.blob, result.filename ?? fallbackFilename(surface, variantId));
      void mutateVersions();
    } finally {
      setExporting(false);
    }
  }

  async function handleLoadVersion(version: ExportVersionDTO) {
    if (!surface) return;

    setLoadingVersionId(version.id);
    const result = await fetchExportVersion(version.id);
    setLoadingVersionId(null);

    if (!result.version) {
      setRenderError(result.error ?? 'Verzi se nepodařilo načíst');
      return;
    }

    const loaded = fillToEditorState(result.version.fill, surface.members);
    setFormState(loaded.formState);
    setImageStates(loaded.imageStates);
    setActivePlaceholder(null);
    setRenderError(null);
    setRenderErrorDetails(null);
    setLoadedVersion({ id: version.id, title: versionTitle(version) });
    // The loaded fill becomes the match's working draft (autosave) and every
    // dimension re-renders it.
    markEdited(surface.members.map((m) => m.id));
  }

  async function handleRenameVersion(version: ExportVersionDTO, name: string | null) {
    const result = await updateExportVersion(version.id, { name });
    if (result.error) setRenderError(result.error);
    void mutateVersions();
  }

  async function handleTogglePinVersion(version: ExportVersionDTO) {
    const result = await updateExportVersion(version.id, { pinned: !version.pinned });
    if (result.error) setRenderError(result.error);
    void mutateVersions();
  }

  // ---------------------------------------------------------------------------
  // Derived values for the header summary
  // ---------------------------------------------------------------------------

  function formatMatchSummary(m: Match): string {
    const [year, month, day] = m.matchDate.split('-').map(Number);
    const date = `${day}. ${month}. ${year}`;
    const time = m.matchTime ? ` ${m.matchTime.slice(0, 5)}` : '';
    return `${date}${time}`;
  }

  // ---------------------------------------------------------------------------
  // Loading / error guards
  // ---------------------------------------------------------------------------

  if (userLoading || matchLoading) {
    return <LoadingSpinner />;
  }

  if (!user) return null;

  if (matchError) {
    return (
      <div className="bg-background py-8">
        <div className="max-w-5xl mx-auto px-4">
          <Alert variant="error">{matchError}</Alert>
          <div className="mt-4">
            <Link href={`/vysledek/${id}`}>
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zpět na zápas
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!match) return null;

  // ---------------------------------------------------------------------------
  // Determine current wizard step
  // Step 1 — no template; Step 2 — template but no variant; Step 3 — editor
  // ---------------------------------------------------------------------------

  const step: 1 | 2 | 3 = surface ? 3 : selectedTemplate ? 2 : 1;
  // True while a deep link / refresh is waiting for templates or the saved
  // editor states to load (the editor must not seed before both are in).
  const restoring = !!selectedTemplateId && (templatesLoading || savedStatesLoading);
  const chips = match ? getMatchChips(match) : [];
  // Editable text inputs that can't be drawn as a preview box (no frame) — they
  // get a small fallback list under the preview so they stay reachable.
  const unplacedInputs = activeVariant
    ? activeVariant.inputs.filter((input) => isEditable(input) && !input.frame)
    : [];

  const invalid = step === 3 && hasValidationErrors();
  const activeOverflow = activeId ? predictedOverflows[activeId] ?? null : null;
  const zipDisabled = exporting || invalid || Object.keys(predictedOverflows).length > 0;
  const dimensionDownloadDisabled = (variantId: string) =>
    exporting || invalid || predictedOverflows[variantId] != null;
  const activeErrorContainerId =
    renderErrorDetails?.code === 'container_overflow' && failedDimensionId === activeId
      ? (renderErrorDetails.containerId ?? null)
      : null;

  // Breadcrumb crumb styling: current step (active), a past step (clickable), or
  // a not-yet-reached step (muted).
  const crumbClass = (active: boolean, clickable: boolean): string =>
    active
      ? 'font-semibold text-text-primary'
      : clickable
        ? 'text-accent hover:underline'
        : 'text-text-muted';

  const variantCrumb =
    surface?.kind === 'group'
      ? ': všechny rozměry'
      : surface
        ? `: ${surface.members[0].dimension}`
        : '';

  const groupActions =
    surface?.kind === 'group' && activeVariant ? (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="md"
          onClick={() => void handleExport(activeVariant.id)}
          disabled={dimensionDownloadDisabled(activeVariant.id)}
        >
          <Download className="mr-2 h-4 w-4" />
          PNG {activeVariant.dimension}
        </Button>
        <Button variant="accent" size="md" onClick={() => void handleExport(null)} disabled={zipDisabled}>
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderArchive className="mr-2 h-4 w-4" />}
          Stáhnout vše (ZIP)
        </Button>
      </div>
    ) : undefined;

  return (
    <div className="bg-background py-8">
      <div className="max-w-5xl mx-auto px-4">

        {/* Top bar: back to match + title + match summary */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href={`/vysledek/${id}`}>
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zpět na zápas
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-text-primary mt-3">Export pro sociální sítě</h1>
          </div>

          <div className="rounded-xl border border-border bg-surface px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-text-primary">{match.homeTeam}</span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-border font-bold text-text-primary tabular-nums">
                {match.homeScore != null && match.awayScore != null
                  ? `${match.homeScore} : ${match.awayScore}`
                  : 'vs'}
              </span>
              <span className="font-semibold text-text-primary">{match.awayTeam}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-text-muted mt-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatMatchSummary(match)}
            </div>
          </div>
        </div>

        {/* Breadcrumb step navigation (also serves as back navigation) */}
        {!restoring && (
          <nav className="mb-5 flex items-center gap-2 text-sm flex-wrap">
            <button
              type="button"
              onClick={handleBackToTemplates}
              disabled={step === 1}
              className={crumbClass(step === 1, step > 1)}
            >
              1. Šablona{selectedTemplate ? `: ${selectedTemplate.name}` : ''}
            </button>
            <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
            <button
              type="button"
              onClick={handleBackToVariants}
              disabled={step !== 3}
              className={crumbClass(step === 2, step === 3)}
            >
              2. Varianta{variantCrumb}
            </button>
            <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
            <span className={crumbClass(step === 3, false)}>3. Úprava</span>
          </nav>
        )}

        {/* Restoring a deep link while templates load */}
        {restoring && (
          <Card variant="elevated">
            <LoadingSpinner fullscreen={false} size="md" message="Načítání…" />
          </Card>
        )}

        {/* Step 1: Template grid */}
        {!restoring && step === 1 && (
          <Card variant="elevated">
            {templatesLoading && (
              <LoadingSpinner fullscreen={false} size="md" message="Načítání šablon..." />
            )}
            {!templatesLoading && templatesError && (
              <Alert variant="error">{templatesError}</Alert>
            )}
            {!templatesLoading && !templatesError && templates.length === 0 && (
              <Alert variant="info">Žádné šablony nejsou k dispozici.</Alert>
            )}
            {!templatesLoading && !templatesError && templates.length > 0 && (
              <TemplateGrid
                templates={templates}
                onSelect={handleSelectTemplate}
                savedVariantIds={savedSubjectIds}
              />
            )}
          </Card>
        )}

        {/* Step 2: Variant chooser */}
        {!restoring && step === 2 && selectedTemplate && (
          <Card variant="elevated">
            <VariantChooser
              template={selectedTemplate}
              onSelect={handleSelectVariant}
              onSelectGroup={() => navigate(selectedTemplate.id, GROUP_PARAM)}
              onBack={handleBackToTemplates}
              savedVariantIds={savedSubjectIds}
            />
          </Card>
        )}

        {/* Step 3: the rendered graphic IS the editor. */}
        {!restoring && step === 3 && surface && activeVariant && (
          <Card variant="elevated">
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  {surface.template.name} —{' '}
                  {surface.kind === 'group' ? 'všechny rozměry' : activeVariant.dimension}
                </h2>
                {surface.kind === 'group' && (
                  <p className="text-xs text-text-muted">
                    Vyplňte obsah jednou — propíše se do všech rozměrů. Umístění obrázku nastavíte
                    zvlášť pro každý rozměr.
                  </p>
                )}
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
              <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-accent" />
                  Načtena verze <strong className="text-text-primary">{loadedVersion.title}</strong> — úpravy
                  se ukládají jako rozpracovaný stav tohoto zápasu.
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

            {surface.kind === 'group' && (
              <div className="mb-5">
                <DimensionStrip
                  members={surface.members}
                  activeId={activeVariant.id}
                  onActivate={(variantId) => {
                    setActiveDimensionId(variantId);
                    setActivePlaceholder(null);
                  }}
                  previews={previews}
                  renderingIds={renderingIds}
                  overflowingIds={overflowingIds}
                  onDownload={(variantId) => void handleExport(variantId)}
                  downloadDisabled={dimensionDownloadDisabled}
                />
              </div>
            )}

            <PreviewPanel
              key={activeVariant.id}
              variant={activeVariant}
              previewUrl={previews[activeVariant.id] ?? null}
              isRendering={renderingIds.has(activeVariant.id) || (exporting && surface.kind === 'variant')}
              highlightMode={highlightMode}
              onToggleHighlight={handleToggleHighlight}
              active={activePlaceholder}
              onSelect={setActivePlaceholder}
              onCloseActive={() => setActivePlaceholder(null)}
              formState={formState}
              onFormChange={handleFormChange}
              chips={chips}
              imageState={imageStates[activeVariant.id] ?? {}}
              onImageChange={handleImageChange}
              matchId={match.id}
              matchImages={match.images}
              onDownload={() => void handleExport(activeVariant.id)}
              actionsDisabled={exporting || invalid || activeOverflow != null}
              actions={groupActions}
              renderError={
                renderError && renderErrorDetails?.variantId && renderErrorDetails.variantId !== activeVariant.id
                  ? `${renderError} (rozměr ${members.find((m) => m.id === renderErrorDetails.variantId)?.dimension ?? ''})`
                  : renderError
              }
              overflowContainerId={activeErrorContainerId ?? activeOverflow?.containerId ?? null}
              overflowWarning={
                activeOverflow && !renderError
                  ? `Texty se nevejdou do vymezené oblasti (přesah ${Math.ceil(
                      activeOverflow.overflowPx
                    )} px). Zkraťte prosím zvýrazněné texty.`
                  : null
              }
              textFrames={textLayouts[activeVariant.id]?.frames ?? {}}
            />

            {/* Fallback for any editable text fields that have no position in the
                preview (no frame) — they can't be drawn as a box, so keep them
                reachable here. Empty (hidden) for normal templates. */}
            {unplacedInputs.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-text-secondary">
                  Pole bez pozice v náhledu
                </h3>
                <p className="mb-3 mt-0.5 text-xs text-text-muted">
                  Tato pole nemají v náhledu vlastní oblast — upravte je zde. Změny se projeví
                  v exportu stejně jako úpravy přímo v náhledu.
                </p>
                <ExportInputForm
                  variant={{ ...activeVariant, inputs: unplacedInputs, imageInputs: [] }}
                  chips={chips}
                  state={formState}
                  onChange={handleFormChange}
                  showActions={false}
                />
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A group has no record of its own yet when its dimensions were edited one by
 * one before group editing existed — carry over the newest of those records
 * (texts shared, that dimension's picture placement kept).
 */
function legacyGroupSave(surface: Surface, states: SavedExportStateDTO[]): SavedExportStateDTO | undefined {
  if (surface.kind !== 'group') return undefined;
  const memberIds = new Set(surface.members.map((m) => m.id));
  return states
    .filter((s) => memberIds.has(s.variantId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

/** The saved image state that applies to one dimension of the surface. */
function savedImagesFor(
  saved: SavedExportStateDTO | undefined,
  variantId: string
): Record<string, StoredImageSlotState> | undefined {
  if (!saved) return undefined;

  const perDimension = saved.state.dimensionImageStates?.[variantId];
  if (perDimension) return perDimension;
  // A group record without this dimension (added in WBoost since the save).
  if (saved.state.dimensionImageStates) return undefined;
  // The variant's own record (or a legacy member record of this dimension).
  if (saved.variantId === variantId) return saved.state.imageState;

  // A legacy member record applied to ANOTHER dimension: the picked pictures
  // carry over, their placement (made for another frame) does not.
  return Object.fromEntries(
    Object.entries(saved.state.imageState ?? {}).map(([slotId, slot]) => [
      slotId,
      { ...slot, ...NEUTRAL_PLACEMENT, offsetX: undefined, offsetY: undefined },
    ])
  );
}

function versionTitle(version: ExportVersionDTO): string {
  return (
    version.name ??
    new Date(version.lastExportedAt).toLocaleString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  );
}

/** Download name when WBoost sent none (it normally does). */
function fallbackFilename(surface: Surface, variantId: string | null): string {
  const base = sanitizeFilename(surface.template.name);
  if (!variantId) return `${base}.zip`;
  const variant = surface.members.find((m) => m.id === variantId);
  // Ratio dimensions ('1:1') become '1x1'; size labels ('210 × 297 mm') are sanitized.
  return `${base}-${sanitizeFilename((variant?.dimension ?? 'export').replace(':', 'x'))}.png`;
}

// ---------------------------------------------------------------------------
// Autosave status badge ("Uloženo" = a saved state exists for this surface)
// ---------------------------------------------------------------------------

function SaveStatusBadge({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null;

  if (status === 'saving') {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-xs text-text-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Ukládám…
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span role="status" className="inline-flex items-center gap-1.5 text-xs text-danger-text">
        <AlertCircle className="w-3.5 h-3.5" />
        Uložení selhalo — zkusíme to při další změně
      </span>
    );
  }

  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-xs text-success-text">
      <CheckCircle2 className="w-3.5 h-3.5" />
      Uloženo
    </span>
  );
}
