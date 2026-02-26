# FAČR IS - Download Players (Hráči)

How to programmatically scrape player data from the FAČR Information System (is.fotbal.cz).

## Prerequisites

Requires authentication - see [facr-download-matches.md](./facr-download-matches.md) for the login flow (Steps 1-2).

## Scraping Flow

### Step 1: Login + Establish IS1 session

Same as match download - POST login to get JWT, then GET `/public/?sport=fotbal` to establish IS1 session cookies.

### Step 2: Fetch player list page (get ASP.NET ViewState)

```
GET https://is.fotbal.cz/public/hraci/hraci-prehled/?sport=fotbal
Cookie: <all cookies from login>
```

From the HTML response, extract these hidden form fields:
- `__VIEWSTATE` (base64 string)
- `__VIEWSTATEGENERATOR` (8 chars)

**Note:** This page does NOT have `__EVENTVALIDATION` (unlike competitions/matches pages).

### Step 3: Search players by club (ASP.NET PostBack)

```
POST https://is.fotbal.cz/public/hraci/hraci-prehled/?sport=fotbal
Cookie: <all cookies from login>
Content-Type: application/x-www-form-urlencoded

__EVENTTARGET=ctl00$MainContent$btnSearch
__EVENTARGUMENT=
__LASTFOCUS=
__VIEWSTATE=<from step 2>
__VIEWSTATEGENERATOR=<from step 2>
ctl00$TopMenu$listChangeSport=1
ctl00$MainContent$OddilBoxClenem$txtCisloKlubu=8020091
ctl00$MainContent$OddilBoxClenem$txtNazevKlubu=FK Frýdek-Místek z.s.
ctl00$MainContent$OddilBoxClenem$hidIdKlubu=2521
ctl00$MainContent$OddilBoxClenem$hidTypSportu=2521
ctl00$MainContent$txtSearchJmeno=
ctl00$MainContent$txtSearchPrijmeni=
ctl00$MainContent$txtSearchRodneCislo=
ctl00$MainContent$txtSearchIdClena=
```

**Important form fields:**
- `ctl00$MainContent$OddilBoxClenem$txtCisloKlubu` = `8020091` (club external number)
- `ctl00$MainContent$OddilBoxClenem$hidIdKlubu` = `2521` (club internal ID)
- `__EVENTTARGET` = `ctl00$MainContent$btnSearch` (search button postback)

### Step 4: Parse player list HTML

The response HTML contains a table with player rows. Each row contains:
- Player's FAČR ID (ID člena)
- Full name (as a link to detail page)
- Country
- Birth year
- Club name
- Membership status
- Photo indicator (yes/no)

Each player link points to: `/public/hraci/osoby-detail/?req=<UUID>&sport=fotbal`

Extract the `req` UUID from each player link for detail page access.

### Step 5: Fetch player detail page

```
GET https://is.fotbal.cz/public/hraci/osoby-detail/?req=<UUID>&sport=fotbal
Cookie: <all cookies from login>
```

**Data available on detail page:**

| Field | CSS Selector / Location | Example |
|-------|------------------------|---------|
| Name | `.overview__info h2` or heading | Novák Jan |
| ID člena | Info table row | 96081306 |
| Date of Birth | Info table row | 06.08.1996 |
| Nationality | Info table row | Česká |
| Active badge | `.badge` with text "AKTIVNÍ" | AKTIVNÍ |
| Photo | `.overview__profile` background-image CSS | `get-foto.aspx?PublishId=<photo-UUID>` |

### Step 6: Download player photo

```
GET https://is.fotbal.cz/public/hraci/get-foto.aspx?PublishId=<photo-UUID>
Cookie: <all cookies from login>
```

Response: JPEG image data.

**Note:** The `PublishId` UUID is different from the player's `req` UUID. Extract it from the CSS `background-image` property on the detail page.

### Alternative: XLS Export (all players at once)

The list page has an export button that downloads all players as XLS:

```
POST https://is.fotbal.cz/public/hraci/hraci-prehled/?sport=fotbal
Cookie: <all cookies from login>
Content-Type: application/x-www-form-urlencoded

__EVENTTARGET=ctl00$MainContent$btnExport
__EVENTARGUMENT=
__VIEWSTATE=<from search results page>
__VIEWSTATEGENERATOR=<from search results page>
```

The XLS contains columns: ID, name, country, birth year, club, membership status.

**Limitation:** XLS only contains birth year (not full date), no photo data, and no active status badges. For full data, individual detail pages must be scraped.

## Pagination

The player list shows 50 entries per page. For clubs with more than 50 members, pagination is handled via PostBack:

```
__EVENTTARGET=ctl00$MainContent$gridData
__EVENTARGUMENT=Page$<page_number>
```

Where `<page_number>` is 2, 3, etc. Include the current ViewState from the page.

## Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| Club number | `8020091` | FK Frýdek-Místek external number |
| Club internal ID | `2521` | Used in hidden form fields |
| Search button event | `ctl00$MainContent$btnSearch` | PostBack event target |
| Export button event | `ctl00$MainContent$btnExport` | XLS export PostBack |
| Players per page | 50 | Pagination size |

## Notes

- The player list page has ~353 members for FK Frýdek-Místek (7+ pages)
- Detail pages must be scraped individually for full date of birth (list only shows year)
- Photo UUID (`PublishId`) is different from the player's `req` UUID
- Be mindful of request volume when scraping detail pages (add delays between requests)
- All form field values must be URL-encoded when POSTing
- The detail page shows badges like "AKTIVNÍ" to indicate current membership status
