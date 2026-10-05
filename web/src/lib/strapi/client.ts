import { unstable_rethrow } from 'next/navigation';
import { UpstreamAuthError, UpstreamError, metrics } from '@fotbal-fm/cache';
import { strapiUrl } from '@fotbal-fm/strapi-client';
import { config } from '@/lib/config';
import type { StrapiCollectionResponse, StrapiSingleResponse, StrapiQueryOptions } from './types';

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * A Strapi request that produced no usable answer: an HTTP error status, the request timeout,
 * or a network/parse failure. The client throws it instead of returning empty data so the
 * cache layer can tell "Strapi said there is nothing" (cacheable) from "Strapi failed" (never
 * cached — data.ts renders its empty fallback for that one request). It is an UpstreamError:
 * the only kind of error the cache layer turns into that fallback.
 */
export class StrapiError extends UpstreamError {
  readonly status: number | 'timeout' | 'network';
  readonly contentType: string;

  constructor(contentType: string, status: number | 'timeout' | 'network', options?: { cause?: unknown }) {
    super(`Strapi ${contentType}: ${typeof status === 'number' ? `HTTP ${status}` : status}`, options);
    this.name = 'StrapiError';
    this.status = status;
    this.contentType = contentType;
  }
}

/**
 * Strapi rejected the API token (401) or the token may not read this content type (403). A
 * configuration error, not an outage, so it is never turned into empty data (lily D75, P0-V11):
 * on a cache miss the page fails, a new container's readiness latch stays closed and the rollout
 * reverts; where a stale copy exists it is served and the error is logged and counted.
 */
export class StrapiAuthError extends UpstreamAuthError {
  readonly status: 401 | 403;
  readonly contentType: string;

  constructor(contentType: string, status: 401 | 403) {
    super(`Strapi ${contentType}: HTTP ${status} — the API token was rejected`);
    this.name = 'StrapiAuthError';
    this.status = status;
    this.contentType = contentType;
  }
}

/** Metrics label for a Strapi path: the content type ("pages", "upload/files"), never ids or queries. */
function typeLabel(label: string): string {
  return label.split('/')[0];
}

class StrapiClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = config.strapi.url;
    this.token = config.strapi.apiToken;
  }

  private get headers(): HeadersInit {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (this.token) {
      h['Authorization'] = `Bearer ${this.token}`;
    }
    return h;
  }

  /**
   * GET a Strapi REST URL and return the parsed body. `notFoundAsNull`: a 404 is an answer
   * ("no such document" / an empty single type), not a failure.
   */
  private async request<B>(label: string, path: string, notFoundAsNull = false): Promise<B | null> {
    const started = performance.now();
    const report = (status: number | string) =>
      metrics.strapiRequest(typeLabel(label), String(status), (performance.now() - started) / 1000);
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        headers: this.headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // Next.js signals through errors thrown from fetch (e.g. "dynamic server usage" for a
      // no-store fetch during a build-time prerender). They are not Strapi failures: rethrow them
      // untouched so Next can act on them (and the cache never remembers them).
      unstable_rethrow(error);
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      report(timedOut ? 'timeout' : 'network');
      throw new StrapiError(label, timedOut ? 'timeout' : 'network', { cause: error });
    }

    report(res.status);
    if (res.status === 401 || res.status === 403) throw new StrapiAuthError(label, res.status);
    if (res.status === 404 && notFoundAsNull) return null;
    if (!res.ok) throw new StrapiError(label, res.status);

    try {
      return (await res.json()) as B;
    } catch (error) {
      unstable_rethrow(error);
      throw new StrapiError(label, 'network', { cause: error });
    }
  }

  async findMany<T>(
    contentType: string,
    options: StrapiQueryOptions = {},
  ): Promise<{ data: T[]; total: number }> {
    const json = await this.request<StrapiCollectionResponse<T>>(contentType, strapiUrl(contentType, options));
    return {
      data: json?.data ?? [],
      total: json?.meta?.pagination?.total ?? json?.data?.length ?? 0,
    };
  }

  /** Every page of a collection. Throws if any page fails — a partial list is never returned. */
  // (The data cache keys a findAll by strapiUrl(contentType, options) — the options without pagination.)
  async findAll<T>(
    contentType: string,
    options: Omit<StrapiQueryOptions, 'pagination'> = {},
  ): Promise<T[]> {
    const pageSize = 100;
    const firstPage = await this.findMany<T>(contentType, {
      ...options,
      pagination: { page: 1, pageSize },
    });

    const results = [...firstPage.data];
    const totalPages = Math.ceil(firstPage.total / pageSize);

    for (let page = 2; page <= totalPages; page++) {
      const nextPage = await this.findMany<T>(contentType, {
        ...options,
        pagination: { page, pageSize },
      });
      results.push(...nextPage.data);
    }

    return results;
  }

  /** A single type; `null` when it has no entry yet (Strapi answers 404). */
  async findSingle<T>(
    contentType: string,
    options: StrapiQueryOptions = {},
  ): Promise<T | null> {
    const json = await this.request<StrapiSingleResponse<T>>(contentType, strapiUrl(contentType, options), true);
    return json?.data ?? null;
  }

  /** One document by documentId; `null` when it does not exist (404). */
  async findOne<T>(
    contentType: string,
    documentId: string,
    options: StrapiQueryOptions = {},
  ): Promise<T | null> {
    const json = await this.request<{ data?: T | null }>(
      `${contentType}/${documentId}`,
      strapiUrl(`${contentType}/${documentId}`, options),
      true,
    );
    return json?.data ?? null;
  }
}

let client: StrapiClient | null = null;

export function getStrapiClient(): StrapiClient {
  if (!client) {
    client = new StrapiClient();
  }
  return client;
}
