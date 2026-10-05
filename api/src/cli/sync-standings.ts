#!/usr/bin/env tsx
/**
 * CLI: Sync competition standings from FAČR IS to Strapi.
 *
 * For each competition, scrapes the "Tabulka celková" (overall standings)
 * and upserts standing rows in Strapi linked to the matching category.
 *
 * Usage:
 *   docker compose exec api npx tsx src/cli/sync-standings.ts
 *   docker compose exec api npx tsx src/cli/sync-standings.ts --from-file
 *   docker compose exec api npx tsx src/cli/sync-standings.ts --season 2025
 *
 * Environment variables:
 *   FACR_EMAIL    - FAČR IS login email (not needed with --from-file)
 *   FACR_PASSWORD - FAČR IS login password (not needed with --from-file)
 *   STRAPI_URL    - Strapi URL (default: http://localhost:1337)
 *   STRAPI_API_TOKEN - Strapi API token
 */

import * as fs from 'fs';
import * as path from 'path';
import { scrapeStandings, FACR_CLUBS, type FacrStanding } from '../lib/facr.js';
import { normalizeClubTeamName } from '../lib/team-name.js';
import { parseSeasonArg } from '../lib/cli-args.js';
import { strapiGet, strapiPost, strapiPut, strapiDelete } from '../lib/strapi.js';
import { changedFields, relationId, relationIds } from '../lib/sync-diff.js';

interface StrapiCategoryCode {
  id: number;
  documentId: string;
  code: string;
  category?: {
    id: number;
    documentId: string;
  } | null;
}

interface StrapiTournament {
  id: number;
  documentId: string;
  code: string;
  season: number;
}

interface StrapiStanding {
  id: number;
  documentId: string;
  competitionCode: string;
  season: number;
  position: number;
  matchesPlayed: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  points: number | null;
  team?: { documentId: string } | null;
  tournament?: { documentId: string } | null;
  categories?: { documentId: string }[] | null;
}

/** A stored standing row reduced to the shape of the payload the sync writes. */
function storedSyncFields(standing: StrapiStanding): Record<string, unknown> {
  return {
    position: standing.position,
    team: relationId(standing.team),
    matchesPlayed: standing.matchesPlayed,
    wins: standing.wins,
    draws: standing.draws,
    losses: standing.losses,
    goalsFor: standing.goalsFor,
    goalsAgainst: standing.goalsAgainst,
    points: standing.points,
    competitionCode: standing.competitionCode,
    season: standing.season,
    categories: relationIds(standing.categories),
    tournament: relationId(standing.tournament),
  };
}

interface StrapiTeam {
  id: number;
  documentId: string;
  name: string;
}

