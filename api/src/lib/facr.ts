/**
 * FAČR IS client for scraping competition and player data.
 *
 * Shared auth flow:
 * 1. POST login to get JWT access_token
 * 2. GET /public/?sport=fotbal with access_token cookie to establish IS1 session
 *
 * Competition flow (steps 3-5):
 * 3. GET competitions page to get ASP.NET ViewState
 * 4. POST search with club number to get competition table
 * 5. Parse HTML table
 *
 * Player flow (steps 3-6):
 * 3. GET player list page to get ViewState
 * 4. POST search with club number to get player table
 * 5. Parse HTML rows, paginate, extract UUIDs
 * 6. GET each player detail page for full data
 */

const FACR_BASE = 'https://is.fotbal.cz';

export interface FacrClub {
  /** Public club number (číslo klubu) */
  number: string;
  /** FAČR internal id, from services/public-client.aspx?type=oddil&typ=1&query=<number> */
  internalId: string;
  name: string;
}

/**
 * Club subjects to scrape. Muži B (and potentially more teams over time)
 * play under the separate FK Frýdek-Místek 1921 a.s. subject; the z.s.
 * subject covers the remaining categories.
 */
export const FACR_CLUBS: FacrClub[] = [
  { number: '8020091', internalId: '2521', name: 'FK Frýdek-Místek z.s.' },
  { number: '8020601', internalId: '30870', name: 'FK Frýdek-Místek 1921 a.s.' },
];

export const DEFAULT_CLUB = FACR_CLUBS[0];

export interface FacrCompetition {
  facrId: string;
  facrUuid: string;
  name: string;
  code: string;
  categoryLetter: string;
  level: number;
  group: string;
  type: string;
  organizingBody: string;
  season: number;
}

export interface FacrStandingRow {
  position: number;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface FacrStanding {
  competitionCode: string;
  season: number;
  facrUuid: string;
  rows: FacrStandingRow[];
}

export interface FacrPlayer {
  facrId: string;
  name: string;
  dateOfBirth: string;
  nationality: string;
  facrUuid: string;
  isActive: boolean;
  photoUrl: string | null;
}

/**
 * Simple cookie jar for managing cookies across requests.
 */
export class CookieJar {
  private cookies: Map<string, string> = new Map();

  addFromResponse(response: Response): void {
    const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
    for (const header of setCookieHeaders) {
      const [nameValue] = header.split(';');
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx > 0) {
        const name = nameValue.substring(0, eqIdx).trim();
        const value = nameValue.substring(eqIdx + 1).trim();
        this.cookies.set(name, value);
      }
    }
  }

