/**
 * WBoost Brand-Manuals API client.
 *
 * Uses raw `fetch` (NOT HttpClient) because:
 *  - The token call is form-encoded.
 *  - The render/thumbnail calls return raw binary image bytes, not JSON.
 *
 * All auth is handled by the injected WboostTokenManager. A 401 from a
 * downstream call triggers token invalidation + a single retry.
 */

import * as Sentry from '@sentry/nextjs';
import { AppError, ErrorCode, NetworkError } from '@/lib/core/errors';
import { getWboostConfig, WboostConfig } from '@/lib/config';
import { getWboostTokenManager, WboostTokenManager } from './token-manager';
import type {
  WboostRawTemplate,
  WboostRawGalleryImage,
  WboostRawProjectFont,
  WboostRawExportVersion,
  WboostRawExportVersionDetail,
} from './types';
import type {
  GroupPlacements,
  RenderInputValue,
  RenderImageValue,
} from '@/lib/social-export/api-types';

// --------------------------------------------------------------------------
// Error message map (Czech)
// --------------------------------------------------------------------------

/**
 * Structured error body of a WBoost render 400 / 503: `{ error, code, ... }`
 * with the offending `inputId` / `imageInputId` (value errors), `containerId`
 * + `overflowPx` (container_overflow) and, for group renders, the `variantId`
 * of the dimension that failed.
 */
export interface WboostErrorBody {
  error?: string;
  code?: string;
  containerId?: string | null;
  overflowPx?: number;
  inputId?: string;
  imageInputId?: string;
  variantId?: string;
  maxLength?: number;
  transform?: string;
}

/** Czech message per WBoost error `code` (the fields themselves are highlighted by id). */
const CODE_MESSAGES: Record<string, string> = {
  container_overflow: 'Texty se nevejdou do vymezené oblasti šablony — zkraťte zvýrazněná pole',
  value_too_long: 'Text je delší, než šablona dovoluje',
  invalid_value: 'Neplatná hodnota textového pole',
  rich_text_not_allowed: 'Toto pole nepodporuje formátování textu',
  invalid_rich_text: 'Formátovaný text je neplatný',
  font_not_allowed: 'Zvolené písmo není pro toto pole povolené',
  color_not_allowed: 'Zvolená barva není pro toto pole povolená',
  invalid_color: 'Neplatná barva textu',
  lists_not_allowed: 'Toto pole nepodporuje seznamy',
  checkbox_lists_not_allowed: 'Toto pole nepodporuje zaškrtávací seznamy',
  invalid_image_value: 'Neplatné nastavení obrázku',
  image_transform_not_allowed: 'Tento obrázek nelze posouvat, zvětšovat nebo otáčet',
  image_not_allowed: 'Vybraný obrázek už není k dispozici nebo do tohoto pole nepatří — vyberte jiný',
  image_unreadable: 'Vybraný obrázek se nepodařilo načíst — vyberte jiný',
  render_unavailable: 'Generování obrázků je momentálně přetížené — zkuste to prosím za chvíli',
};

function mapStatusToMessage(status: number, body?: WboostErrorBody): string {
  if (body?.code && CODE_MESSAGES[body.code]) {
    return CODE_MESSAGES[body.code];
  }
  switch (status) {
    case 400:
      return 'Neplatný požadavek nebo hodnota je příliš dlouhá';
    case 401:
      return 'Autorizace selhala';
    case 403:
      return 'Tato varianta není dostupná';
    case 404:
      return 'Šablona nebyla nalezena';
    case 500:
      return 'Chyba při generování obrázku';
    case 503:
      return CODE_MESSAGES.render_unavailable;
    default:
      return `Neočekávaná chyba WBoost (${status})`;
  }
}

function mapStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCode.VALIDATION_FAILED;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

// --------------------------------------------------------------------------
// Client
// --------------------------------------------------------------------------

/** `preview` = unrecorded WebP for the screen; `export` = the recorded download. */
export type RenderMode = 'preview' | 'export';

/** A rendered image / archive with the metadata WBoost sent along. */
export interface WboostRenderedFile {
  body: Uint8Array;
  contentType: string;
  /** From Content-Disposition (`{group}-{dimension}.png`, `{group}.zip`), when sent. */
  filename: string | null;
}

/** `attachment; filename="x.zip"` → `x.zip` (null when absent). */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match ? match[1] : null;
}

export class WboostClient {
  constructor(
    private readonly config: WboostConfig,
    private readonly tokenManager: WboostTokenManager
  ) {}

  // ---------- Public methods -----------------------------------------------

  async listTemplates(): Promise<WboostRawTemplate[]> {
    const url = `${this.config.apiBase}/api/projects/${this.config.projectId}/templates`;

    Sentry.addBreadcrumb({
      category: 'wboost',
      message: 'Fetching templates list',
      level: 'info',
      data: { projectId: this.config.projectId },
    });

    const res = await this.authedFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    try {
      return (await res.json()) as WboostRawTemplate[];
    } catch {
      throw new AppError(
        'WBoost templates endpoint vrátil neplatný JSON',
        ErrorCode.INTERNAL_ERROR,
        502
      );
    }
  }

