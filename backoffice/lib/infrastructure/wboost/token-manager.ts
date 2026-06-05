/**
 * WBoost OAuth2 token manager with in-memory caching.
 *
 * Uses the client_credentials grant to obtain bearer tokens. The access token
 * is a JWT valid for ~1 hour; we cache it and reuse it across requests rather
 * than fetching one per call. Expiry is taken from the JWT's own `exp` claim
 * (falling back to `expires_in` if the token can't be parsed), and we refresh a
 * short skew BEFORE the real expiry so an in-flight call never carries an
 * expired token. Concurrent callers during a refresh share a single fetch.
 *
 * Calling `invalidate()` drops the cache so the next `getToken()` fetches a
 * fresh token (call it when a downstream 401 is received).
 */

import { AppError, ErrorCode, NetworkError } from '@/lib/core/errors';
import { getWboostConfig, WboostConfig } from '@/lib/config';
import type { WboostTokenResponse } from './types';

/** Refresh this many ms before the token actually expires ("coming soon"). */
const REFRESH_SKEW_MS = 60_000;

interface TokenCache {
  token: string;
  /** Absolute timestamp (ms) after which the token should be refreshed. */
  expiresAt: number;
}

/**
 * Read the `exp` claim (seconds since epoch) from a JWT and return it in ms,
 * or null when the token is not a parseable JWT with a numeric `exp`.
 */
function jwtExpiryMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      exp?: unknown;
    };
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      return payload.exp * 1000;
    }
  } catch {
    // Not a JWT we can parse — caller falls back to expires_in.
  }
  return null;
}

/** Collapse whitespace and cap length so a raw response body is safe to show in the UI. */
function bodySnippet(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  return collapsed ? collapsed.slice(0, 300) : '(prázdná odpověď)';
}

/** Log the full context of a bad token response to stdout (Docker logs). */
function logTokenBody(reason: string, url: string, status: number, contentType: string, raw: string): void {
  console.error(
    `[WBoost] Token endpoint ${reason}:\n` +
      `  url: ${url}\n` +
      `  status: ${status}\n` +
      `  content-type: ${contentType || '(none)'}\n` +
      `  body: ${raw.slice(0, 2000) || '(empty)'}`
  );
}

export class WboostTokenManager {
  private cache: TokenCache | null = null;
  /** Shared promise while a fetch is in flight, to avoid a thundering herd. */
  private inflight: Promise<string> | null = null;

  constructor(
    private readonly config: Pick<WboostConfig, 'apiBase' | 'clientId' | 'clientSecret'>
  ) {}

  /**
   * Return a valid bearer token, fetching a new one only when the cached token
   * is absent or within REFRESH_SKEW_MS of its expiry. Concurrent callers during
   * a refresh await the same in-flight request.
   */
  async getToken(): Promise<string> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.token;
    }

    if (!this.inflight) {
      const pending = this.fetchToken();
      this.inflight = pending;
      // Free the slot once settled (success or failure) so a later refresh can
      // fetch again. Detached from the returned promise so callers still see
      // any rejection.
      const clear = () => {
        if (this.inflight === pending) {
          this.inflight = null;
        }
      };
      pending.then(clear, clear);
    }

    return this.inflight;
  }

  /** Clears the cached token so the next `getToken()` fetches a fresh one. */
  invalidate(): void {
    this.cache = null;
    this.inflight = null;
  }

  private async fetchToken(): Promise<string> {
    const url = `${this.config.apiBase}/api/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (cause) {
      throw new NetworkError('Nepodařilo se připojit k WBoost API (token)', { cause });
    }

    if (!res.ok) {
      if (res.status === 401) {
        // OAuth2 error: invalid_client
        throw new AppError(
          'WBoost: neplatné přihlašovací údaje (invalid_client)',
          ErrorCode.UNAUTHORIZED,
          401
        );
      }
      const text = await res.text().catch(() => '');
      throw new AppError(
        `WBoost token endpoint vrátil chybu ${res.status}: ${text}`,
        ErrorCode.INTERNAL_ERROR,
        res.status
      );
    }

    // Read the body as text FIRST: parsing consumes the stream, so reading text
    // afterwards is impossible — capture it now so a bad body can be shown.
    const contentType = res.headers.get('content-type') ?? '';
    const rawBody = await res.text();

    let data: WboostTokenResponse;
    try {
      data = JSON.parse(rawBody) as WboostTokenResponse;
    } catch {
      logTokenBody('vrátil neplatný JSON', url, res.status, contentType, rawBody);
      throw new AppError(
        `WBoost token endpoint vrátil neplatný JSON (HTTP ${res.status}, content-type: ${
          contentType || 'neznámý'
        }). Odpověď: ${bodySnippet(rawBody)}`,
        ErrorCode.INTERNAL_ERROR,
        502
      );
    }

    // Valid JSON but not a token (e.g. an OAuth error object returned with 200).
    if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
      logTokenBody('neobsahuje access_token', url, res.status, contentType, rawBody);
      throw new AppError(
        `WBoost token endpoint nevrátil access_token (HTTP ${res.status}). Odpověď: ${bodySnippet(rawBody)}`,
        ErrorCode.INTERNAL_ERROR,
        502
      );
    }

    // Prefer the JWT's own `exp`; fall back to expires_in. Refresh a skew before
    // the real expiry so we never present an about-to-expire token.
    const absoluteExpiryMs =
      jwtExpiryMs(data.access_token) ?? Date.now() + data.expires_in * 1000;
    this.cache = {
      token: data.access_token,
      expiresAt: absoluteExpiryMs - REFRESH_SKEW_MS,
    };

    return data.access_token;
  }
}

// Singleton instance (lazily created from config)
let instance: WboostTokenManager | null = null;

/** Return the process-level singleton, built from `getWboostConfig()`. */
export function getWboostTokenManager(): WboostTokenManager {
  if (!instance) {
    const cfg = getWboostConfig();
    instance = new WboostTokenManager({
      apiBase: cfg.apiBase,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
    });
  }
  return instance;
}
