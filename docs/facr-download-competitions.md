# FAČR IS - Download Competitions (Soutěže)

How to programmatically scrape competition data from the FAČR Information System (is.fotbal.cz).

## Prerequisites

Requires authentication - see [facr-download-matches.md](./facr-download-matches.md) for the login flow (Steps 1-2).

## Scraping Flow

### Step 1: Login + Establish IS1 session

Same as match download - POST login to get JWT, then GET `/public/?sport=fotbal` to establish IS1 session cookies.

### Step 2: Fetch competitions page (get ASP.NET ViewState)

```
GET https://is.fotbal.cz/public/souteze/prehled-soutezi.aspx?sport=fotbal
Cookie: <all cookies from login>
```

From the HTML response, extract these hidden form fields:
- `__VIEWSTATE` (base64 string)
- `__VIEWSTATEGENERATOR` (8 chars, e.g. `1A2ABD71`)
- `__EVENTVALIDATION` (base64 string)

### Step 3: Search competitions by club number (ASP.NET PostBack)

```
POST https://is.fotbal.cz/public/souteze/prehled-soutezi.aspx?sport=fotbal
Cookie: <all cookies from login>
Content-Type: application/x-www-form-urlencoded

__EVENTTARGET=ctl00$MainContent$btnSearch
__EVENTARGUMENT=
__LASTFOCUS=
__VIEWSTATE=<from step 2>
__VIEWSTATEGENERATOR=<from step 2>
__EVENTVALIDATION=<from step 2>
ctl00$TopMenu$listChangeSport=1
ctl00$MainContent$listSearchDruhSouteze=0
ctl00$MainContent$bxOrgJednotka$txtNazevOrgJednotky=
ctl00$MainContent$bxOrgJednotka$hidIdOrgJednotky=
ctl00$MainContent$bxOrgJednotka$txtOrgJednotkyParam=
ctl00$MainContent$OddilBoxClenem$txtCisloKlubu=8020091
ctl00$MainContent$OddilBoxClenem$txtNazevKlubu=FK Frýdek-Místek z.s.
ctl00$MainContent$OddilBoxClenem$hidIdKlubu=2521
ctl00$MainContent$OddilBoxClenem$hidTypSportu=2521
ctl00$MainContent$txtSearchNazev=
ctl00$MainContent$listSearchRocnik=18
ctl00$MainContent$txtSearchKod=
ctl00$MainContent$txtSearchCislo=
```

**Important form fields:**
- `ctl00$MainContent$OddilBoxClenem$txtCisloKlubu` = `8020091` (club external number)
- `ctl00$MainContent$OddilBoxClenem$hidIdKlubu` = `2521` (club internal ID)
- `ctl00$MainContent$listSearchRocnik` = `18` (season dropdown value for 2025)
- `__EVENTTARGET` = `ctl00$MainContent$btnSearch` (search button postback)

### Step 4: Parse HTML table

The response HTML contains a table with ID `MainContent_gridData`.

Parse the table rows (`<tr>`) - first row is header, rest are data rows.

**Columns (9 total):**

| # | Column | ASP.NET Cell Index | Description | Example |
|---|--------|--------------------|-------------|---------|
| 0 | Číslo | `td[0]` | Unique competition number | 2025003A1A |
| 1 | Název | `td[1]` (contains `<a>` link) | Competition name | 3. Moravskoslezská fotbalová liga |
| 2 | Kód | `td[2]` | Competition code | A1A |
| 3 | Kategorie | `td[3]` | Category letter | A |
| 4 | Úroveň | `td[4]` | Level number | 1 |
| 5 | Skupina | `td[5]` | Group letter | A |
| 6 | Druh | `td[6]` | Competition type description | Muži MSFL skupina A |
| 7 | Org. jednotka | `td[7]` | Organizing body | Řídící komise pro Moravu |
| 8 | Ročník | `td[8]` | Season year | 2025 |

## Scraped Data (Season 2025, Club 8020091)

28 competitions total:

| Číslo | Název | Kód | Kat. | Úr. | Sk. | Druh | Org. jednotka |
|-------|-------|-----|------|-----|-----|------|---------------|
| 2025003A1A | 3. Moravskoslezská fotbalová liga | A1A | A | 1 | A | Muži MSFL skupina A | Řídící komise pro Moravu |
| 2025007Z1B | MOL Cup - 2.předkolo | Z1B | Z | 1 | B | Neurčeno Pohár FAČR skupina B | Pohár FAČR |
| 2025009V5C | PC V5C U-9 Frýdek Místek | V5C | V | 5 | C | Neurčeno PLANEO CUP | PLANEO CUP – POHÁR MLÁDEŽE FAČR |
| 2025007Z1C | Mol Cup - 1. kolo | Z1C | Z | 1 | C | Neurčeno Pohár FAČR skupina C | Pohár FAČR |
| 2025007Z1D | Mol Cup - 2. kolo | Z1D | Z | 1 | D | Neurčeno Pohár FAČR skupina D | Pohár FAČR |
| 2025007Z1E | Mol Cup - 3. kolo | Z1E | Z | 1 | E | Neurčeno Pohár FAČR skupina E | Pohár FAČR |
| 2025003C1A | 2.MSDL st. | C1A | C | 1 | A | Neurčeno Řídící komise pro Moravu sk. A | Řídící komise pro Moravu |
| 2025003D1A | 2.MSDL ml. | D1A | D | 1 | A | Neurčeno Řídící komise pro Moravu sk. A | Řídící komise pro Moravu |
| 2025003C2E | 3.MSDL-E st | C2E | C | 2 | E | Dorost - starší Divize skupina E | Řídící komise pro Moravu |
| 2025003D2E | 3.MSDL-E ml. | D2E | D | 2 | E | Dorost - mladší Divize skupina E | Řídící komise pro Moravu |
| 2025003E1A | 1.MSŽL U 15 | E1A | E | 1 | A | Neurčeno Řídící komise pro Moravu sk. A | Řídící komise pro Moravu |
| 2025003E2A | 1.MSŽL U 14 | E2A | E | 2 | A | Žáci - starší Divize skupina A | Řídící komise pro Moravu |
| 2025810G1B | Krajský přebor - starší přípravky chlapci | G1B | G | 1 | B | Přípravka - starší Krajský přebor sk. B | Moravskoslezský kraj |
| 2025003F1S | 1. liga SpSM-U 13 SEVER | F1S | F | 1 | S | Neurčeno Řídící komise pro Moravu sk. S | Řídící komise pro Moravu |
| 2025003F2S | 1. liga SpSM-U 12 SEVER | F2S | F | 2 | S | Žáci - mladší Divize skupina S | Řídící komise pro Moravu |
| 2025810G1A | Krajský přebor - starší přípravky dívky | G1A | G | 1 | A | Přípravka - starší Krajský přebor sk. A | Moravskoslezský kraj |
| 2025810Ř1A | Krajský přebor - mladší přípravky dívky | Ř1A | Ř | 1 | A | Ženy - Přípravka - mladší Krajský přebor sk. A | Moravskoslezský kraj |
| 2025009U1B | PC U1B U-10 Havířov | U1B | U | 1 | B | Neurčeno PLANEO CUP sk. B | PLANEO CUP – POHÁR MLÁDEŽE FAČR |
| 2025009U5C | PC U5C U-11 Nový Jičín | U5C | U | 5 | C | Neurčeno PLANEO CUP sk. C | PLANEO CUP – POHÁR MLÁDEŽE FAČR |
| 2025009V1B | PC V1B U-8 Třinec | V1B | V | 1 | B | Neurčeno PLANEO CUP sk. B | PLANEO CUP – POHÁR MLÁDEŽE FAČR |
| 2025009V6B | PC V6B U-9 Holešov-Všetuly | V6B | V | 6 | B | Neurčeno PLANEO CUP sk. B | PLANEO CUP – POHÁR MLÁDEŽE FAČR |
| 2025009U2A | PC U2A U-10 Hlučín | U2A | U | 2 | A | Neurčeno PLANEO CUP sk. A | PLANEO CUP – POHÁR MLÁDEŽE FAČR |
| 2025009U6A | PC U6A U-11 Hlučín | U6A | U | 6 | A | Neurčeno PLANEO CUP sk. A | PLANEO CUP – POHÁR MLÁDEŽE FAČR |
| 2025009V2A | PC V2A U-8 Nový Jičín | V2A | V | 2 | A | Neurčeno PLANEO CUP sk. A | PLANEO CUP – POHÁR MLÁDEŽE FAČR |
| 2025009V7A | PC V7A U-9 Hlučín | V7A | V | 7 | A | Neurčeno PLANEO CUP sk. A | PLANEO CUP – POHÁR MLÁDEŽE FAČR |
| 2025812F2F | 6.liga ml. žáků 7+1 sk. A | F2F | F | 2 | F | Žáci - mladší 3. třída skupina F | Frýdek-Místek |
| 2025812G1F | OP st. přípravek Frýdeckomístecko | G1F | G | 1 | F | Přípravka - starší Okresní přebor sk. F | Frýdek-Místek |
| 2025812H1F | OP ml. přípravek FM | H1F | H | 1 | F | Přípravka - mladší Okresní přebor sk. F | Frýdek-Místek |

## Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| Club number | `8020091` | FK Frýdek-Místek external number |
| Club internal ID | `2521` | Used in hidden form fields |
| Search button event | `ctl00$MainContent$btnSearch` | PostBack event target |
| Table ID | `MainContent_gridData` | Result table element ID |
| Season 2025 value | `18` | Dropdown value for ročník 2025 |

## Notes

- No Excel export available for competitions (unlike matches) - must parse HTML table
- The club autocomplete requires both `txtCisloKlubu` (visible number) and `hidIdKlubu` (internal ID)
- `hidTypSportu` seems to have value `2521` (same as club ID - possibly a bug or dual-purpose field)
- Season dropdown uses internal IDs, not the year directly
- All form field values must be URL-encoded when POSTing
- The table shows competitions where the club participates in the given season
- Competition codes (Kód) like "A1A" will be used to match competitions to our categories