  toString(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

/**
 * Extract a hidden form field value from HTML.
 */
export function extractFormField(html: string, fieldName: string): string {
  const escapedName = fieldName.replace(/\$/g, '\\$');
  const regex = new RegExp(
    `name="${escapedName}"[^>]*value="([^"]*)"` +
    `|value="([^"]*)"[^>]*name="${escapedName}"`,
  );
  const match = html.match(regex);
  return match ? (match[1] ?? match[2] ?? '') : '';
}

export interface RocnikOption {
  value: string;
  text: string;
  selected: boolean;
}

/**
 * Parse the "Ročník" (season) dropdown options from a FAČR search page.
 * The option value is an internal FAČR id (e.g. 19), the text is the
 * season start year (e.g. "2026" for season 2026/2027).
 */
export function parseRocnikOptions(html: string): RocnikOption[] {
  const selectMatch = html.match(
    /<select[^>]*name="ctl00\$MainContent\$listSearchRocnik"[^>]*>([\s\S]*?)<\/select>/i,
  );
  if (!selectMatch) return [];

  const options: RocnikOption[] = [];
  const optionRegex = /<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/gi;
  let m;
  while ((m = optionRegex.exec(selectMatch[1])) !== null) {
    options.push({
      value: m[1],
      text: m[2].trim(),
      selected: /selected/i.test(m[0]),
    });
  }
  return options;
}

/**
 * Resolve the FAČR internal ročník dropdown value for a season start year.
 * Without seasonYear, returns the dropdown's pre-selected option — FAČR
 * selects the current season by default. The value→year mapping is irregular
 * (19→2026, 18→2025, 16→2024, …) so it must be read from the page.
 */
export function resolveRocnikValue(html: string, seasonYear?: number): string {
  const options = parseRocnikOptions(html);
  if (options.length === 0) {
    throw new Error('Failed to parse FAČR ročník (season) dropdown');
  }

  if (seasonYear !== undefined) {
    const match = options.find((o) => o.text === String(seasonYear));
    if (!match) {
      throw new Error(
        `Season ${seasonYear} not found in FAČR ročník dropdown (available: ${options.map((o) => o.text).join(', ')})`,
      );
    }
    return match.value;
  }

  const selected = options.find((o) => o.selected) ?? options[0];
  return selected.value;
}

interface FacrSession {
  accessToken: string;
  jar: CookieJar;
}

/**
 * Login to FAČR IS and establish IS1 session.
 * Shared by all scrapers.
 */
export async function facrLogin(email: string, password: string): Promise<FacrSession> {
  const jar = new CookieJar();

  // Step 1: Login to get JWT
  console.log('[FAČR] Step 1: Logging in...');
  const loginRes = await fetch(`${FACR_BASE}/api/auth/login?discipline=football`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  });

  if (!loginRes.ok) {
    throw new Error(`FAČR login failed: ${loginRes.status}`);
  }

  jar.addFromResponse(loginRes);
  const loginData = await loginRes.json() as { access_token: string };
  const accessToken = loginData.access_token;

  // Step 2: Establish IS1 session
  console.log('[FAČR] Step 2: Establishing IS1 session...');
  const sessionRes = await fetch(`${FACR_BASE}/public/?sport=fotbal`, {
    headers: { Cookie: `access_token=${accessToken}` },
    redirect: 'manual',
  });
  jar.addFromResponse(sessionRes);

  // Follow redirect if needed
  const redirectUrl = sessionRes.headers.get('location');
  if (redirectUrl) {
    const fullUrl = redirectUrl.startsWith('http') ? redirectUrl : `${FACR_BASE}${redirectUrl}`;
    const redirectRes = await fetch(fullUrl, {
      headers: { Cookie: `access_token=${accessToken}; ${jar.toString()}` },
      redirect: 'manual',
    });
    jar.addFromResponse(redirectRes);
  }

  return { accessToken, jar };
}

// ---- Competitions ----

/**
 * Parse the competitions HTML table into structured data.
 */
function parseCompetitionsTable(html: string): FacrCompetition[] {
  const competitions: FacrCompetition[] = [];

  const tableMatch = html.match(/<table[^>]*id="[^"]*gridData[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    return competitions;
  }

  const tableHtml = tableMatch[1];

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows: string[] = [];
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    rows.push(rowMatch[1]);
  }

  for (let i = 1; i < rows.length; i++) {
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rows[i])) !== null) {
      const text = cellMatch[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&ndash;/g, '–')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(text);
    }

    if (cells.length >= 9) {
      // Extract UUID from detail link in the name column
      const linkMatch = rows[i].match(/detail-souteze\.aspx\?req=([a-f0-9-]+)/i);
      const facrUuid = linkMatch ? linkMatch[1] : '';

      competitions.push({
        facrId: cells[0],
        facrUuid,
        name: cells[1],
        code: cells[2],
        categoryLetter: cells[3],
        level: parseInt(cells[4], 10) || 0,
        group: cells[5],
        type: cells[6],
        organizingBody: cells[7],
        season: parseInt(cells[8], 10) || 0,
      });
    }
  }

  return competitions;
}

/**
 * Login to FAČR IS and scrape competitions for one club subject.
 * Without seasonYear, scrapes the current season (FAČR's default selection).
 */
