#!/usr/bin/env tsx
/**
 * CLI: Sync competitions from FAČR IS to Strapi as tournaments.
 *
 * Usage:
 *   docker compose exec api npx tsx src/cli/sync-tournaments.ts
 *   docker compose exec api npx tsx src/cli/sync-tournaments.ts --from-file
 *   docker compose exec api npx tsx src/cli/sync-tournaments.ts --season 2025
 *
 * Environment variables:
 *   FACR_EMAIL    - FAČR IS login email (not needed with --from-file)
 *   FACR_PASSWORD - FAČR IS login password (not needed with --from-file)
 *   STRAPI_URL    - Strapi URL (default: http://localhost:1337)
 *   STRAPI_API_TOKEN - Strapi API token
 */

import * as fs from 'fs';
import * as path from 'path';
import { scrapeCompetitions, FACR_CLUBS, type FacrCompetition } from '../lib/facr.js';
import { parseSeasonArg } from '../lib/cli-args.js';
import { strapiGet, strapiPost, strapiPut } from '../lib/strapi.js';
import { changedFields, relationIds } from '../lib/sync-diff.js';

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
  facrId: string;
  facrUuid: string | null;
  name: string | null;
  code: string;
  categoryLetter: string | null;
  level: number | null;
  group: string | null;
  competitionType: string | null;
  organizingBody: string | null;
  season: number | null;
  categories?: { documentId: string }[] | null;
}

/** A stored tournament reduced to the shape of the payload the sync writes. */
function storedSyncFields(tournament: StrapiTournament): Record<string, unknown> {
  return {
    facrId: tournament.facrId,
    facrUuid: tournament.facrUuid,
    name: tournament.name,
    code: tournament.code,
    categoryLetter: tournament.categoryLetter,
    level: tournament.level,
    group: tournament.group,
    competitionType: tournament.competitionType,
    organizingBody: tournament.organizingBody,
    season: tournament.season,
    categories: relationIds(tournament.categories),
  };
}

/** Fields that should never be overwritten by the scraper on update */
const ADMIN_ONLY_FIELDS = [
  'description', 'photos', 'players', 'dateFrom', 'dateTo',
  'location', 'imagesUrl', 'author', 'modifiedBy',
];

async function main() {
  const fromFile = process.argv.includes('--from-file');

  let scraped: FacrCompetition[];
  if (fromFile) {
    const filePath = path.join(__dirname, '../../data/tournaments.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    scraped = JSON.parse(raw);
    console.log(`Loaded ${scraped.length} tournaments from file`);
  } else {
    const email = process.env.FACR_EMAIL;
    const password = process.env.FACR_PASSWORD;

    if (!email || !password) {
      console.error('Missing FACR_EMAIL or FACR_PASSWORD environment variables');
      process.exit(1);
    }

    // 1. Scrape competitions from FAČR for every club subject
    //    (current season unless --season given)
    const seasonYear = parseSeasonArg(process.argv);
    scraped = [];
    const seenFacrIds = new Set<string>();
    for (const club of FACR_CLUBS) {
      const clubCompetitions = await scrapeCompetitions(email, password, seasonYear, club);
      for (const comp of clubCompetitions) {
        if (comp.facrId && seenFacrIds.has(comp.facrId)) continue;
        if (comp.facrId) seenFacrIds.add(comp.facrId);
        scraped.push(comp);
      }
    }

    // Save to file so production deployments use fresh data
    const dataFilePath = path.join(__dirname, '../../data/tournaments.json');
    fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
    fs.writeFileSync(dataFilePath, JSON.stringify(scraped, null, 2));
    console.log(`Saved tournaments to ${dataFilePath}`);
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

  // 3. Load existing tournaments with facrId from Strapi for upsert
  const existingByFacrId = new Map<string, string>();
  // facrId -> stored values of the fields the sync writes, to skip no-op PUTs
  const storedByFacrId = new Map<string, Record<string, unknown>>();
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await strapiGet<StrapiTournament>(
      '/tournaments',
      {
        fields: [
          'facrId', 'facrUuid', 'name', 'code', 'categoryLetter', 'level',
          'group', 'competitionType', 'organizingBody', 'season',
        ],
        populate: { categories: { fields: ['documentId'] } },
        filters: { facrId: { $notNull: true } },
        pagination: { pageSize: 100, page },
      },
    );
    for (const t of res.data) {
      if (t.facrId) {
        existingByFacrId.set(t.facrId, t.documentId);
        storedByFacrId.set(t.facrId, storedSyncFields(t));
      }
    }
    totalPages = res.meta?.pagination?.pageCount ?? 1;
    page++;
  }
  console.log(`Loaded ${existingByFacrId.size} existing tournaments with facrId`);

  // 4. Upsert tournaments
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const withoutCategory: string[] = [];

  for (const comp of scraped) {
    const categoryDocumentId = codeToCategory.get(comp.code);
    if (!categoryDocumentId) {
      withoutCategory.push(comp.code);
    }

    const scrapedFields = {
      facrId: comp.facrId,
      facrUuid: comp.facrUuid,
      name: comp.name,
      code: comp.code,
      categoryLetter: comp.categoryLetter,
      level: comp.level,
      group: comp.group,
      competitionType: comp.type,
      organizingBody: comp.organizingBody,
      season: comp.season,
    };

    const relationFields = {
      ...(categoryDocumentId ? { categories: [categoryDocumentId] } : {}),
    };

    const existingDocId = existingByFacrId.get(comp.facrId);
    if (existingDocId) {
      // Update: scraped fields + re-link category (never overwrite admin fields).
      // PUT only when a field differs — Strapi bumps updatedAt even on an
      // identical write.
      const data = { ...scrapedFields, ...relationFields };
      const changes = changedFields(storedByFacrId.get(comp.facrId) ?? {}, data);
      if (changes.length === 0) {
        unchanged++;
        continue;
      }
      await strapiPut(`/tournaments/${existingDocId}`, { data });
      console.log(`  Updated ${comp.name} [${comp.code} ${comp.season}]: ${changes.join(', ')}`);
      updated++;
    } else {
      await strapiPost('/tournaments', {
        data: { ...scrapedFields, ...relationFields },
      });
      created++;
    }
  }

  const uniqueWithout = [...new Set(withoutCategory)];

  console.log(`\nSync complete:`);
  console.log(`  Total:    ${scraped.length}`);
  console.log(`  Created:  ${created}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Matched:  ${scraped.length - uniqueWithout.length} with category`);
  if (uniqueWithout.length > 0) {
    console.log(`  Missing category mapping for codes: ${uniqueWithout.join(', ')}`);
  }

}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
