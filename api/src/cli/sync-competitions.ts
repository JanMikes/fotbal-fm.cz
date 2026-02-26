#!/usr/bin/env tsx
/**
 * CLI: Sync competitions from FAČR IS to Strapi.
 *
 * Usage:
 *   docker compose exec api npx tsx src/cli/sync-competitions.ts
 *
 * Environment variables:
 *   FACR_EMAIL    - FAČR IS login email
 *   FACR_PASSWORD - FAČR IS login password
 *   STRAPI_URL    - Strapi URL (default: http://localhost:1337)
 *   STRAPI_API_TOKEN - Strapi API token
 */

import { scrapeCompetitions, type FacrCompetition } from '../lib/facr.js';
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

interface StrapiCompetition {
  id: number;
  documentId: string;
  facrId: string;
  code: string;
}

async function main() {
  const email = process.env.FACR_EMAIL;
  const password = process.env.FACR_PASSWORD;

  if (!email || !password) {
    console.error('Missing FACR_EMAIL or FACR_PASSWORD environment variables');
    process.exit(1);
  }

  // 1. Scrape competitions from FAČR
  const scraped = await scrapeCompetitions(email, password);

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

  // 3. Load existing competitions from Strapi for upsert
  const existingRes = await strapiGet<StrapiCompetition>(
    '/competitions',
    {
      fields: ['facrId', 'code'],
      pagination: { pageSize: 100 },
    },
  );
  const existingByFacrId = new Map<string, string>();
  for (const comp of existingRes.data) {
    existingByFacrId.set(comp.facrId, comp.documentId);
  }

  // 4. Upsert competitions
  let created = 0;
  let updated = 0;
  const withoutCategory: string[] = [];

  for (const comp of scraped) {
    const categoryDocumentId = codeToCategory.get(comp.code);
    if (!categoryDocumentId) {
      withoutCategory.push(comp.code);
    }

    const payload = {
      data: {
        facrId: comp.facrId,
        name: comp.name,
        code: comp.code,
        categoryLetter: comp.categoryLetter,
        level: comp.level,
        group: comp.group,
        type: comp.type,
        organizingBody: comp.organizingBody,
        season: comp.season,
        ...(categoryDocumentId ? { category: categoryDocumentId } : {}),
      },
    };

    const existingDocId = existingByFacrId.get(comp.facrId);
    if (existingDocId) {
      await strapiPut(`/competitions/${existingDocId}`, payload);
      updated++;
    } else {
      await strapiPost('/competitions', payload);
      created++;
    }
  }

  const uniqueWithout = [...new Set(withoutCategory)];

  console.log(`\nSync complete:`);
  console.log(`  Total:    ${scraped.length}`);
  console.log(`  Created:  ${created}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Matched:  ${scraped.length - uniqueWithout.length} with category`);
  if (uniqueWithout.length > 0) {
    console.log(`  Missing category mapping for codes: ${uniqueWithout.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
