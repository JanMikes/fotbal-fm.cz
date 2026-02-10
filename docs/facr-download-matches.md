# FAČR IS - Download Matches

How to programmatically download match data (Excel) from the FAČR Information System (is.fotbal.cz).

## Architecture Overview

The FAČR IS consists of two systems behind a single nginx reverse proxy:

| System | Path | Technology | Purpose |
|--------|------|------------|---------|
| New IS | `/`, `/api/`, `/_next/` | .NET API + Next.js frontend | Authentication, modern UI |
| Old IS1 | `/public/` | ASP.NET WebForms 4.0 | Match data, club management, Excel export |

Both systems share the same domain (`is.fotbal.cz`) and cookies.

## Authentication Flow

**No browser automation needed.** The entire flow works with simple HTTP requests (Node.js fetch, PHP curl, etc.).

### Step 1: Login (get JWT)

```
POST https://is.fotbal.cz/api/auth/login?discipline=football
Content-Type: application/json

{"email": "<EMAIL>", "password": "<PASSWORD>"}
```

Response (200 OK):
```json
{
  "access_token": "<JWT>",
  "refresh_token": "<JWT>",
  "user": {
    "user_id": 7108,
    "person_id": 382215,
    "name": "...",
    "is1_auth_token": "<ASP.NET Forms Auth token>",
    "is1_logged_in": true
  }
}
```

**JWT details:**
- Algorithm: HS512
- `access_token` expires in ~1 hour (`exp` claim)
- `refresh_token` expires in ~7 days
- Payload contains: `nameid`, `person_id`, `role` (with club permissions), `token_purpose`
- Club ID in token: `role.football.club_admin.club[0]` = `2521` (internal ID for FK Frydek-Mistek)

### Step 2: Establish IS1 session

The old ASP.NET system reads the JWT from the `access_token` cookie, validates it, and creates a server-side session with `.ASPXAUTH` httpOnly cookie.

```
GET https://is.fotbal.cz/public/?sport=fotbal
Cookie: access_token=<JWT from step 1>
```

Response sets cookies:
- `.ASPXAUTH` (httpOnly) - ASP.NET Forms Authentication ticket
- `ASP.NET_SessionId` (httpOnly) - session identifier
- `sport_type=1`
- An encrypted cookie derived from `is1_auth_token`

**Important:** Save all cookies from this response. They are needed for all subsequent requests to the old system.

### Step 3: Fetch match page (get ASP.NET ViewState)

```
GET https://is.fotbal.cz/public/zapasy/prehled-zapasu.aspx?klub=1&lite=1
Cookie: <all cookies from step 2>
```

From the HTML response, extract these hidden form fields:
- `__VIEWSTATE` (~12KB base64 string)
- `__VIEWSTATEGENERATOR` (8 chars, e.g. `B3705BB5`)
- `__EVENTVALIDATION` (~1.3KB base64 string)

Also available in form:
- `ctl00$MainContent$OddilBoxClenem$hidIdKlubu` = `2521` (club internal ID)
- `ctl00$MainContent$OddilBoxClenem$hidTypSportu` = `1` (football)
- `ctl00$MainContent$txtDatumOd` - date filter (format: `DD.MM.YYYY`)

### Step 4: Download Excel (ASP.NET PostBack)

```
POST https://is.fotbal.cz/public/zapasy/prehled-zapasu.aspx?klub=1&lite=1
Cookie: <all cookies from step 2>
Content-Type: application/x-www-form-urlencoded

__EVENTTARGET=ctl00$MainContent$btnExport
__EVENTARGUMENT=
__LASTFOCUS=
__VIEWSTATE=<from step 3>
__VIEWSTATEGENERATOR=<from step 3>
__EVENTVALIDATION=<from step 3>
ctl00$MainContent$OddilBoxClenem$hidIdKlubu=2521
ctl00$MainContent$OddilBoxClenem$hidTypSportu=1
```

Response:
```
Content-Type: application/excel
Content-Disposition: attachment; filename=seznam-zapasu.xls
```

The file is a proper CDFV2 Microsoft Excel `.xls` file (~100KB).

## Excel Content

The downloaded Excel contains these columns:

