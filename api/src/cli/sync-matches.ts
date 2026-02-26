#!/usr/bin/env tsx
/**
 * CLI: Sync matches from FAČR IS (Excel export) to Strapi.
 *
 * Usage:
 *   docker compose exec -T api npx tsx src/cli/sync-matches.ts
 *
 * Environment variables:
 *   FACR_EMAIL    - FAČR IS login email
 *   FACR_PASSWORD - FAČR IS login password
 *   STRAPI_URL    - Strapi URL (default: http://localhost:1337)
 *   STRAPI_API_TOKEN - Strapi API token
 */

import * as XLSX from 'xlsx';
import { scrapeMatchesXlsx } from '../lib/facr.js';
import { strapiGet, strapiPost, strapiPut } from '../lib/strapi.js';

interface StrapiCategoryCode {
  id: number;
  documentId: string;
  code: string;
  category?: {
    id: number;
    documentId: string;
  } | null;
}

interface StrapiMatchResult {
  id: number;
  documentId: string;
  facrId: string | null;
}

interface XlsxRow {
  Cislo?: string;
  Domaci?: string;
  Hoste?: string;
  Vysledek?: string;
  'Datum a cas'?: string;
  Kolo?: number | string;
  'Hriste/Stadion'?: string;
  Soutez?: string;
  Kod?: string;
  Rocnik?: number | string;
  Obdobi?: string;
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
  if (!match) {
    return [null, null];
  }

  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

/**
 * Parse date+time string like "01.03.2026 12:30" into { matchDate, matchTime }.
 */
function parseDateTime(dateTimeStr: string | undefined): { matchDate: string; matchTime: string } {
  if (!dateTimeStr) {
    return { matchDate: '', matchTime: '' };
  }

  const match = dateTimeStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*(\d{1,2}:\d{2})?/);
  if (!match) {
    return { matchDate: '', matchTime: '' };
  }

  const [, day, month, year, time] = match;
  const matchDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const matchTime = time ?? '';

  return { matchDate, matchTime };
}

async function main() {
  const email = process.env.FACR_EMAIL;
  const password = process.env.FACR_PASSWORD;

  if (!email || !password) {
    console.error('Missing FACR_EMAIL or FACR_PASSWORD environment variables');
    process.exit(1);
  }

  // 1. Download Excel from FAČR
  const xlsxBuffer = await scrapeMatchesXlsx(email, password);

  // 2. Parse Excel
  console.log('\nParsing Excel...');
  const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<XlsxRow>(workbook.Sheets[sheetName]);
  console.log(`Parsed ${rows.length} rows from sheet "${sheetName}"`);

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

  // 4. Load existing match-results with facrId from Strapi (paginated)
  const existingByFacrId = new Map<string, string>();
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await strapiGet<StrapiMatchResult>(
      '/match-results',
      {
        fields: ['facrId'],
        filters: { facrId: { $notNull: true } },
        pagination: { pageSize: 100, page },
      },
    );
    for (const mr of res.data) {
      if (mr.facrId) {
        existingByFacrId.set(mr.facrId, mr.documentId);
      }
    }
    totalPages = res.meta?.pagination?.pageCount ?? 1;
    page++;
  }
  console.log(`Loaded ${existingByFacrId.size} existing match results with facrId`);

  // 5. Upsert matches
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const withoutCategory: string[] = [];

  for (const row of rows) {
    const facrId = row.Cislo?.toString().trim();
    if (!facrId) {
      skipped++;
      continue;
    }

    const [homeScore, awayScore] = parseScore(row.Vysledek);
    const { matchDate, matchTime } = parseDateTime(row['Datum a cas']);

    if (!matchDate) {
      console.warn(`  Skipping ${facrId}: no date`);
      skipped++;
      continue;
    }

    const competitionCode = row.Kod?.toString().trim() ?? '';
    const categoryDocumentId = codeToCategory.get(competitionCode);
    if (competitionCode && !categoryDocumentId) {
      withoutCategory.push(competitionCode);
    }

    const payload = {
      data: {
        facrId,
        homeTeam: row.Domaci?.trim() ?? '',
        awayTeam: row.Hoste?.trim() ?? '',
        homeScore,
        awayScore,
        matchDate,
        matchTime,
        round: row.Kolo ? parseInt(row.Kolo.toString(), 10) || null : null,
        venue: row['Hriste/Stadion']?.trim() ?? '',
        competitionName: row.Soutez?.trim() ?? '',
        competitionCode,
        season: row.Rocnik ? parseInt(row.Rocnik.toString(), 10) || null : null,
        period: row.Obdobi?.trim() ?? '',
        organizingBody: row['Org. jednotka']?.trim() ?? '',
        ...(categoryDocumentId ? { categories: [categoryDocumentId] } : {}),
      },
    };

    const existingDocId = existingByFacrId.get(facrId);
    if (existingDocId) {
      await strapiPut(`/match-results/${existingDocId}`, payload);
      updated++;
    } else {
      await strapiPost('/match-results', payload);
      created++;
    }
  }

  const uniqueWithout = [...new Set(withoutCategory)];

  console.log(`\nSync complete:`);
  console.log(`  Total rows: ${rows.length}`);
  console.log(`  Created:    ${created}`);
  console.log(`  Updated:    ${updated}`);
  console.log(`  Skipped:    ${skipped}`);
  console.log(`  Matched:    ${rows.length - skipped - uniqueWithout.length} with category`);
  if (uniqueWithout.length > 0) {
    console.log(`  Missing category mapping for codes: ${uniqueWithout.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
