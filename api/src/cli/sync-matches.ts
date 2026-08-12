#!/usr/bin/env tsx
/**
 * CLI: Sync matches from FAČR IS (Excel export) to Strapi.
 *
 * Important: Run sync-tournaments.ts first so tournaments exist for linking.
 *
 * Usage:
 *   docker compose exec -T api npx tsx src/cli/sync-matches.ts
 *   docker compose exec -T api npx tsx src/cli/sync-matches.ts --from-file
 *   docker compose exec -T api npx tsx src/cli/sync-matches.ts --season 2025
 *   docker compose exec -T api npx tsx src/cli/sync-matches.ts --no-prune
 *
 * Matches FAČR no longer lists are deleted (see step 8); --no-prune keeps them.
 *
 * Environment variables:
 *   FACR_EMAIL    - FAČR IS login email (not needed with --from-file)
 *   FACR_PASSWORD - FAČR IS login password (not needed with --from-file)
 *   STRAPI_URL    - Strapi URL (default: http://localhost:1337)
 *   STRAPI_API_TOKEN - Strapi API token
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { scrapeMatchesXlsx, parseMatchRows, FACR_CLUBS, type FacrMatch, type XlsxRow } from '../lib/facr.js';
import { normalizeClubTeamName } from '../lib/team-name.js';
import { parseSeasonArg } from '../lib/cli-args.js';
import { strapiGet, strapiPost, strapiPut, strapiDelete } from '../lib/strapi.js';
import { flushWebCache } from '../lib/cache-flush.js';

interface StrapiCategoryCode {
  id: number;
  documentId: string;
  code: string;
  category?: {
    id: number;
    documentId: string;
  } | null;
}

interface StrapiMatch {
  id: number;
  documentId: string;
  facrId: string | null;
}

/** Fields loaded alongside a match so the prune pass can judge it. */
interface ExistingMatchExtras {
  season?: number | null;
  matchDate?: string | null;
  competitionName?: string | null;
  competitionCode?: string | null;
  homeGoalscorers?: string | null;
  awayGoalscorers?: string | null;
  matchReport?: string | null;
  lineup?: string | null;
  imagesUrl?: string | null;
  homeTeam?: { documentId: string; name?: string } | null;
  awayTeam?: { documentId: string; name?: string } | null;
  images?: unknown[] | null;
  files?: unknown[] | null;
}

interface PruneCandidate {
  documentId: string;
  season: number | null;
  hasUserContent: boolean;
  label: string;
}

/**
 * True when someone has put their own work into this match — a report, a
 * lineup, goalscorers, photos. Those are never deleted by the prune, even if
 * FAČR has dropped the fixture; they are reported for a human to decide on.
 */
function hasUserContent(match: ExistingMatchExtras): boolean {
  const text = [
    match.homeGoalscorers, match.awayGoalscorers,
    match.matchReport, match.lineup, match.imagesUrl,
  ];
  if (text.some((value) => typeof value === 'string' && value.trim() !== '')) {
    return true;
  }
  return (match.images?.length ?? 0) > 0 || (match.files?.length ?? 0) > 0;
}

interface StrapiTournament {
  id: number;
  documentId: string;
  code: string;
  season: number | null;
}

interface StrapiTeam {
  id: number;
  documentId: string;
  name: string;
}