export async function scrapeCompetitions(
  email: string,
  password: string,
  seasonYear?: number,
  club: FacrClub = DEFAULT_CLUB,
): Promise<FacrCompetition[]> {
  const { accessToken, jar } = await facrLogin(email, password);

  // Step 3: GET competitions page to get ViewState
  console.log('[FAČR] Step 3: Fetching competitions page...');
  const pageRes = await fetch(
    `${FACR_BASE}/public/souteze/prehled-soutezi.aspx?sport=fotbal`,
    {
      headers: { Cookie: `access_token=${accessToken}; ${jar.toString()}` },
      redirect: 'follow',
    },
  );
  jar.addFromResponse(pageRes);
  const pageHtml = await pageRes.text();

  const viewState = extractFormField(pageHtml, '__VIEWSTATE');
  const viewStateGenerator = extractFormField(pageHtml, '__VIEWSTATEGENERATOR');
  const eventValidation = extractFormField(pageHtml, '__EVENTVALIDATION');

  if (!viewState) {
    throw new Error('Failed to extract __VIEWSTATE from competitions page');
  }

  const rocnik = resolveRocnikValue(pageHtml, seasonYear);

  // Step 4: POST search with club number
  console.log(`[FAČR] Step 4: Searching competitions for ${club.name} (ročník ${rocnik}${seasonYear ? ` = ${seasonYear}` : ' = current'})...`);
  const formData = new URLSearchParams({
    __EVENTTARGET: 'ctl00$MainContent$btnSearch',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGenerator,
    __EVENTVALIDATION: eventValidation,
    'ctl00$TopMenu$listChangeSport': '1',
    'ctl00$MainContent$listSearchDruhSouteze': '0',
    'ctl00$MainContent$bxOrgJednotka$txtNazevOrgJednotky': '',
    'ctl00$MainContent$bxOrgJednotka$hidIdOrgJednotky': '',
    'ctl00$MainContent$bxOrgJednotka$txtOrgJednotkyParam': '',
    'ctl00$MainContent$OddilBoxClenem$txtCisloKlubu': club.number,
    'ctl00$MainContent$OddilBoxClenem$txtNazevKlubu': club.name,
    'ctl00$MainContent$OddilBoxClenem$hidIdKlubu': club.internalId,
    'ctl00$MainContent$OddilBoxClenem$hidTypSportu': club.internalId,
    'ctl00$MainContent$txtSearchNazev': '',
    'ctl00$MainContent$listSearchRocnik': rocnik,
    'ctl00$MainContent$txtSearchKod': '',
    'ctl00$MainContent$txtSearchCislo': '',
  });

  const searchRes = await fetch(
    `${FACR_BASE}/public/souteze/prehled-soutezi.aspx?sport=fotbal`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: `access_token=${accessToken}; ${jar.toString()}`,
      },
      body: formData.toString(),
      redirect: 'follow',
    },
  );

  const resultHtml = await searchRes.text();

  // Step 5: Parse the HTML table
  console.log('[FAČR] Step 5: Parsing competitions table...');
  const competitions = parseCompetitionsTable(resultHtml);
  console.log(`[FAČR] Found ${competitions.length} competitions`);

  return competitions;
}

// ---- Standings ----

/**
 * Parse the "Tabulka celková" HTML table from a competition standings page.
 */
function parseStandingsTable(html: string): FacrStandingRow[] {
  const rows: FacrStandingRow[] = [];

  // Find the "Tabulka celková" heading, then the first table after it
  const celkovaIdx = html.indexOf('Tabulka celkov');
  if (celkovaIdx === -1) return rows;

  // Find the first <table class='vysledky-tabulky'> after the heading (note: single quotes in HTML)
  const afterHeading = html.substring(celkovaIdx);
  const tableMatch = afterHeading.match(/<table[^>]*class=['"]vysledky-tabulky['"][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return rows;

  const tableHtml = tableMatch[1];

  // The HTML has malformed <tr> tags (unclosed rows), so instead of matching
  // <tr>...</tr>, we find all <td> groups between <tr markers.
  // Split by <tr to get segments, then extract <td> cells from each.
  const segments = tableHtml.split(/<tr[^>]*>/i);

  for (const segment of segments) {
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(segment)) !== null) {
      cells.push(stripHtml(cellMatch[1]));
    }

    // 8 columns: Rk., Družstvo, Záp., +, 0, -, Skóre, Body
    if (cells.length >= 8) {
      // Parse score "45:17" into goalsFor and goalsAgainst
      const scoreParts = cells[6].split(':');
      const goalsFor = parseInt(scoreParts[0], 10) || 0;
      const goalsAgainst = parseInt(scoreParts[1], 10) || 0;

      rows.push({
        position: parseInt(cells[0], 10) || rows.length + 1,
        teamName: cells[1].trim(),
        matchesPlayed: parseInt(cells[2], 10) || 0,
        wins: parseInt(cells[3], 10) || 0,
        draws: parseInt(cells[4], 10) || 0,
        losses: parseInt(cells[5], 10) || 0,
        goalsFor,
        goalsAgainst,
        points: parseInt(cells[7], 10) || 0,
      });
    }
  }

  return rows;
}

