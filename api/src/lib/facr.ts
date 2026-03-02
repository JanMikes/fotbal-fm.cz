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
const CLUB_NUMBER = '8020091';
const CLUB_INTERNAL_ID = '2521';

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
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&ndash;/g, '–')
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
 * Login to FAČR IS and scrape competitions for FK Frýdek-Místek.
 */
export async function scrapeCompetitions(
  email: string,
  password: string,
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

  // Step 4: POST search with club number
  console.log('[FAČR] Step 4: Searching competitions...');
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
    'ctl00$MainContent$OddilBoxClenem$txtCisloKlubu': CLUB_NUMBER,
    'ctl00$MainContent$OddilBoxClenem$txtNazevKlubu': 'FK Frýdek-Místek z.s.',
    'ctl00$MainContent$OddilBoxClenem$hidIdKlubu': CLUB_INTERNAL_ID,
    'ctl00$MainContent$OddilBoxClenem$hidTypSportu': CLUB_INTERNAL_ID,
    'ctl00$MainContent$txtSearchNazev': '',
    'ctl00$MainContent$listSearchRocnik': '18',
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
): Promise<FacrStanding[]> {
  // 1. Scrape competitions to get UUIDs
  const competitions = await scrapeCompetitions(email, password);
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

// ---- Matches (Excel export) ----

export interface FacrMatch {
  facrId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  matchDate: string;
  matchTime: string;
  round: number;
  venue: string;
  competitionName: string;
  competitionCode: string;
  season: number;
  period: string;
  organizingBody: string;
}

/**
 * Login to FAČR IS and download matches Excel export.
 * Returns raw XLSX buffer.
 */
export async function scrapeMatchesXlsx(
  email: string,
  password: string,
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

  const viewState = extractFormField(pageHtml, '__VIEWSTATE');
  const viewStateGenerator = extractFormField(pageHtml, '__VIEWSTATEGENERATOR');
  const eventValidation = extractFormField(pageHtml, '__EVENTVALIDATION');

  if (!viewState) {
    throw new Error('Failed to extract __VIEWSTATE from matches page');
  }

  // Step 4: POST export request to download Excel
  console.log('[FAČR] Step 4: Downloading Excel export...');
  const formData = new URLSearchParams({
    __EVENTTARGET: 'ctl00$MainContent$btnExport',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGenerator,
    __EVENTVALIDATION: eventValidation,
    'ctl00$TopMenu$listChangeSport': '1',
  });

  const exportRes = await fetch(
    `${FACR_BASE}/public/zapasy/prehled-zapasu.aspx?klub=1&lite=1`,
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

    // Extract cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(stripHtml(cellMatch[1]));
    }

    // Cell 0 = ID člena, Cell 1 = name (from link)
    if (cells.length >= 2) {
      players.push({
        facrId: cells[0],
        name: cells[1],
        facrUuid,
      });
    }
  }

  return players;
}

/**
 * Check if there are more pages in the pagination.
 * Returns the next page number or null if on the last page.
 */
function getNextPageNumber(html: string): number | null {
  // ASP.NET pagination renders page links. Look for the current page (non-link number)
  // and see if there's a next one.
  // Pattern: <td><span>2</span></td><td><a ...>3</a></td> means current=2, next=3
  const pagerMatch = html.match(/<tr[^>]*class="[^"]*pager[^"]*"[^>]*>([\s\S]*?)<\/tr>/i);
  if (!pagerMatch) return null;

  const pagerHtml = pagerMatch[1];

  // Find the current page (rendered as <span> not <a>)
  const currentMatch = pagerHtml.match(/<span[^>]*>(\d+)<\/span>/);
  if (!currentMatch) return null;

  const currentPage = parseInt(currentMatch[1], 10);

  // Check if there's a link for the next page
  const nextPageRegex = new RegExp(`Page\\$${currentPage + 1}`, 'i');
  if (nextPageRegex.test(pagerHtml)) {
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
    'ctl00$MainContent$OddilBoxClenem$txtCisloKlubu': CLUB_NUMBER,
    'ctl00$MainContent$OddilBoxClenem$txtNazevKlubu': 'FK Frýdek-Místek z.s.',
    'ctl00$MainContent$OddilBoxClenem$hidIdKlubu': CLUB_INTERNAL_ID,
    'ctl00$MainContent$OddilBoxClenem$hidTypSportu': CLUB_INTERNAL_ID,
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
  let nextPage = getNextPageNumber(resultHtml);
  while (nextPage !== null) {
    const pageViewState = extractFormField(resultHtml, '__VIEWSTATE');
    const pageViewStateGenerator = extractFormField(resultHtml, '__VIEWSTATEGENERATOR');

    const pageFormData = new URLSearchParams({
      __EVENTTARGET: 'ctl00$MainContent$gridData',
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

    nextPage = getNextPageNumber(resultHtml);
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