| Column | Description | Example |
|--------|-------------|---------|
| Org. jednotka | Organizing body | Ridici komise pro Moravu |
| Cislo | Match number | 2025003E1A1705 |
| Datum a cas | Date and time | 01.03.2026 12:30 |
| Kolo | Round | 17 |
| Por. v kole | Order in round | 6 |
| Domaci | Home team | FK Frydek-Mistek |
| Hoste | Away team | Banik Ostrava |
| Vysledek | Score | 3 : 1 |
| Hriste/Stadion | Venue | F-M, Horni 3276-trava |
| Zapis | Match record status | - |
| Obdobi | Period | J (jaro/spring), P (podzim/fall) |
| Soutez | Competition name | 1.MSZL U 15 |
| Kod | Competition code | E1A |
| Rocnik | Season | 2025 |

## Implementation (Node.js)

```typescript
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import axios from 'axios';
import * as cheerio from 'cheerio';

const jar = new CookieJar();
const client = wrapper(axios.create({ jar, withCredentials: true }));

const BASE = 'https://is.fotbal.cz';

async function downloadMatches(email: string, password: string): Promise<Buffer> {
  // Step 1: Login
  const loginRes = await client.post(
    `${BASE}/api/auth/login?discipline=football`,
    { email, password },
  );
  const accessToken = loginRes.data.access_token;

  // Step 2: Establish IS1 session (sets .ASPXAUTH cookie)
  await client.get(`${BASE}/public/?sport=fotbal`, {
    headers: { Cookie: `access_token=${accessToken}` },
  });

  // Step 3: Get match page with ViewState
  const pageRes = await client.get(
    `${BASE}/public/zapasy/prehled-zapasu.aspx?klub=1&lite=1`,
  );
  const $ = cheerio.load(pageRes.data);

  const viewState = $('input[name="__VIEWSTATE"]').val();
  const viewStateGenerator = $('input[name="__VIEWSTATEGENERATOR"]').val();
  const eventValidation = $('input[name="__EVENTVALIDATION"]').val();
  const klubId = $('input[name="ctl00$MainContent$OddilBoxClenem$hidIdKlubu"]').val();
  const typSportu = $('input[name="ctl00$MainContent$OddilBoxClenem$hidTypSportu"]').val();

  // Step 4: Download Excel via PostBack
  const formData = new URLSearchParams({
    __EVENTTARGET: 'ctl00$MainContent$btnExport',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: viewState as string,
    __VIEWSTATEGENERATOR: viewStateGenerator as string,
    __EVENTVALIDATION: eventValidation as string,
    'ctl00$MainContent$OddilBoxClenem$hidIdKlubu': klubId as string,
    'ctl00$MainContent$OddilBoxClenem$hidTypSportu': typSportu as string,
  });

  const excelRes = await client.post(
    `${BASE}/public/zapasy/prehled-zapasu.aspx?klub=1&lite=1`,
    formData.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      responseType: 'arraybuffer',
    },
  );

  return Buffer.from(excelRes.data);
}
```

### Dependencies

```bash
npm install axios axios-cookiejar-support tough-cookie cheerio
npm install -D @types/tough-cookie
```

### Parsing the Excel

Use `xlsx` (SheetJS) to parse the downloaded `.xls` buffer:

```typescript
import * as XLSX from 'xlsx';

const buffer = await downloadMatches(email, password);
const workbook = XLSX.read(buffer, { type: 'buffer' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);
// rows is an array of objects with column headers as keys
```

## Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| Club number | `8020091` | FK Frydek-Mistek external number |
| Club internal ID | `2521` | Used in API/forms |
| Person ID | `382215` | Logged-in user's person ID |
| User ID | `7108` | Logged-in user's account ID |
| Discipline | `football` | Sport discipline parameter |

## Notes

- The `.ASPXAUTH` cookie is httpOnly - set by the server, not accessible from JavaScript
- The `access_token` cookie is what bridges the new JWT system to the old ASP.NET Forms Auth
- ViewState is required for every POST - always GET the page first to extract it
- The Excel export respects any filters set on the form (date range, competition, etc.)
- All form field values must be URL-encoded when POSTing
- No rate limiting was observed on these endpoints
- The old IS1 system uses jQuery 1.10.2 and ASP.NET 4.0