/**
 * Login to FAČR IS and scrape standings for all competitions of FK Frýdek-Místek.
 * Fetches the competition list, then for each competition fetches the standings page.
 */
export async function scrapeStandings(
  email: string,
  password: string,
  seasonYear?: number,
  club: FacrClub = DEFAULT_CLUB,
): Promise<FacrStanding[]> {
  // 1. Scrape competitions to get UUIDs
  const competitions = await scrapeCompetitions(email, password, seasonYear, club);
  console.log(`[FAČR] Scraping standings for ${competitions.length} competitions...`);

  // Re-login to get fresh session (scrapeCompetitions creates its own)
  const { accessToken, jar } = await facrLogin(email, password);

  const standings: FacrStanding[] = [];

  for (let i = 0; i < competitions.length; i++) {
    const comp = competitions[i];
    if (!comp.facrUuid) {
      console.warn(`[FAČR]   Skipping ${comp.name} (${comp.code}) - no UUID`);
      continue;
    }

    console.log(`[FAČR]   [${i + 1}/${competitions.length}] ${comp.name} (${comp.code})`);

    try {
      const url = `${FACR_BASE}/public/souteze/tabulky-souteze.aspx?req=${comp.facrUuid}`;
      const res = await fetch(url, {
        headers: { Cookie: `access_token=${accessToken}; ${jar.toString()}` },
        redirect: 'follow',
      });
      const html = await res.text();

      const rows = parseStandingsTable(html);
      if (rows.length > 0) {
        standings.push({
          competitionCode: comp.code,
          season: comp.season,
          facrUuid: comp.facrUuid,
          rows,
        });
        console.log(`[FAČR]     Found ${rows.length} teams in standings`);
      } else {
        console.log(`[FAČR]     No standings table found`);
      }
    } catch (err) {
      console.warn(`[FAČR]     Failed to scrape standings: ${err}`);
    }

    // Small delay to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(`[FAČR] Scraped standings for ${standings.length} competitions`);
  return standings;
}

/**
 * Format a Date as DD.MM.YYYY (Czech date format used by FAČR forms).
 */
function formatCzechDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Get the season start date (1st July) as a Czech-formatted string.
 * Season 2025/2026 starts on 01.07.2025. Without seasonYear, uses the
 * current season (July–June window around today).
 */
export function getSeasonStartDate(seasonYear?: number): string {
  let year = seasonYear;
  if (year === undefined) {
    const now = new Date();
    year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  }
  return formatCzechDate(new Date(year, 6, 1)); // July 1
}

// ---- Matches (Excel export) ----

export interface FacrMatch {
  facrId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  matchDate: string;
  matchTime: string;
  round: number | null;
  venue: string;
  competitionName: string;
  competitionCode: string;
  season: number | null;
  period: string;
  organizingBody: string;
}

export interface XlsxRow {
  'Číslo zápasu'?: string;
  'Domácí'?: string;
  'Hosté'?: string;
  'Výsledek'?: string;
  'Datum a čas'?: string;
  Kolo?: number | string;
  'Pořadí v kole'?: number | string;
  'Hřiště'?: string;
  'Soutěž'?: string;
  'Číslo soutěže'?: string;
  'Org. jednotka'?: string;
}

/**
 * Parse score string like "3 : 1" into [home, away].
 * Returns [null, null] for "-", empty, or unparseable values.
 */
function parseScore(scoreStr: string | undefined): [number | null, number | null] {
  if (!scoreStr || scoreStr.trim() === '-' || scoreStr.trim() === '') {
    return [null, null];
  }
  const match = scoreStr.match(/(\d+)\s*:\s*(\d+)/);
  if (!match) return [null, null];
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

/**
 * Parse date+time string like "01.03.2026 12:30" into { matchDate, matchTime }.
 */
function parseMatchDateTime(dateTimeStr: string | undefined): { matchDate: string; matchTime: string } {
  if (!dateTimeStr) return { matchDate: '', matchTime: '' };
  const match = dateTimeStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*(\d{1,2}:\d{2})?/);
  if (!match) return { matchDate: '', matchTime: '' };
  const [, day, month, year, time] = match;
  return {
    matchDate: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
    matchTime: time ?? '',
  };
}

/**
 * Parse XLSX rows into FacrMatch objects.
 * Shared by scrape-facr.ts (for saving to JSON) and sync-matches.ts (for direct import).
 */
/**
 * Strip club ID prefix from team name.
 * E.g. "8020091 - FK Frýdek-Místek" → "FK Frýdek-Místek"
 */
function stripClubId(teamStr: string): string {
  return teamStr.replace(/^\d+\s*-\s*/, '').trim();
}

/**
 * Extract competition code and season from "Číslo soutěže".
 * E.g. "2025003A1A" → { code: "A1A", season: 2025 }
 * Format: YYYYNNNCODE where YYYY=season, NNN=3-digit number, CODE=variable-length code.
 */
function parseCompetitionNumber(numStr: string): { code: string; season: number | null } {
  const match = numStr.match(/^(\d{4})\d{3}(.+)$/);
  if (!match) return { code: '', season: null };
  return { code: match[2], season: parseInt(match[1], 10) };
}

export function parseMatchRows(rows: XlsxRow[]): FacrMatch[] {
  const matches: FacrMatch[] = [];
  for (const row of rows) {
    const facrId = row['Číslo zápasu']?.toString().trim();
    if (!facrId) continue;

    const [homeScore, awayScore] = parseScore(row['Výsledek']);
    const { matchDate, matchTime } = parseMatchDateTime(row['Datum a čas']);
    if (!matchDate) continue;

    const compNum = row['Číslo soutěže']?.toString().trim() ?? '';
    const { code: competitionCode, season } = parseCompetitionNumber(compNum);

    matches.push({
      facrId,
      homeTeam: stripClubId(row['Domácí']?.trim() ?? ''),
      awayTeam: stripClubId(row['Hosté']?.trim() ?? ''),
      homeScore,
      awayScore,
      matchDate,
      matchTime,
      round: row.Kolo ? parseInt(row.Kolo.toString(), 10) || null : null,
      venue: row['Hřiště']?.trim() ?? '',
      competitionName: row['Soutěž']?.trim() ?? '',
      competitionCode,
      season,
      period: '',
      organizingBody: row['Org. jednotka']?.trim() ?? '',
    });
  }
  return matches;
}

/**
 * Login to FAČR IS and download matches Excel export.
 * Returns raw XLSX buffer.
 */
export async function scrapeMatchesXlsx(
  email: string,
  password: string,
  seasonYear?: number,
  club: FacrClub = DEFAULT_CLUB,
): Promise<Buffer> {
  const { accessToken, jar } = await facrLogin(email, password);

  // Step 3: GET matches page to get ViewState
  console.log('[FAČR] Step 3: Fetching matches page...');
  const pageRes = await fetch(
    `${FACR_BASE}/public/zapasy/prehled-zapasu.aspx?klub=1&lite=1`,
    {
      headers: { Cookie: `access_token=${accessToken}; ${jar.toString()}` },
      redirect: 'follow',
    },
  );
  jar.addFromResponse(pageRes);
  const pageHtml = await pageRes.text();

  let viewState = extractFormField(pageHtml, '__VIEWSTATE');
  let viewStateGenerator = extractFormField(pageHtml, '__VIEWSTATEGENERATOR');
  let eventValidation = extractFormField(pageHtml, '__EVENTVALIDATION');

  if (!viewState) {
    throw new Error('Failed to extract __VIEWSTATE from matches page');
  }

  const rocnik = resolveRocnikValue(pageHtml, seasonYear);

  // Step 4: POST search to load results (required before export)
  // Explicitly set txtDatumOd to season start — the FAČR form pre-fills it
  // with today's date, which would exclude past matches with updated scores.
  const seasonStart = getSeasonStartDate(seasonYear);
  console.log(`[FAČR] Step 4: Searching matches for ${club.name} (ročník ${rocnik}, from ${seasonStart})...`);
  const searchFormData = new URLSearchParams({
    __EVENTTARGET: 'ctl00$MainContent$btnSearch',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGenerator,
    __EVENTVALIDATION: eventValidation,
    'ctl00$TopMenu$listChangeSport': '1',
    'ctl00$MainContent$listSearchDruhSouteze': '0',
    'ctl00$MainContent$txtSearchSoutezNazev': '',
    'ctl00$MainContent$txtSearchSoutezCislo': '',
    'ctl00$MainContent$OddilBoxClenem$txtCisloKlubu': club.number,
    'ctl00$MainContent$OddilBoxClenem$txtNazevKlubu': club.name,
    'ctl00$MainContent$OddilBoxClenem$hidIdKlubu': club.internalId,
    'ctl00$MainContent$OddilBoxClenem$hidTypSportu': '1',
    'ctl00$MainContent$listOddilTyp': '0',
    'ctl00$MainContent$txtDatumOd': seasonStart,
    'ctl00$MainContent$txtDatumDo': '',
    'ctl00$MainContent$txtSearchHriste': '',
    'ctl00$MainContent$listSearchRocnik': rocnik,
    'ctl00$MainContent$txtSearchCislo': '',
    'ctl00$MainContent$txtSearchkolo': '',
    'ctl00$MainContent$listZapasZahajen': '0',
    'ctl00$MainContent$listZapis': '0',
    'ctl00$MainContent$listObdobi': '',
  });

  const searchRes = await fetch(
    `${FACR_BASE}/public/zapasy/prehled-zapasu.aspx?klub=1&lite=1`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: `access_token=${accessToken}; ${jar.toString()}`,
      },
      body: searchFormData.toString(),
      redirect: 'follow',
    },
  );

  const searchHtml = await searchRes.text();

  // Extract fresh ViewState from search results page
  viewState = extractFormField(searchHtml, '__VIEWSTATE');
  viewStateGenerator = extractFormField(searchHtml, '__VIEWSTATEGENERATOR');
  eventValidation = extractFormField(searchHtml, '__EVENTVALIDATION');

  if (!viewState) {
    throw new Error('Failed to extract __VIEWSTATE from matches search results');
  }

  // Step 5: POST export request to download Excel
  console.log('[FAČR] Step 5: Downloading Excel export...');
  const exportFormData = new URLSearchParams({
    __EVENTTARGET: 'ctl00$MainContent$btnExport',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGenerator,
    __EVENTVALIDATION: eventValidation,
    'ctl00$TopMenu$listChangeSport': '1',
    'ctl00$MainContent$listSearchDruhSouteze': '0',
    'ctl00$MainContent$txtSearchSoutezNazev': '',
    'ctl00$MainContent$txtSearchSoutezCislo': '',
    'ctl00$MainContent$OddilBoxClenem$txtCisloKlubu': club.number,
    'ctl00$MainContent$OddilBoxClenem$txtNazevKlubu': club.name,
    'ctl00$MainContent$OddilBoxClenem$hidIdKlubu': club.internalId,
    'ctl00$MainContent$OddilBoxClenem$hidTypSportu': '1',
    'ctl00$MainContent$listOddilTyp': '0',
    'ctl00$MainContent$txtDatumOd': seasonStart,
    'ctl00$MainContent$txtDatumDo': '',
    'ctl00$MainContent$txtSearchHriste': '',
    'ctl00$MainContent$listSearchRocnik': rocnik,
    'ctl00$MainContent$txtSearchCislo': '',
    'ctl00$MainContent$txtSearchkolo': '',
    'ctl00$MainContent$listZapasZahajen': '0',
    'ctl00$MainContent$listZapis': '0',
    'ctl00$MainContent$listObdobi': '',
  });

  const exportRes = await fetch(
    `${FACR_BASE}/public/zapasy/prehled-zapasu.aspx?klub=1&lite=1`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: `access_token=${accessToken}; ${jar.toString()}`,
      },
      body: exportFormData.toString(),
      redirect: 'follow',
    },
  );

  if (!exportRes.ok) {
    throw new Error(`Excel export failed: ${exportRes.status}`);
  }

  const arrayBuffer = await exportRes.arrayBuffer();
  console.log(`[FAČR] Downloaded ${arrayBuffer.byteLength} bytes`);

  return Buffer.from(arrayBuffer);
}

