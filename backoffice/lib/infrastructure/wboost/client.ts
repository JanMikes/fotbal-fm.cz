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
import type { WboostRawTemplate } from './types';
import type { RenderInputValue } from '@/lib/social-export/api-types';

// --------------------------------------------------------------------------
// Error message map (Czech)
// --------------------------------------------------------------------------

function mapStatusToMessage(status: number): string {
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

export class WboostClient {
  constructor(
    private readonly config: WboostConfig,
    private readonly tokenManager: WboostTokenManager
  ) {}

  // ---------- Public methods -----------------------------------------------

  async listTemplates(): Promise<WboostRawTemplate[]> {
    const url = `${this.config.apiBase}/api/projects/${this.config.projectId}/social-network-templates`;

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

  async renderVariant(
    variantId: string,
    inputs: Record<string, RenderInputValue>
  ): Promise<Uint8Array> {
    const url = `${this.config.apiBase}/api/social-network-template-variants/${variantId}/export`;

    Sentry.addBreadcrumb({
      category: 'wboost',
      message: 'Rendering variant',
      level: 'info',
      data: { variantId },
    });

    const res = await this.authedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs }),
    });

    return new Uint8Array(await res.arrayBuffer());
  }

  async fetchThumbnail(
    variantId: string
  ): Promise<{ body: Uint8Array; contentType: string }> {
    const url = `${this.config.apiBase}/api/social-network-template-variants/${variantId}/thumbnail`;

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

  private assertOk(res: Response): Response {
    if (!res.ok) {
      const message = mapStatusToMessage(res.status);
      const code = mapStatusToErrorCode(res.status);
      const err = new AppError(message, code, res.status);
      throw err;
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
