import type { StrapiCollectionResponse, StrapiQueryOptions } from '@fotbal-fm/strapi-client';
import { buildStrapiQueryString } from '@fotbal-fm/strapi-client';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '';

export async function strapiGet<T>(
  path: string,
  options?: StrapiQueryOptions,
): Promise<StrapiCollectionResponse<T>> {
  const qs = options ? buildStrapiQueryString(options) : '';
  const url = `${STRAPI_URL}/api${path}${qs}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (STRAPI_API_TOKEN) {
    headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`Strapi request failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<StrapiCollectionResponse<T>>;
}

export async function strapiPost<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const url = `${STRAPI_URL}/api${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (STRAPI_API_TOKEN) {
    headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(JSON.stringify(error));
  }

  return res.json() as Promise<T>;
}