// ---- Players ----

/**
 * Strip HTML tags and decode common entities.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface PlayerListEntry {
  facrId: string;
  name: string;
  facrUuid: string;
}

/**
 * Parse player rows from the list page HTML.
 * Each row has a link to the detail page with req=<UUID>.
 */
function parsePlayerListRows(html: string): PlayerListEntry[] {
  const players: PlayerListEntry[] = [];

  // Find the gridData table
  const tableMatch = html.match(/<table[^>]*id="[^"]*gridData[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    return players;
  }

  const tableHtml = tableMatch[1];

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows: string[] = [];
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    rows.push(rowMatch[1]);
  }

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    // Extract req UUID from the detail link
    const linkMatch = row.match(/osoby-detail\/\?req=([a-f0-9-]+)/i);
    if (!linkMatch) continue;

    const facrUuid = linkMatch[1];

    // The first cell "ID / Osoba" contains both ID and name in a single link:
    // <a href="..."><span>19010400</span><h4>Antonín Adamík</h4></a>
    // Extract ID from <span> and name from <h4> within the first <td>.
    const firstCellMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    if (!firstCellMatch) continue;

    const firstCellHtml = firstCellMatch[1];
    const idMatch = firstCellHtml.match(/<span[^>]*>(\d+)<\/span>/i);
    const nameMatch = firstCellHtml.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);

    if (idMatch && nameMatch) {
      players.push({
        facrId: idMatch[1].trim(),
        name: stripHtml(nameMatch[1]),
        facrUuid,
      });
    }
  }

  return players;
}

