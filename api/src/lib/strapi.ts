import type { StrapiCollectionResponse, StrapiPagination, StrapiQueryOptions, StrapiSingleResponse } from '@fotbal-fm/strapi-client';
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

export async function strapiGetWithPagination<T>(
  path: string,
  options?: StrapiQueryOptions,
): Promise<{ data: T[]; pagination: StrapiPagination }> {
  const result = await strapiGet<T>(path, options);
  const pagination = result.meta?.pagination ?? {
    page: 1,
    pageSize: 25,
    pageCount: 1,
    total: result.data.length,
  };
  return { data: result.data, pagination };
}

export async function strapiGetSingleEntry<T>(
  path: string,
  options?: StrapiQueryOptions,
): Promise<T | null> {
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
    if (res.status === 404) return null;
    throw new Error(`Strapi request failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as StrapiSingleResponse<T>;
  return json.data;
}

export async function strapiGetSingle<T>(
  path: string,
  authToken?: string,
): Promise<T> {
  const url = `${STRAPI_URL}/api${path}`;
  const token = authToken ?? STRAPI_API_TOKEN;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(JSON.stringify(error));
  }

  return res.json() as Promise<T>;
}

export async function strapiPost<T>(
  path: string,
  body: unknown,
  authToken?: string,
): Promise<T> {
  const url = `${STRAPI_URL}/api${path}`;
  const token = authToken ?? STRAPI_API_TOKEN;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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

export async function strapiPut<T>(
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
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(JSON.stringify(error));
  }

  return res.json() as Promise<T>;
}

export async function strapiDelete<T>(
  path: string,
  authToken?: string,
): Promise<T> {
  const url = `${STRAPI_URL}/api${path}`;
  const token = authToken ?? STRAPI_API_TOKEN;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(JSON.stringify(error));
  }

  return res.json() as Promise<T>;
}
