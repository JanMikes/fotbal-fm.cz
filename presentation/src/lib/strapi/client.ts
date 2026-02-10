import { config } from '@/lib/config';
import { buildStrapiQueryString } from './queries';
import type { StrapiCollectionResponse, StrapiQueryOptions } from './types';

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

  async findMany<T>(
    contentType: string,
    options: StrapiQueryOptions = {},
  ): Promise<{ data: T[]; total: number }> {
    const qs = buildStrapiQueryString(options);
    const url = `${this.baseUrl}/api/${contentType}${qs}`;

    try {
      const res = await fetch(url, {
        headers: this.headers,
        next: { revalidate: 60 },
      });

      if (!res.ok) {
        console.error(`Strapi findMany ${contentType} failed: ${res.status}`);
        return { data: [], total: 0 };
      }

      const json: StrapiCollectionResponse<T> = await res.json();
      return {
        data: json.data ?? [],
        total: json.meta?.pagination?.total ?? json.data?.length ?? 0,
      };
    } catch (error) {
      console.error(`Strapi findMany ${contentType} error:`, error);
      return { data: [], total: 0 };
    }
  }

  async findOne<T>(
    contentType: string,
    documentId: string,
    options: StrapiQueryOptions = {},
  ): Promise<T | null> {
    const qs = buildStrapiQueryString(options);
    const url = `${this.baseUrl}/api/${contentType}/${documentId}${qs}`;

    try {
      const res = await fetch(url, {
        headers: this.headers,
        next: { revalidate: 60 },
      });

      if (!res.ok) {
        console.error(`Strapi findOne ${contentType}/${documentId} failed: ${res.status}`);
        return null;
      }

      const json = await res.json();
      return json.data ?? null;
    } catch (error) {
      console.error(`Strapi findOne ${contentType}/${documentId} error:`, error);
      return null;
    }
  }
}

let client: StrapiClient | null = null;

export function getStrapiClient(): StrapiClient {
  if (!client) {
    client = new StrapiClient();
  }
  return client;
}