  /**
   * List the project's font faces (`family` = the exact Fabric string that
   * `inputs[].textStyle.fontFamily` and rich runs carry). Older API deploys
   * don't have this endpoint (404) — callers fall back to the per-variant
   * `richTextOptions.fonts`.
   */
  async listProjectFonts(): Promise<WboostRawProjectFont[]> {
    const url = `${this.config.apiBase}/api/projects/${this.config.projectId}/fonts`;

    Sentry.addBreadcrumb({
      category: 'wboost',
      message: 'Fetching project fonts',
      level: 'info',
      data: { projectId: this.config.projectId },
    });

    const res = await this.authedFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    try {
      return (await res.json()) as WboostRawProjectFont[];
    } catch {
      throw new AppError(
        'WBoost fonts endpoint vrátil neplatný JSON',
        ErrorCode.INTERNAL_ERROR,
        502
      );
    }
  }

  /**
   * Render one variant. `preview` → WBoost's unrecorded WebP preview (the
   * debounced live preview), `export` → the recorded PNG download (usage +
   * a version in the variant's export history). Never download a preview.
   */
  async renderVariant(
    variantId: string,
    inputs: Record<string, RenderInputValue>,
    images: Record<string, RenderImageValue> | undefined,
    mode: RenderMode
  ): Promise<WboostRenderedFile> {
    const url = `${this.config.apiBase}/api/template-variants/${variantId}/${mode}`;

    Sentry.addBreadcrumb({
      category: 'wboost',
      message: mode === 'preview' ? 'Previewing variant' : 'Exporting variant',
      level: 'info',
      data: { variantId },
    });

    // Only include `images` when there is something to send.
    const body =
      images && Object.keys(images).length > 0 ? { inputs, images } : { inputs };

    return this.postForFile(url, body);
  }

  /**
   * Render a template GROUP fill: `preview` one member dimension (WebP,
   * unrecorded), `export` one dimension (PNG) or — without `variantId` —
   * every dimension as one ZIP. Exports record ONE group version.
   */
  async renderGroup(
    groupId: string,
    variantId: string | null,
    fill: {
      inputs: Record<string, RenderInputValue>;
      images?: Record<string, RenderImageValue>;
      placements?: GroupPlacements;
    },
    mode: RenderMode
  ): Promise<WboostRenderedFile> {
    if (mode === 'preview' && !variantId) {
      throw new AppError('Náhled skupiny vyžaduje rozměr', ErrorCode.VALIDATION_FAILED, 400);
    }

    const path =
      mode === 'preview'
        ? `preview/${variantId}`
        : variantId
          ? `export/${variantId}`
          : 'export';
    const url = `${this.config.apiBase}/api/template-groups/${groupId}/${path}`;

    Sentry.addBreadcrumb({
      category: 'wboost',
      message: `Group ${mode}`,
      level: 'info',
      data: { groupId, variantId },
    });

    return this.postForFile(url, {
      inputs: fill.inputs,
      images: fill.images ?? {},
      placements: fill.placements ?? {},
    });
  }

  /** The shared export history of a fill surface (group or variant), pinned first. */
  async listExportVersions(
    subject: { groupId: string } | { variantId: string }
  ): Promise<WboostRawExportVersion[]> {
    const url =
      'groupId' in subject
        ? `${this.config.apiBase}/api/template-groups/${subject.groupId}/export-versions`
        : `${this.config.apiBase}/api/template-variants/${subject.variantId}/export-versions`;

    const res = await this.authedFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    return this.parseJson<WboostRawExportVersion[]>(res, 'export-versions');
  }