async function main() {
  const fromFile = process.argv.includes('--from-file');
  const noPrune = process.argv.includes('--no-prune');

  let parsedMatches: FacrMatch[];
  if (fromFile) {
    const filePath = path.join(__dirname, '../../data/matches.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    parsedMatches = JSON.parse(raw);
    console.log(`Loaded ${parsedMatches.length} matches from file`);
  } else {
    const email = process.env.FACR_EMAIL;
    const password = process.env.FACR_PASSWORD;

    if (!email || !password) {
      console.error('Missing FACR_EMAIL or FACR_PASSWORD environment variables');
      process.exit(1);
    }

    // 1+2. Download and parse Excel from FAČR for every club subject
    //      (current season unless --season given)
    const seasonYear = parseSeasonArg(process.argv);
    parsedMatches = [];
    const seenFacrIds = new Set<string>();
    for (const club of FACR_CLUBS) {
      const xlsxBuffer = await scrapeMatchesXlsx(email, password, seasonYear, club);
      const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as XlsxRow[];
      const clubMatches = parseMatchRows(rows);
      console.log(`Parsed ${clubMatches.length} valid matches for ${club.name} (${rows.length} rows)`);
      for (const match of clubMatches) {
        if (seenFacrIds.has(match.facrId)) continue;
        seenFacrIds.add(match.facrId);
        parsedMatches.push(match);
      }
    }
    console.log(`Parsed ${parsedMatches.length} valid matches total`);

    // Save to file so production deployments use fresh data
    const dataFilePath = path.join(__dirname, '../../data/matches.json');
    fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
    fs.writeFileSync(dataFilePath, JSON.stringify(parsedMatches, null, 2));
    console.log(`Saved matches to ${dataFilePath}`);
  }

  // FAČR names our club differently per competition — unify to the canonical name
  parsedMatches = parsedMatches.map((match) => ({
    ...match,
    homeTeam: normalizeClubTeamName(match.homeTeam),
    awayTeam: normalizeClubTeamName(match.awayTeam),
  }));

  // 3. Load category-code mappings from Strapi
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
  console.log(`Loaded ${categoryCodesRes.data.length} category codes (${codeToCategory.size} with category)`);

  // 4. Load all tournaments to build lookup map: "code:season" -> documentId
  const tournamentLookup = new Map<string, string>();
  let tPage = 1;
  let tTotalPages = 1;
  while (tPage <= tTotalPages) {
    const res = await strapiGet<StrapiTournament>(
      '/tournaments',
      {
        fields: ['code', 'season'],
        filters: { facrId: { $notNull: true } },
        pagination: { pageSize: 100, page: tPage },
      },
    );
    for (const t of res.data) {
      if (t.code && t.season) {
        tournamentLookup.set(`${t.code}:${t.season}`, t.documentId);
      }
    }
    tTotalPages = res.meta?.pagination?.pageCount ?? 1;
    tPage++;
  }
  console.log(`Loaded ${tournamentLookup.size} tournaments for match linking`);

  // 5. Upsert teams: collect unique names, load existing, create missing
  const allTeamNames = new Set<string>();
  for (const match of parsedMatches) {
    allTeamNames.add(match.homeTeam);
    allTeamNames.add(match.awayTeam);
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

  // 6. Load existing matches from Strapi (paginated)
  //    - Matches WITH facrId: for direct upsert by facrId
  //    - Matches WITHOUT facrId: for merging with manually-created matches (by teams + date)

  const existingByFacrId = new Map<string, string>();
  // Composite key: "homeTeamDocId:awayTeamDocId:matchDate" -> documentId
  const existingByCompositeKey = new Map<string, string>();
  // FAČR-sourced rows, for the prune pass in step 8.
  const pruneCandidates = new Map<string, PruneCandidate>();
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await strapiGet<StrapiMatch & ExistingMatchExtras>(
      '/matches',
      {
        fields: [
          'facrId', 'matchDate', 'season', 'competitionName', 'competitionCode',
          'homeGoalscorers', 'awayGoalscorers', 'matchReport', 'lineup', 'imagesUrl',
        ],
        populate: {
          homeTeam: { fields: ['documentId', 'name'] },
          awayTeam: { fields: ['documentId', 'name'] },
          images: { fields: ['id'] },
          files: { fields: ['id'] },
        },
        pagination: { pageSize: 100, page },
      },
    );
    for (const mr of res.data) {
      if (mr.facrId) {
        existingByFacrId.set(mr.facrId, mr.documentId);
        pruneCandidates.set(mr.facrId, {
          documentId: mr.documentId,
          season: mr.season ?? null,
          hasUserContent: hasUserContent(mr),
          label: `${mr.matchDate ?? '????-??-??'} ${mr.homeTeam?.name ?? '?'} vs ${mr.awayTeam?.name ?? '?'}`
            + ` [${mr.competitionCode ?? '???'}] ${mr.facrId}`,
        });
      } else if (mr.homeTeam?.documentId && mr.awayTeam?.documentId && mr.matchDate) {
        // Only index manually-created matches (no facrId) for composite key fallback
        const key = `${mr.homeTeam.documentId}:${mr.awayTeam.documentId}:${mr.matchDate}`;
        existingByCompositeKey.set(key, mr.documentId);
      }
    }
    totalPages = res.meta?.pagination?.pageCount ?? 1;
    page++;
  }
  console.log(`Loaded ${existingByFacrId.size} existing matches with facrId, ${existingByCompositeKey.size} manual matches for merge`);

  // 7. Upsert matches
  let created = 0;
  let updated = 0;
  let merged = 0;
  const withoutCategory: string[] = [];
  let linkedToTournament = 0;

  for (const match of parsedMatches) {
    const categoryDocumentId = codeToCategory.get(match.competitionCode);
    if (match.competitionCode && !categoryDocumentId) {
      withoutCategory.push(match.competitionCode);
    }

    // Look up tournament by code + season
    const tournamentKey = match.competitionCode && match.season
      ? `${match.competitionCode}:${match.season}` : '';
    const tournamentDocumentId = tournamentKey ? tournamentLookup.get(tournamentKey) : undefined;
    if (tournamentDocumentId) {
      linkedToTournament++;
    }

    const homeTeamDocId = teamLookup.get(match.homeTeam);
    const awayTeamDocId = teamLookup.get(match.awayTeam);

    const scrapedFields: Record<string, unknown> = {
      facrId: match.facrId,
      homeTeam: homeTeamDocId,
      awayTeam: awayTeamDocId,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      matchDate: match.matchDate,
      matchTime: match.matchTime,
      round: match.round,
      venue: match.venue,
      competitionName: match.competitionName,
      competitionCode: match.competitionCode,
      season: match.season,
      period: match.period,
      organizingBody: match.organizingBody,
    };

    if (tournamentDocumentId) {
      scrapedFields.tournament = tournamentDocumentId;
    }

    const relationFields = {
      ...(categoryDocumentId ? { categories: [categoryDocumentId] } : {}),
    };

    // 1. Check if match exists by facrId (direct match)
    const existingDocId = existingByFacrId.get(match.facrId);
    if (existingDocId) {
      await strapiPut(`/matches/${existingDocId}`, {
        data: { ...scrapedFields, ...relationFields },
      });
      updated++;
    } else {
      // 2. Check if a manually-created match exists (same teams + date)
      //    Merge with it: set facrId and scraped metadata, but preserve
      //    user-entered fields (goalscorers, lineup, matchReport)
      const compositeKey = homeTeamDocId && awayTeamDocId && match.matchDate
        ? `${homeTeamDocId}:${awayTeamDocId}:${match.matchDate}` : '';
      const manualDocId = compositeKey ? existingByCompositeKey.get(compositeKey) : undefined;

      if (manualDocId) {
        // Merge: only update scraped fields, preserve user-entered data
        await strapiPut(`/matches/${manualDocId}`, {
          data: { ...scrapedFields, ...relationFields },
        });
        // Move to facrId lookup to prevent future composite key lookups
        existingByFacrId.set(match.facrId, manualDocId);
        existingByCompositeKey.delete(compositeKey);
        merged++;
      } else {
        await strapiPost('/matches', {
          data: { ...scrapedFields, ...relationFields },
        });
        created++;
      }
    }
  }

  // 8. Prune matches FAČR no longer lists.
  //    Scoped to rows that came from FAČR (facrId set) in the seasons this run
  //    actually scraped — never manual matches. Scoping by competition code
  //    instead would miss the case this exists for: FAČR withdrew the whole G1F
  //    competition in Aug 2026 and its 44 fixtures stayed on the public site.
  //    The export covers every club subject from the season start, so a
  //    FAČR-sourced row for a scraped season that is absent from it is stale.
  let deleted = 0;
  const keptWithContent: string[] = [];
  if (fromFile) {
    console.log('\nSkipping prune: --from-file data can be an out-of-date snapshot');
  } else if (parsedMatches.length === 0) {
    console.log('\nSkipping prune: scrape returned no matches');
  } else if (noPrune) {
    console.log('\nSkipping prune: --no-prune');
  } else {
    const scrapedSeasons = new Set(
      parsedMatches.map((m) => m.season).filter((s): s is number => s !== null),
    );
    const scrapedFacrIds = new Set(parsedMatches.map((m) => m.facrId));

    for (const [facrId, candidate] of pruneCandidates) {
      if (scrapedFacrIds.has(facrId)) continue;
      if (candidate.season === null || !scrapedSeasons.has(candidate.season)) continue;
      if (candidate.hasUserContent) {
        keptWithContent.push(candidate.label);
        continue;
      }
      await strapiDelete(`/matches/${candidate.documentId}`);
      console.log(`  Pruned ${candidate.label}`);
      deleted++;
    }
  }

  const uniqueWithout = [...new Set(withoutCategory)];

  console.log(`\nSync complete:`);
  console.log(`  Total:    ${parsedMatches.length}`);
  console.log(`  Created:  ${created}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Merged:   ${merged} (linked manual matches to FAČR data)`);
  console.log(`  Deleted:  ${deleted} (no longer listed by FAČR)`);
  if (keptWithContent.length > 0) {
    console.log(`  Kept ${keptWithContent.length} dropped by FAČR but holding your own content — review by hand:`);
    for (const label of keptWithContent) {
      console.log(`    ${label}`);
    }
  }
  console.log(`  Teams:    ${teamLookup.size} (${teamsCreated} new)`);
  console.log(`  Linked to tournament: ${linkedToTournament}`);
  console.log(`  Matched:  ${parsedMatches.length - uniqueWithout.length} with category`);
  if (uniqueWithout.length > 0) {
    console.log(`  Missing category mapping for codes: ${uniqueWithout.join(', ')}`);
  }

  await flushWebCache();
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
