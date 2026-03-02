const BASE_URL = 'https://app.sportbm.com';

export interface SportbmGroup {
  id: number;
  name: string;
  participants_count: number;
  photo: string | null;
}

export interface SportbmParticipant {
  id: number;
  user: {
    first_name: string;
    last_name: string;
  };
  user_role: {
    id: number;
    photo: string | null;
  };
}

export interface SportbmPlayer {
  id: number;
  user: {
    first_name: string;
    last_name: string;
    birth_date: string | null;
  };
  user_role: {
    id: number;
    photo: string | null;
  };
  number: number | null;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * Login to SportBM and return session cookies as a string.
 */
export async function sportbmLogin(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/v2/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    redirect: 'manual',
  });

  if (!res.ok && res.status !== 302) {
    throw new Error(`SportBM login failed: ${res.status} ${res.statusText}`);
  }

  // Extract cookies from Set-Cookie headers
  const setCookieHeaders = res.headers.getSetCookie();
  const cookies = setCookieHeaders
    .map((header) => header.split(';')[0])
    .join('; ');

  if (!cookies) {
    throw new Error('SportBM login did not return session cookies');
  }

  return cookies;
}

/**
 * Make an authenticated GET request to SportBM API.
 */
async function sportbmFetch<T>(path: string, cookies: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { Cookie: cookies },
  });

  if (!res.ok) {
    throw new Error(`SportBM request failed: ${res.status} ${res.statusText} - ${url}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Fetch all groups (categories) from SportBM.
 */
export async function fetchGroups(cookies: string): Promise<SportbmGroup[]> {
  const data = await sportbmFetch<PaginatedResponse<SportbmGroup>>(
    '/api/leader/projects/3740/groups/?page_size=100&page=1&sort_by=rank',
    cookies,
  );
  return data.results;
}

/**
 * Fetch all participants in a group.
 */
export async function fetchGroupParticipants(groupId: number, cookies: string): Promise<SportbmParticipant[]> {
  const all: SportbmParticipant[] = [];
  let url: string | null = `/api/leader/groups/${groupId}/participants/?page_size=100&page=1`;

  while (url) {
    const data = await sportbmFetch<PaginatedResponse<SportbmParticipant>>(url, cookies);
    all.push(...data.results);
    url = data.next;
  }

  return all;
}

/**
 * Fetch full player profile.
 */
export async function fetchPlayerProfile(playerId: number, cookies: string): Promise<SportbmPlayer> {
  return sportbmFetch<SportbmPlayer>(
    `/api/leader/players/${playerId}/`,
    cookies,
  );
}
