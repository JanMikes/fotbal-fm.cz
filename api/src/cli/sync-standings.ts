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
 *
 * Environment variables:
 *   FACR_EMAIL    - FAČR IS login email (not needed with --from-file)
 *   FACR_PASSWORD - FAČR IS login password (not needed with --from-file)
 *   STRAPI_URL    - Strapi URL (default: http://localhost:1337)
 *   STRAPI_API_TOKEN - Strapi API token
 */

import * as fs from 'fs';
import * as path from 'path';
import { scrapeStandings, type FacrStanding } from '../lib/facr.js';
import { strapiGet, strapiPost, strapiPut, strapiDelete } from '../lib/strapi.js';

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

    // 1. Scrape standings from FAČR
    scraped = await scrapeStandings(email, password);
  }

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

  // 5. Load existing standings from Strapi for cleanup
  const existingStandings = new Map<string, string>(); // "code:season:position" -> documentId
  let sPage = 1;
  let sTotalPages = 1;
  while (sPage <= sTotalPages) {
    const res = await strapiGet<StrapiStanding>(
      '/standings',
      {
        fields: ['competitionCode', 'season', 'position'],
        pagination: { pageSize: 100, page: sPage },
      },
    );
    for (const s of res.data) {
      const key = `${s.competitionCode}:${s.season}:${s.position}`;
      existingStandings.set(key, s.documentId);
    }
    sTotalPages = res.meta?.pagination?.pageCount ?? 1;
    sPage++;
  }
  console.log(`Loaded ${existingStandings.size} existing standings`);

  // 6. Upsert standings
  let created = 0;
  let updated = 0;
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

      const existingDocId = existingStandings.get(key);
      if (existingDocId) {
        await strapiPut(`/standings/${existingDocId}`, {
          data: { ...data, ...relationFields },
        });
        updated++;
      } else {
        await strapiPost('/standings', {
          data: { ...data, ...relationFields },
        });
        created++;
      }
    }
  }

  // 7. Delete stale standings (positions that no longer exist)
  let deleted = 0;
  for (const [key, docId] of existingStandings) {
    if (!processedKeys.has(key)) {
      await strapiDelete(`/standings/${docId}`);
      deleted++;
    }
  }

  console.log(`\nSync complete:`);
  console.log(`  Competitions with standings: ${scraped.length}`);
  console.log(`  Created:  ${created}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Deleted:  ${deleted}`);
  console.log(`  Teams:    ${teamLookup.size} (${teamsCreated} new)`);
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
