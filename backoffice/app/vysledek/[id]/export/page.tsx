'use client';

import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import {
  useSocialExportTemplates,
  useSavedExportStates,
  saveExportState,
  renderVariant,
  downloadBlob,
  sanitizeFilename,
  type SaveExportStatePayload,
} from '@/hooks/api/use-social-export';
import TemplateGrid from '@/components/social-export/TemplateGrid';
import VariantChooser from '@/components/social-export/VariantChooser';
import ExportInputForm from '@/components/social-export/ExportInputForm';
import PreviewPanel from '@/components/social-export/PreviewPanel';
import type { ActivePlaceholder } from '@/components/social-export/PlaceholderOverlay';
import { TemplateDTO, TemplateVariantDTO,
  RenderErrorDetails,
} from '@/lib/social-export/api-types';
import { extractMatchPrefill, getMatchChips } from '@/lib/social-export/prefill';
import { buildRenderInputs, InputFieldState, validateInputValue, isEditable } from '@/lib/social-export/field-rules';
import {
  buildRenderImages,
  defaultImageSlotState,
  type ImageSlotState,
} from '@/lib/social-export/field-rules-image';
import { applySavedState, type SavedExportStateDTO } from '@/lib/social-export/saved-state';
import { Match } from '@/types/match';

interface PageProps {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Form state reducer helpers
// ---------------------------------------------------------------------------

type FormState = Record<string, InputFieldState>;

function initFormState(variant: TemplateVariantDTO, prefill: Record<string, string>): FormState {
  return Object.fromEntries(
    variant.inputs.map((input) => [
      input.id,
      { value: prefill[input.id] ?? '', hidden: false },
    ])
  );
}

type ImageState = Record<string, ImageSlotState>;

function initImageState(variant: TemplateVariantDTO): ImageState {
  return Object.fromEntries(
    variant.imageInputs.map((slot) => [slot.id, defaultImageSlotState()])
  );
}

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

  // Globally saved editor states for this match (one per variant), written
  // after every change so an accidental refresh doesn't lose work. A fetch
  // error degrades to "nothing saved" — the editor still seeds from prefill.
  const {
    states: savedStates,
    isLoading: savedStatesLoading,
    mutate: mutateSavedStates,
  } = useSavedExportStates(user ? id : null);

