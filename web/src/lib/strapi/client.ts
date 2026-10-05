import { config } from '@/lib/config';
import { buildStrapiQueryString } from './queries';
import type { StrapiCollectionResponse, StrapiSingleResponse, StrapiQueryOptions } from './types';

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * A Strapi request that produced no usable answer: an HTTP error status, the request timeout,
 * or a network/parse failure. The client throws it instead of returning empty data so the
 * cache layer can tell "Strapi said there is nothing" (cacheable) from "Strapi failed" (never
 * cached — data.ts renders its empty fallback for that one request).
 */
export class StrapiError extends Error {
  readonly status: number | 'timeout' | 'network';
  readonly contentType: string;

  constructor(contentType: string, status: number | 'timeout' | 'network', options?: { cause?: unknown }) {
    super(`Strapi ${contentType}: ${typeof status === 'number' ? `HTTP ${status}` : status}`, options);
    this.name = 'StrapiError';
    this.status = status;
    this.contentType = contentType;
  }
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
  private async request<B>(label: string, url: string, notFoundAsNull = false): Promise<B | null> {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: this.headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      throw new StrapiError(label, timedOut ? 'timeout' : 'network', { cause: error });
    }

    if (res.status === 404 && notFoundAsNull) return null;
    if (!res.ok) throw new StrapiError(label, res.status);

    try {
      return (await res.json()) as B;
    } catch (error) {
      throw new StrapiError(label, 'network', { cause: error });
    }
  }

  async findMany<T>(
    contentType: string,
    options: StrapiQueryOptions = {},
  ): Promise<{ data: T[]; total: number }> {
    const qs = buildStrapiQueryString(options);
    const json = await this.request<StrapiCollectionResponse<T>>(contentType, `${this.baseUrl}/api/${contentType}${qs}`);
    return {
      data: json?.data ?? [],
      total: json?.meta?.pagination?.total ?? json?.data?.length ?? 0,
    };
  }

  /** Every page of a collection. Throws if any page fails — a partial list is never returned. */
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
    const qs = buildStrapiQueryString(options);
    const json = await this.request<StrapiSingleResponse<T>>(contentType, `${this.baseUrl}/api/${contentType}${qs}`, true);
    return json?.data ?? null;
  }

  /** One document by documentId; `null` when it does not exist (404). */
  async findOne<T>(
    contentType: string,
    documentId: string,
    options: StrapiQueryOptions = {},
  ): Promise<T | null> {
    const qs = buildStrapiQueryString(options);
    const json = await this.request<{ data?: T | null }>(
      `${contentType}/${documentId}`,
      `${this.baseUrl}/api/${contentType}/${documentId}${qs}`,
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