async function main() {
  const fromFile = process.argv.includes('--from-file');

  let scraped: FacrStanding[];
  if (fromFile) {
    const filePath = path.join(__dirname, '../../data/standings.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    scraped = JSON.parse(raw);
    console.log(`Loaded ${scraped.length} competition standings from file`);
  } else {
    const email = process.env.FACR_EMAIL;
    const password = process.env.FACR_PASSWORD;

    if (!email || !password) {
      console.error('Missing FACR_EMAIL or FACR_PASSWORD environment variables');
      process.exit(1);
    }

    // 1. Scrape standings from FAČR for every club subject
    //    (current season unless --season given)
    const seasonYear = parseSeasonArg(process.argv);
    scraped = [];
    const seenUuids = new Set<string>();
    for (const club of FACR_CLUBS) {
      const clubStandings = await scrapeStandings(email, password, seasonYear, club);
      for (const standing of clubStandings) {
        if (standing.facrUuid && seenUuids.has(standing.facrUuid)) continue;
        if (standing.facrUuid) seenUuids.add(standing.facrUuid);
        scraped.push(standing);
      }
    }

    // Save to file so production deployments use fresh data
    const dataFilePath = path.join(__dirname, '../../data/standings.json');
    fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
    fs.writeFileSync(dataFilePath, JSON.stringify(scraped, null, 2));
    console.log(`Saved standings to ${dataFilePath}`);
  }

  // FAČR names our club differently per competition — unify to the canonical name
  scraped = scraped.map((standing) => ({
    ...standing,
    rows: standing.rows.map((row) => ({
      ...row,
      teamName: normalizeClubTeamName(row.teamName),
    })),
  }));

  // 2. Load category-code mappings from Strapi
  const categoryCodesRes = await strapiGet<StrapiCategoryCode>(
    '/category-codes',
    {
      populate: ['category'],
      pagination: { pageSize: 100 },
    },
  );
  const codeToCategory = new Map<string, string>();
  for (const cc of categoryCodesRes.data) {
    if (cc.category?.documentId) {
      codeToCategory.set(cc.code, cc.category.documentId);
    }
  }

  // 3. Load existing tournaments for linking
  const tournamentByCodeSeason = new Map<string, string>();
  let tPage = 1;
  let tTotalPages = 1;
  while (tPage <= tTotalPages) {
    const res = await strapiGet<StrapiTournament>(
      '/tournaments',
      {
        fields: ['code', 'season'],
        filters: { code: { $notNull: true } },
        pagination: { pageSize: 100, page: tPage },
      },
    );
    for (const t of res.data) {
      if (t.code) {
        tournamentByCodeSeason.set(`${t.code}:${t.season}`, t.documentId);
      }
    }
    tTotalPages = res.meta?.pagination?.pageCount ?? 1;
    tPage++;
  }
  console.log(`Loaded ${tournamentByCodeSeason.size} tournaments`);

  // 4. Upsert teams: collect unique names, load existing, create missing
  const allTeamNames = new Set<string>();
  for (const standing of scraped) {
    for (const row of standing.rows) {
      allTeamNames.add(row.teamName);
    }
  }

  const teamLookup = new Map<string, string>(); // name -> documentId
  let teamPage = 1;
  let teamTotalPages = 1;
  while (teamPage <= teamTotalPages) {
    const res = await strapiGet<StrapiTeam>(
      '/teams',
      {
        fields: ['name'],
        pagination: { pageSize: 100, page: teamPage },
      },
    );
    for (const t of res.data) {
      teamLookup.set(t.name, t.documentId);
    }
    teamTotalPages = res.meta?.pagination?.pageCount ?? 1;
    teamPage++;
  }
  console.log(`Loaded ${teamLookup.size} existing teams`);

  let teamsCreated = 0;
  for (const name of allTeamNames) {
    if (!teamLookup.has(name)) {
      const res = await strapiPost<{ data: StrapiTeam }>('/teams', { data: { name } });
      teamLookup.set(name, res.data.documentId);
      teamsCreated++;
    }
  }
  if (teamsCreated > 0) {
    console.log(`Created ${teamsCreated} new teams`);
  }

  // 5. Load existing standings from Strapi for the upsert and cleanup
  const existingStandings = new Map<string, string>(); // "code:season:position" -> documentId
  // Same key -> stored values of the fields the sync writes, to skip no-op PUTs
  const storedStandings = new Map<string, Record<string, unknown>>();
  let sPage = 1;
  let sTotalPages = 1;
  while (sPage <= sTotalPages) {
    const res = await strapiGet<StrapiStanding>(
      '/standings',
      {
        fields: [
          'competitionCode', 'season', 'position', 'matchesPlayed',
          'wins', 'draws', 'losses', 'goalsFor', 'goalsAgainst', 'points',
        ],
        populate: {
          team: { fields: ['documentId'] },
          tournament: { fields: ['documentId'] },
          categories: { fields: ['documentId'] },
        },
        pagination: { pageSize: 100, page: sPage },
      },
    );
    for (const s of res.data) {
      const key = `${s.competitionCode}:${s.season}:${s.position}`;
      existingStandings.set(key, s.documentId);
      storedStandings.set(key, storedSyncFields(s));
    }
    sTotalPages = res.meta?.pagination?.pageCount ?? 1;
    sPage++;
  }
  console.log(`Loaded ${existingStandings.size} existing standings`);

  // 6. Upsert standings
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const updatedPerCompetition = new Map<string, number>(); // "code season" -> rows
  const processedKeys = new Set<string>();

  for (const standing of scraped) {
    const categoryDocumentId = codeToCategory.get(standing.competitionCode);
    const tournamentDocumentId = tournamentByCodeSeason.get(
      `${standing.competitionCode}:${standing.season}`,
    );

    for (const row of standing.rows) {
      const key = `${standing.competitionCode}:${standing.season}:${row.position}`;
      processedKeys.add(key);

      const teamDocumentId = teamLookup.get(row.teamName);

      const data: Record<string, unknown> = {
        position: row.position,
        team: teamDocumentId,
        matchesPlayed: row.matchesPlayed,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        points: row.points,
        competitionCode: standing.competitionCode,
        season: standing.season,
      };

      const relationFields = {
        ...(categoryDocumentId ? { categories: [categoryDocumentId] } : {}),
        ...(tournamentDocumentId ? { tournament: tournamentDocumentId } : {}),
      };

      // PUT only when a field differs — Strapi bumps updatedAt (and fires the
      // cache-clear webhook) even on an identical write.
      const existingDocId = existingStandings.get(key);
      if (existingDocId) {
        const payload = { ...data, ...relationFields };
        if (changedFields(storedStandings.get(key) ?? {}, payload).length === 0) {
          unchanged++;
          continue;
        }
        await strapiPut(`/standings/${existingDocId}`, { data: payload });
        const competition = `${standing.competitionCode} ${standing.season}`;
        updatedPerCompetition.set(competition, (updatedPerCompetition.get(competition) ?? 0) + 1);
        updated++;
      } else {
        await strapiPost('/standings', {
          data: { ...data, ...relationFields },
        });
        created++;
      }
    }
  }

  // 7. Delete stale standings (positions that no longer exist), but only
  //    within competitions+seasons covered by this scrape — standings of
  //    other seasons must survive so past-season tables stay on the web.
  const scrapedCompSeasons = new Set(
    scraped.map((s) => `${s.competitionCode}:${s.season}`),
  );
  let deleted = 0;
  for (const [key, docId] of existingStandings) {
    const compSeason = key.substring(0, key.lastIndexOf(':'));
    if (scrapedCompSeasons.has(compSeason) && !processedKeys.has(key)) {
      await strapiDelete(`/standings/${docId}`);
      deleted++;
    }
  }

  console.log(`\nSync complete:`);
  console.log(`  Competitions with standings: ${scraped.length}`);
  console.log(`  Created:  ${created}`);
  console.log(`  Updated:  ${updated}`);
  for (const [competition, rows] of updatedPerCompetition) {
    console.log(`    ${competition}: ${rows} rows`);
  }
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Deleted:  ${deleted}`);
  console.log(`  Teams:    ${teamLookup.size} (${teamsCreated} new)`);

}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