  // Wizard selection lives in the URL (?sablona=&varianta=) so it survives a
  // refresh and is deep-linkable. Derive the selected objects from the params.
  const selectedTemplateId = searchParams.get('sablona');
  const selectedVariantId = searchParams.get('varianta');

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId]
  );
  const selectedVariant = useMemo(
    () => selectedTemplate?.variants.find((v) => v.id === selectedVariantId) ?? null,
    [selectedTemplate, selectedVariantId]
  );

  const savedByVariant = useMemo(
    () => new Map(savedStates.map((s) => [s.variantId, s])),
    [savedStates]
  );
  const savedVariantIds = useMemo(
    () => new Set(savedStates.map((s) => s.variantId)),
    [savedStates]
  );

  // Form state (keyed by input id)
  const [formState, setFormState] = useState<FormState>({});
  // Image-slot state (keyed by imageInput id)
  const [imageState, setImageState] = useState<ImageState>({});

  // Render state
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  // Structured details of the last failed render (container_overflow → the
  // offending container's id, used to highlight its fields in the overlay).
  const [renderErrorDetails, setRenderErrorDetails] = useState<RenderErrorDetails | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [dirty, setDirty] = useState(false);

  // Autosave status shown next to the editor title. 'saved' also means a
  // previously saved state was restored when the variant loaded.
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Click-into-preview editing: whether the dashed boundary boxes are shown, and
  // which placeholder's floating panel is open. The preview IS the editor now —
  // the tool icons are always visible; this toggle only controls the dashed
  // boxes, defaulting ON to make the editable areas discoverable.
  const [highlightMode, setHighlightMode] = useState(true);
  const [activePlaceholder, setActivePlaceholder] = useState<ActivePlaceholder | null>(null);

  // Track object URLs for cleanup
  const previewUrlRef = useRef<string | null>(null);
  // Guard against overlapping renders (state updates are async, so a ref is the
  // reliable re-entrancy lock for back-to-back Preview/Download clicks).
  const isRenderingRef = useRef(false);
  // Set when a debounced auto-preview render fails, to stop it retrying the same
  // failing input state in a loop. Cleared on the next edit or a manual "Náhled".
  const autoPreviewBlockedRef = useRef(false);
  // True while there are edits the autosave hasn't persisted yet — gates every
  // save path, so seeding/prefill alone never creates a saved record.
  const hasUnsavedRef = useRef(false);
  // Latest savable payload, kept in a ref so the unload/navigation flush sees
  // the current state without re-subscribing listeners on every keystroke.
  const latestSaveRef = useRef<SaveExportStatePayload | null>(null);
  // "matchId:variantId" the editor was last seeded for — stops the saved-states
  // cache refresh from re-seeding over the user's in-progress edits.
  const seededKeyRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
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
  // is updated optimistically so re-entering the variant seeds from the
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

  // When a variant is chosen, seed the form state with match prefill, overlaid
  // with the globally saved state for this (match, variant) if there is one.
  useEffect(() => {
    const seedKey = selectedVariant ? `${id}:${selectedVariant.id}` : null;

    // Variant switched or editor left: flush pending edits of the previous
    // variant before its snapshot is replaced.
    if (seededKeyRef.current !== seedKey) {
      flushPendingSave();
    }

    if (!selectedVariant) {
      seededKeyRef.current = null;
      return;
    }
    if (!match || savedStatesLoading) return;
    if (seededKeyRef.current === seedKey) return;
    seededKeyRef.current = seedKey;

    // Auto-advance if template has exactly one variant (already handled in handleSelectTemplate)
    const prefill = extractMatchPrefill(match, selectedVariant.inputs);
    const saved = savedByVariant.get(selectedVariant.id);
    const { formState: seededForm, imageState: seededImages, restored } = applySavedState(
      selectedVariant,
      initFormState(selectedVariant, prefill),
      initImageState(selectedVariant),
      saved?.state
    );
    setFormState(seededForm);
    setImageState(seededImages);
    setSaveStatus(restored ? 'saved' : 'idle');
    hasUnsavedRef.current = false;
    setPreviewUrl(null);
    setPreviewBlob(null);
    // dirty=true so the live preview renders the initial prefilled state.
    setDirty(true);
    setRenderError(null);
    setRenderErrorDetails(null);
    setActivePlaceholder(null);
    autoPreviewBlockedRef.current = false;

    // Revoke previous object URL
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, [selectedVariant, match, id, savedStatesLoading, savedByVariant, flushPendingSave]);

  // Snapshot the latest savable payload for the debounced autosave and the
  // unload flush. Runs after the seeding effect, and only once the current
  // variant has actually been seeded, so a stale form is never snapshotted.
  useEffect(() => {
    latestSaveRef.current =
      selectedTemplate &&
      selectedVariant &&
      seededKeyRef.current === `${id}:${selectedVariant.id}`
        ? {
            matchId: id,
            templateId: selectedTemplate.id,
            variantId: selectedVariant.id,
            state: { formState, imageState },
          }
        : null;
  });

  // Autosave: persist 800ms after the form settles. The saved state is global
  // (all users share one record per match+variant), so a refresh — accidental
  // or not — restores the last edits.
  useEffect(() => {
    if (!hasUnsavedRef.current) return;
    const timer = setTimeout(() => {
      void doSave();
    }, 800);
    return () => clearTimeout(timer);
    // doSave is recreated each render; depending on it would reset the debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState, imageState]);

  // Flush pending edits when the page unloads (refresh, tab close) or the
  // component unmounts (SPA navigation back to the match page).
  useEffect(() => {
    window.addEventListener('pagehide', flushPendingSave);
    return () => {
      window.removeEventListener('pagehide', flushPendingSave);
      flushPendingSave();
    };
  }, [flushPendingSave]);

  // Live preview: debounced auto-render 1s after the form settles. Skips while a
  // render is in flight, while inputs are invalid, or after a failed auto-render
  // (until the next edit / manual "Náhled"). The "Náhled" button renders instantly.
  useEffect(() => {
    if (!selectedVariant || !dirty || isRendering) return;
    if (autoPreviewBlockedRef.current) return;
    if (hasValidationErrors()) return;

    const timer = setTimeout(() => {
      void doRender({ auto: true });
    }, 1000);
    return () => clearTimeout(timer);
    // doRender/hasValidationErrors are recreated each render; depending on them
    // would reset the debounce on every render. Intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState, imageState, dirty, isRendering, selectedVariant]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  // All step navigation flows through the URL so refresh/back behave naturally.
  const navigate = useCallback(
    (templateId: string | null, variantId: string | null) => {
      const params = new URLSearchParams();
      if (templateId) params.set('sablona', templateId);
      if (variantId) params.set('varianta', variantId);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  function handleSelectTemplate(template: TemplateDTO) {
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
    navigate(selectedTemplateId, null);
  }

  const handleFormChange = useCallback(
    (inputId: string, partial: Partial<InputFieldState>) => {
      setFormState((prev) => ({
        ...prev,
        [inputId]: { ...(prev[inputId] ?? { value: '', hidden: false }), ...partial },
      }));
      setDirty(true);
      hasUnsavedRef.current = true;
      // A fresh edit re-enables the debounced live preview.
      autoPreviewBlockedRef.current = false;
    },
    []
  );

  const handleImageChange = useCallback(
    (slotId: string, partial: Partial<ImageSlotState>) => {
      setImageState((prev) => ({
        ...prev,
        [slotId]: { ...(prev[slotId] ?? defaultImageSlotState()), ...partial },
      }));
      setDirty(true);
      hasUnsavedRef.current = true;
      // A fresh edit re-enables the debounced live preview.
      autoPreviewBlockedRef.current = false;
    },
    []
  );

  const handleToggleHighlight = useCallback(() => {
    // Only flips the dashed boundary boxes; the tool icons and any open editing
    // panel stay put (editing no longer depends on this toggle).
    setHighlightMode((on) => !on);
  }, []);

  function hasValidationErrors(): boolean {
    if (!selectedVariant) return false;
    return selectedVariant.inputs.some((input) => {
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

  async function doRender(opts?: { auto?: boolean }): Promise<Blob | null> {
    if (!selectedVariant) return null;
    // Re-entrancy guard: ignore a second render while one is in flight, so we
    // never leak an object URL or leave the spinner stuck.
    if (isRenderingRef.current) return null;

    isRenderingRef.current = true;
    setIsRendering(true);
    setRenderError(null);
    setRenderErrorDetails(null);

    try {
      const payload = buildRenderInputs(selectedVariant.inputs, formState);
      const imagePayload = buildRenderImages(selectedVariant.imageInputs, imageState);
      const result = await renderVariant(selectedVariant.id, payload, imagePayload);

      if (result.error) {
        setRenderError(result.error);
        setRenderErrorDetails(result.errorDetails ?? null);
        // Stop the debounced preview from retrying the same failing state.
        if (opts?.auto) autoPreviewBlockedRef.current = true;
        return null;
      }

      const blob = result.blob!;

      // Revoke previous URL before setting a new one
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setPreviewBlob(blob);
      setDirty(false);

      return blob;
    } finally {
      isRenderingRef.current = false;
      setIsRendering(false);
    }
  }

  async function handleDownload() {
    if (hasValidationErrors() || !selectedTemplate || !selectedVariant) return;

    let blob = previewBlob;

    // Re-render if the form is dirty or no cached blob
    if (dirty || !blob) {
      blob = await doRender();
      if (!blob) return; // render failed — error already set
    }

    const filename = `${sanitizeFilename(selectedTemplate.name)}-${selectedVariant.dimension.replace(':', 'x')}.png`;
    downloadBlob(blob, filename);
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
  // Step 1 — no template; Step 2 — template but no variant; Step 3 — both chosen
  // ---------------------------------------------------------------------------

  const step: 1 | 2 | 3 = selectedVariant ? 3 : selectedTemplate ? 2 : 1;
  // True while a deep link / refresh is waiting for templates or the saved
  // editor states to load (the editor must not seed before both are in).
  const restoring = !!selectedTemplateId && (templatesLoading || savedStatesLoading);
  const chips = match ? getMatchChips(match) : [];
  // Editable text inputs that can't be drawn as a preview box (no frame) — they
  // get a small fallback list under the preview so they stay reachable.
  const unplacedInputs = selectedVariant
    ? selectedVariant.inputs.filter((input) => isEditable(input) && !input.frame)
    : [];

  // Breadcrumb crumb styling: current step (active), a past step (clickable), or
  // a not-yet-reached step (muted).
  const crumbClass = (active: boolean, clickable: boolean): string =>
    active
      ? 'font-semibold text-text-primary'
      : clickable
        ? 'text-accent hover:underline'
        : 'text-text-muted';

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
              2. Varianta{selectedVariant ? `: ${selectedVariant.dimension}` : ''}
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
                savedVariantIds={savedVariantIds}
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
              onBack={handleBackToTemplates}
              savedVariantIds={savedVariantIds}
            />
          </Card>
        )}

        {/* Step 3: Full-width preview — the rendered graphic IS the editor. */}
        {!restoring && step === 3 && selectedTemplate && selectedVariant && (
          <Card variant="elevated">
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-base font-semibold text-text-primary">
                {selectedTemplate.name} — {selectedVariant.dimension}
              </h2>
              <SaveStatusBadge status={saveStatus} />
            </div>
            <PreviewPanel
              variant={selectedVariant}
              previewUrl={previewUrl}
              isRendering={isRendering}
              highlightMode={highlightMode}
              onToggleHighlight={handleToggleHighlight}
              active={activePlaceholder}
              onSelect={setActivePlaceholder}
              onCloseActive={() => setActivePlaceholder(null)}
              formState={formState}
              onFormChange={handleFormChange}
              chips={chips}
              imageState={imageState}
              onImageChange={handleImageChange}
              matchId={match.id}
              matchImages={match.images}
              onDownload={handleDownload}
              actionsDisabled={isRendering || hasValidationErrors()}
              renderError={renderError}
              overflowContainerId={
                renderErrorDetails?.code === 'container_overflow'
                  ? (renderErrorDetails.containerId ?? null)
                  : null
              }
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
                  variant={{ ...selectedVariant, inputs: unplacedInputs, imageInputs: [] }}
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
// Autosave status badge ("Uloženo" = a saved state exists for this variant)
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