/**
 * Check if there are more pages in the pagination.
 * Returns the next page number or null if on the last page.
 *
 * The pagination uses Bootstrap-style <nav><ul><li><a> with links like:
 *   __doPostBack('ctl00$MainContent$VypisHracu$gridData','Page$2')
 */
function getNextPageNumber(html: string, currentPage: number): number | null {
  const nextPageRegex = new RegExp(`Page\\$${currentPage + 1}`, 'i');
  if (nextPageRegex.test(html)) {
    return currentPage + 1;
  }
  return null;
}

/**
 * Parse date from Czech format (DD.MM.YYYY) to ISO format (YYYY-MM-DD).
 */
function parseCzechDate(dateStr: string): string {
  const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) return dateStr;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Scrape a single player's detail page for full data.
 */
async function scrapePlayerDetail(
  facrUuid: string,
  accessToken: string,
  jar: CookieJar,
): Promise<{ dateOfBirth: string; nationality: string; isActive: boolean; photoUrl: string | null }> {
  const url = `${FACR_BASE}/public/hraci/osoby-detail/?req=${facrUuid}&sport=fotbal`;
  const res = await fetch(url, {
    headers: { Cookie: `access_token=${accessToken}; ${jar.toString()}` },
    redirect: 'follow',
  });
  const html = await res.text();

  // Extract date of birth - look for "Datum narození" or "Dat. nar." in the info table
  let dateOfBirth = '';
  const dobMatch = html.match(/(?:Datum\s+narozen[ií]|Dat\.\s*nar\.)[^<]*<\/[^>]+>\s*<[^>]+>([^<]+)/i)
    || html.match(/born[^<]*<\/[^>]+>\s*<[^>]+>([^<]+)/i);
  if (dobMatch) {
    dateOfBirth = parseCzechDate(dobMatch[1].trim());
  }

  // Extract nationality
  let nationality = '';
  const natMatch = html.match(/(?:Státní\s+příslušnost|Národnost)[^<]*<\/[^>]+>\s*<[^>]+>([^<]+)/i);
  if (natMatch) {
    nationality = natMatch[1].trim();
  }

  // Check for AKTIVNÍ badge
  const isActive = /AKTIVN[ÍI]/i.test(html);

  // Extract photo URL from background-image CSS
  let photoUrl: string | null = null;
  const photoMatch = html.match(/get-foto\.aspx\?PublishId=([a-f0-9-]+)/i);
  if (photoMatch) {
    photoUrl = `${FACR_BASE}/public/hraci/get-foto.aspx?PublishId=${photoMatch[1]}`;
  }

  return { dateOfBirth, nationality, isActive, photoUrl };
}

