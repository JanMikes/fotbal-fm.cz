#!/usr/bin/env tsx
/**
 * CLI: Sync players from FAČR IS to Strapi.
 *
 * Usage:
 *   docker compose exec api npx tsx src/cli/sync-players.ts
 *
 * Environment variables:
 *   FACR_EMAIL    - FAČR IS login email
 *   FACR_PASSWORD - FAČR IS login password
 *   STRAPI_URL    - Strapi URL (default: http://localhost:1337)
 *   STRAPI_API_TOKEN - Strapi API token
 */

import { scrapePlayers, type FacrPlayer } from '../lib/facr.js';
import { strapiGet, strapiPost, strapiPut } from '../lib/strapi.js';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '';

interface StrapiPlayer {
  id: number;
  documentId: string;
  name: string;
  facrId: string | null;
  photo: { id: number } | null;
}

/**
 * Download a photo from FAČR and upload it to Strapi media library.
 * Returns the Strapi media ID.
 */
async function uploadPhotoToStrapi(photoUrl: string, playerName: string): Promise<number | null> {
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) {
      console.warn(`  Failed to download photo for ${playerName}: ${res.status}`);
      return null;
    }

    const buffer = await res.arrayBuffer();
    const blob = new Blob([buffer], { type: 'image/jpeg' });

    // Sanitize filename
    const safeName = playerName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase();

    const formData = new FormData();
    formData.append('files', blob, `${safeName}.jpg`);

    const headers: Record<string, string> = {};
    if (STRAPI_API_TOKEN) {
      headers['Authorization'] = `Bearer ${STRAPI_API_TOKEN}`;
    }

    const uploadRes = await fetch(`${STRAPI_URL}/api/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.warn(`  Failed to upload photo for ${playerName}: ${err}`);
      return null;
    }

    const uploaded = await uploadRes.json() as Array<{ id: number }>;
    return uploaded[0]?.id ?? null;
  } catch (err) {
    console.warn(`  Photo error for ${playerName}: ${err}`);
    return null;
  }
}

async function main() {
  const email = process.env.FACR_EMAIL;
  const password = process.env.FACR_PASSWORD;

  if (!email || !password) {
    console.error('Missing FACR_EMAIL or FACR_PASSWORD environment variables');
    process.exit(1);
  }

  // 1. Scrape players from FAČR
  const scraped = await scrapePlayers(email, password);

  // 2. Load existing players from Strapi
  const existingRes = await strapiGet<StrapiPlayer>(
    '/players',
    {
      fields: ['name', 'facrId'],
      populate: ['photo'],
      pagination: { pageSize: 100 },
    },
  );

  // Also fetch page 2+ if needed
  const allExisting: StrapiPlayer[] = [...existingRes.data];
  const totalPages = existingRes.meta?.pagination?.pageCount ?? 1;
  for (let page = 2; page <= totalPages; page++) {
    const pageRes = await strapiGet<StrapiPlayer>(
      '/players',
      {
        fields: ['name', 'facrId'],
        populate: ['photo'],
        pagination: { pageSize: 100, page },
      },
    );
    allExisting.push(...pageRes.data);
  }

  const existingByFacrId = new Map<string, StrapiPlayer>();
  for (const player of allExisting) {
    if (player.facrId) {
      existingByFacrId.set(player.facrId, player);
    }
  }

  console.log(`\nStrapi: ${allExisting.length} existing players (${existingByFacrId.size} with facrId)`);

  // 3. Upsert players
  let created = 0;
  let updated = 0;
  let photosUploaded = 0;

  for (const player of scraped) {
    const existing = existingByFacrId.get(player.facrId);

    // Upload photo if available and not already set
    let photoId: number | null = null;
    if (player.photoUrl && (!existing || !existing.photo)) {
      photoId = await uploadPhotoToStrapi(player.photoUrl, player.name);
      if (photoId) photosUploaded++;
    }

    const payload = {
      data: {
        name: player.name,
        facrId: player.facrId,
        facrUuid: player.facrUuid,
        dateOfBirth: player.dateOfBirth || null,
        nationality: player.nationality || null,
        isActive: player.isActive,
        ...(photoId ? { photo: photoId } : {}),
      },
    };

    if (existing) {
      await strapiPut(`/players/${existing.documentId}`, payload);
      updated++;
    } else {
      await strapiPost('/players', {
        data: {
          ...payload.data,
          type: 'hráč',
        },
      });
      created++;
    }
  }

  console.log(`\nSync complete:`);
  console.log(`  Scraped:  ${scraped.length}`);
  console.log(`  Created:  ${created}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Photos:   ${photosUploaded}`);
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
