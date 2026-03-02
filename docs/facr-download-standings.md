# FAČR IS - Download Competition Standings (Tabulky)

How to programmatically scrape competition standings tables from the FAČR Information System (is.fotbal.cz).

## Prerequisites

Requires authentication - see [facr-download-matches.md](./facr-download-matches.md) for the login flow (Steps 1-2).

## Scraping Flow

### Step 1: Login + Establish IS1 session

Same as other scrapers - POST login to get JWT, then GET `/public/?sport=fotbal` to establish IS1 session cookies.

### Step 2: Scrape competition list to get UUIDs

Use the existing competition scraping flow (see [facr-download-competitions.md](./facr-download-competitions.md)) to get the list of competitions.

Each competition row in the `MainContent_gridData` table contains a link in the Name column:
```html
<a href="detail-souteze.aspx?req=e3127865-a109-45cd-9048-3e6429e2eb11&sport=fotbal">SATUM 5. liga mužů</a>
```

Extract the `req` UUID parameter from each link - this is needed for the standings page URL.

### Step 3: Fetch standings page (simple GET)

```
GET https://is.fotbal.cz/public/souteze/tabulky-souteze.aspx?req={UUID}
Cookie: <all cookies from login>
```

**No ASP.NET PostBack required** - this is a simple GET request with the competition UUID.

Example:
```
GET https://is.fotbal.cz/public/souteze/tabulky-souteze.aspx?req=e3127865-a109-45cd-9048-3e6429e2eb11
```

### Step 4: Parse "Tabulka celková" HTML table

The response HTML contains three tables (all with `class="vysledky-tabulky"`):
1. **Tabulka celková** - Overall standings (this is what we scrape)
2. **Tabulka doma** - Home standings
3. **Tabulka venku** - Away standings

Each table is preceded by an `<h3>` heading. Find the heading containing "celková" then get the table from the following `div.list.tabulky`.

**HTML structure:**
```html
<div class="vysledky-tabulky">
  <h3>Tabulka celková</h3>
  <div class="list tabulky">
    <table class="vysledky-tabulky">
      <tr>
        <th class="first">Rk.</th>
        <th>Družstvo</th>
        <th>Záp.</th>
        <th>+</th>
        <th>0</th>
        <th>-</th>
        <th>Skóre</th>
        <th class="last">Body</th>
      </tr>
      <tr>
        <td>1</td>
        <td>Kravaře</td>
        <td>16</td>
        <td>11</td>
        <td>1</td>
        <td>4</td>
        <td>45:17</td>
        <td>34</td>
      </tr>
      <!-- ... more rows -->
    </table>
  </div>
</div>
```

**Columns (8 total):**

| # | Column | Description | Example |
|---|--------|-------------|---------|
| 0 | Rk. | Position/rank | 1 |
| 1 | Družstvo | Team name | Kravaře |
| 2 | Záp. | Matches played | 16 |
| 3 | + | Wins | 11 |
| 4 | 0 | Draws | 1 |
| 5 | - | Losses | 4 |
| 6 | Skóre | Goals for:against | 45:17 |
| 7 | Body | Points | 34 |

**Note:** The Skóre column uses `:` as separator (e.g., `45:17` → goalsFor=45, goalsAgainst=17).

## Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| Table class | `vysledky-tabulky` | CSS class for standings tables |
| Heading text | `Tabulka celková` | H3 text identifying the overall standings |
| URL pattern | `tabulky-souteze.aspx?req={UUID}` | Standings page URL |

## Notes

- No ASP.NET ViewState/PostBack needed - simple GET request
- Each competition has three tables (overall, home, away) - we only scrape "celková"
- Some competitions may not have standings yet (e.g., cups, tournaments that haven't started)
- The UUID from the competition list detail link is reused for the standings page URL
- Standings are linked to categories via the competition code → category-code mapping