  /** One export version with its fill (seeded against the current design). */
  async getExportVersion(versionId: string): Promise<WboostRawExportVersionDetail> {
    const res = await this.authedFetch(`${this.config.apiBase}/api/export-versions/${versionId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    return this.parseJson<WboostRawExportVersionDetail>(res, 'export-version');
  }

  /** Rename (`name`, null clears) and/or pin (`pinned`) a version; absent keys stay untouched. */
  async updateExportVersion(
    versionId: string,
    patch: { name?: string | null; pinned?: boolean }
  ): Promise<WboostRawExportVersionDetail> {
    const res = await this.authedFetch(`${this.config.apiBase}/api/export-versions/${versionId}`, {
      method: 'PATCH',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });

    return this.parseJson<WboostRawExportVersionDetail>(res, 'export-version');
  }

  /** List the gallery images an image slot can be filled with (its allowed folders only). */
  async listPlaceholderImages(
    variantId: string,
    imageInputId: string
  ): Promise<WboostRawGalleryImage[]> {
    const url = `${this.config.apiBase}/api/template-variants/${variantId}/placeholders/${imageInputId}/images`;

    Sentry.addBreadcrumb({
      category: 'wboost',
      message: 'Listing placeholder images',
      level: 'info',
      data: { variantId, imageInputId },
    });

    const res = await this.authedFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    try {
      return (await res.json()) as WboostRawGalleryImage[];
    } catch {
      throw new AppError(
        'WBoost placeholder-images endpoint vrátil neplatný JSON',
        ErrorCode.INTERNAL_ERROR,
        502
      );
    }
  }

  /**
   * Upload a new image into one of the slot's allowed folders and return the
   * created gallery image. Sends multipart/form-data — the Content-Type (with
   * boundary) is set by fetch, so we must not set it ourselves.
   */
  async uploadPlaceholderImage(
    variantId: string,
    imageInputId: string,
    file: Blob,
    filename: string,
    directoryId?: string
  ): Promise<WboostRawGalleryImage> {
    const url = `${this.config.apiBase}/api/template-variants/${variantId}/placeholders/${imageInputId}/images`;

    Sentry.addBreadcrumb({
      category: 'wboost',
      message: 'Uploading placeholder image',
      level: 'info',
      data: { variantId, imageInputId, directoryId },
    });

    const form = new FormData();
    form.append('file', file, filename);
    if (directoryId) form.append('directoryId', directoryId);

    const res = await this.authedFetch(url, { method: 'POST', body: form });

    try {
      return (await res.json()) as WboostRawGalleryImage;
    } catch {
      throw new AppError(
        'WBoost upload endpoint vrátil neplatný JSON',
        ErrorCode.INTERNAL_ERROR,
        502
      );
    }
  }

  async fetchThumbnail(
    variantId: string
  ): Promise<{ body: Uint8Array; contentType: string }> {
    const url = `${this.config.apiBase}/api/template-variants/${variantId}/thumbnail`;

    Sentry.addBreadcrumb({
      category: 'wboost',
      message: 'Fetching thumbnail',
      level: 'info',
      data: { variantId },
    });

    const res = await this.authedFetch(url, { method: 'GET' });
    const contentType = res.headers.get('content-type') ?? 'image/png';
    const body = new Uint8Array(await res.arrayBuffer());
    return { body, contentType };
  }

  // ---------- Private helpers ----------------------------------------------

  private async postForFile(url: string, body: unknown): Promise<WboostRenderedFile> {
    const res = await this.authedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return {
      body: new Uint8Array(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? 'application/octet-stream',
      filename: filenameFromDisposition(res.headers.get('content-disposition')),
    };
  }

  private async parseJson<T>(res: Response, what: string): Promise<T> {
    try {
      return (await res.json()) as T;
    } catch {
      throw new AppError(`WBoost ${what} endpoint vrátil neplatný JSON`, ErrorCode.INTERNAL_ERROR, 502);
    }
  }

  /**
   * Make an authenticated fetch request. On a 401 response, invalidates the
   * cached token and retries the request once with a fresh token.
   */
  private async authedFetch(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    const token = await this.tokenManager.getToken();
    const res = await this.doFetch(url, this.withBearer(init, token));

    if (res.status === 401) {
      // Token may have been revoked – invalidate and retry once
      this.tokenManager.invalidate();
      const freshToken = await this.tokenManager.getToken();
      const retried = await this.doFetch(url, this.withBearer(init, freshToken));
      return this.assertOk(retried);
    }

    return this.assertOk(res);
  }

  private async doFetch(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (cause) {
      throw new NetworkError('Nepodařilo se připojit k WBoost API', { cause });
    }
  }

  private withBearer(init: RequestInit, token: string): RequestInit {
    return {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${token}`,
      },
    };
  }

  private async assertOk(res: Response): Promise<Response> {
    if (!res.ok) {
      // WBoost 400s can carry a STRUCTURED body (e.g. container_overflow with
      // the offending containerId + overflowPx) — read it so the UI can point
      // the user at the right fields instead of a generic message. Best
      // effort: a non-JSON body simply yields no details.
      let body: WboostErrorBody | undefined;
      try {
        body = (await res.json()) as WboostErrorBody;
      } catch {
        body = undefined;
      }
      const message = mapStatusToMessage(res.status, body);
      const code = mapStatusToErrorCode(res.status);
      throw new AppError(message, code, res.status, body);
    }
    return res;
  }
}

// --------------------------------------------------------------------------
// Singleton
// --------------------------------------------------------------------------

let instance: WboostClient | null = null;

/** Return the process-level singleton, built from `getWboostConfig()`. */
export function getWboostClient(): WboostClient {
  if (!instance) {
    const config = getWboostConfig();
    const tokenManager = getWboostTokenManager();
    instance = new WboostClient(config, tokenManager);
  }
  return instance;
}