/**
 * Login to FAČR IS and scrape players for FK Frýdek-Místek.
 */
export async function scrapePlayers(
  email: string,
  password: string,
  club: FacrClub = DEFAULT_CLUB,
): Promise<FacrPlayer[]> {
  const { accessToken, jar } = await facrLogin(email, password);

  // Step 3: GET player list page to get ViewState
  console.log('[FAČR] Step 3: Fetching player list page...');
  const pageRes = await fetch(
    `${FACR_BASE}/public/hraci/hraci-prehled/?sport=fotbal`,
    {
      headers: { Cookie: `access_token=${accessToken}; ${jar.toString()}` },
      redirect: 'follow',
    },
  );
  jar.addFromResponse(pageRes);
  const pageHtml = await pageRes.text();

  const viewState = extractFormField(pageHtml, '__VIEWSTATE');
  const viewStateGenerator = extractFormField(pageHtml, '__VIEWSTATEGENERATOR');

  if (!viewState) {
    throw new Error('Failed to extract __VIEWSTATE from player list page');
  }

  // Step 4: POST search with club number
  console.log('[FAČR] Step 4: Searching players...');
  const formData = new URLSearchParams({
    __EVENTTARGET: 'ctl00$MainContent$btnSearch',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGenerator,
    'ctl00$TopMenu$listChangeSport': '1',
    'ctl00$MainContent$OddilBoxClenem$txtCisloKlubu': club.number,
    'ctl00$MainContent$OddilBoxClenem$txtNazevKlubu': club.name,
    'ctl00$MainContent$OddilBoxClenem$hidIdKlubu': club.internalId,
    'ctl00$MainContent$OddilBoxClenem$hidTypSportu': club.internalId,
    'ctl00$MainContent$txtSearchJmeno': '',
    'ctl00$MainContent$txtSearchPrijmeni': '',
    'ctl00$MainContent$txtSearchRodneCislo': '',
    'ctl00$MainContent$txtSearchIdClena': '',
  });

  const searchRes = await fetch(
    `${FACR_BASE}/public/hraci/hraci-prehled/?sport=fotbal`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: `access_token=${accessToken}; ${jar.toString()}`,
      },
      body: formData.toString(),
      redirect: 'follow',
    },
  );

  let resultHtml = await searchRes.text();

  // Step 5: Parse all pages
  console.log('[FAČR] Step 5: Parsing player list...');
  const allPlayers: PlayerListEntry[] = [];

  // Parse first page
  let pagePlayers = parsePlayerListRows(resultHtml);
  allPlayers.push(...pagePlayers);
  console.log(`[FAČR]   Page 1: ${pagePlayers.length} players`);

  // Handle pagination
  let currentPage = 1;
  let nextPage = getNextPageNumber(resultHtml, currentPage);
  while (nextPage !== null) {
    const pageViewState = extractFormField(resultHtml, '__VIEWSTATE');
    const pageViewStateGenerator = extractFormField(resultHtml, '__VIEWSTATEGENERATOR');

    const pageFormData = new URLSearchParams({
      __EVENTTARGET: 'ctl00$MainContent$VypisHracu$gridData',
      __EVENTARGUMENT: `Page$${nextPage}`,
      __LASTFOCUS: '',
      __VIEWSTATE: pageViewState,
      __VIEWSTATEGENERATOR: pageViewStateGenerator,
      'ctl00$TopMenu$listChangeSport': '1',
    });

    const pageRes = await fetch(
      `${FACR_BASE}/public/hraci/hraci-prehled/?sport=fotbal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `access_token=${accessToken}; ${jar.toString()}`,
        },
        body: pageFormData.toString(),
        redirect: 'follow',
      },
    );

    resultHtml = await pageRes.text();
    pagePlayers = parsePlayerListRows(resultHtml);
    allPlayers.push(...pagePlayers);
    console.log(`[FAČR]   Page ${nextPage}: ${pagePlayers.length} players`);

    currentPage = nextPage;
    nextPage = getNextPageNumber(resultHtml, currentPage);
  }

  console.log(`[FAČR] Total players from list: ${allPlayers.length}`);

  // Step 6: Scrape detail pages for full data
  console.log('[FAČR] Step 6: Scraping player detail pages...');
  const players: FacrPlayer[] = [];

  for (let i = 0; i < allPlayers.length; i++) {
    const entry = allPlayers[i];
    if (i > 0 && i % 10 === 0) {
      console.log(`[FAČR]   Progress: ${i}/${allPlayers.length}`);
    }

    try {
      const detail = await scrapePlayerDetail(entry.facrUuid, accessToken, jar);
      players.push({
        facrId: entry.facrId,
        name: entry.name,
        facrUuid: entry.facrUuid,
        dateOfBirth: detail.dateOfBirth,
        nationality: detail.nationality,
        isActive: detail.isActive,
        photoUrl: detail.photoUrl,
      });
    } catch (err) {
      console.warn(`[FAČR]   Failed to scrape detail for ${entry.name} (${entry.facrId}): ${err}`);
      // Still include the player with basic info
      players.push({
        facrId: entry.facrId,
        name: entry.name,
        facrUuid: entry.facrUuid,
        dateOfBirth: '',
        nationality: '',
        isActive: false,
        photoUrl: null,
      });
    }

    // Small delay to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`[FAČR] Scraped ${players.length} players with details`);
  return players;
}
