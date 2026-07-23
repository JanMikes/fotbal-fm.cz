#!/usr/bin/env tsx
/**
 * CLI: Sync players from FAČR IS to Strapi.
 *
 * Usage:
 *   docker compose exec api npx tsx src/cli/sync-players.ts
 *   docker compose exec api npx tsx src/cli/sync-players.ts --from-file
 *
 * Environment variables:
 *   FACR_EMAIL    - FAČR IS login email (not needed with --from-file)
 *   FACR_PASSWORD - FAČR IS login password (not needed with --from-file)
 *   STRAPI_URL    - Strapi URL (default: http://localhost:1337)
 *   STRAPI_API_TOKEN - Strapi API token
 */

import * as fs from 'fs';
import * as path from 'path';
import { scrapePlayers, FACR_CLUBS, type FacrPlayer } from '../lib/facr.js';
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

/** Player data from scrape-facr.ts JSON (includes photoFilename instead of photoUrl) */
interface FilePlayer extends FacrPlayer {
  photoFilename: string | null;
}

/**
 * Download a photo from FAČR and upload it to Strapi media library.
 * Returns the Strapi media ID.
 */
async function uploadPhotoFromUrl(photoUrl: string, playerName: string): Promise<number | null> {
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) {
      console.warn(`  Failed to download photo for ${playerName}: ${res.status}`);
      return null;
    }

    const buffer = await res.arrayBuffer();
    return uploadPhotoBuffer(Buffer.from(buffer), playerName);
  } catch (err) {
    console.warn(`  Photo error for ${playerName}: ${err}`);
    return null;
  }
}

/**
 * Upload a local photo file to Strapi media library.
 * Returns the Strapi media ID.
 */
async function uploadPhotoFromFile(photoFilename: string, playerName: string): Promise<number | null> {
  try {
    const filePath = path.join(__dirname, '../../data/photos', photoFilename);
    if (!fs.existsSync(filePath)) {
      console.warn(`  Photo file not found for ${playerName}: ${filePath}`);
      return null;
    }
    const buffer = fs.readFileSync(filePath);
    return uploadPhotoBuffer(buffer, playerName);
  } catch (err) {
    console.warn(`  Photo error for ${playerName}: ${err}`);
    return null;
  }
}

/**
 * Upload a photo buffer to Strapi media library.
 * Returns the Strapi media ID.
 */
async function uploadPhotoBuffer(buffer: Buffer, playerName: string): Promise<number | null> {
  try {
    const blob = new Blob([buffer], { type: 'image/jpeg' });

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
    console.warn(`  Photo upload error for ${playerName}: ${err}`);
    return null;
  }
}

async function main() {
  const fromFile = process.argv.includes('--from-file');

  let scraped: FacrPlayer[];
  let filePlayers: FilePlayer[] | null = null;
  if (fromFile) {
    const filePath = path.join(__dirname, '../../data/players.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    filePlayers = JSON.parse(raw);
    scraped = filePlayers!;
    console.log(`Loaded ${scraped.length} players from file`);
  } else {
    const email = process.env.FACR_EMAIL;
    const password = process.env.FACR_PASSWORD;

    if (!email || !password) {
      console.error('Missing FACR_EMAIL or FACR_PASSWORD environment variables');
      process.exit(1);
    }

    // 1. Scrape players from FAČR
    // Scrape players from every club subject (Muži A/B are registered
    // under FK Frýdek-Místek 1921 a.s., the rest under z.s.)
    scraped = [];
    const seenFacrIds = new Set<string>();
    for (const club of FACR_CLUBS) {
      const clubPlayers = await scrapePlayers(email, password, club);
      for (const player of clubPlayers) {
        if (seenFacrIds.has(player.facrId)) continue;
        seenFacrIds.add(player.facrId);
        scraped.push(player);
      }
    }

    // Save to file so production deployments use fresh data
    const dataFilePath = path.join(__dirname, '../../data/players.json');
    fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });
    fs.writeFileSync(dataFilePath, JSON.stringify(scraped, null, 2));
    console.log(`Saved players to ${dataFilePath}`);
  }

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
    if (!existing || !existing.photo) {
      const filePlayer = filePlayers
        ? filePlayers.find((fp) => fp.facrId === player.facrId)
        : null;

      if (filePlayer?.photoFilename) {
        photoId = await uploadPhotoFromFile(filePlayer.photoFilename, player.name);
      } else if (!fromFile && player.photoUrl) {
        // Only fetch from FAČR URL when scraping live (not from file),
        // as production can't reach is.fotbal.cz
        photoId = await uploadPhotoFromUrl(player.photoUrl, player.name);
      }
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
