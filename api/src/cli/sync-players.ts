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
import { flushWebCache } from '../lib/cache-flush.js';

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
async function uploadPhotoFromUrl(photoUrl: string, playerName: string, cookie: string): Promise<number | null> {
  try {
    // The FAČR session cookie is required: without it get-foto.aspx redirects
    // to the public homepage and we would upload an HTML page as the photo.
    const res = await fetch(photoUrl, { headers: { Cookie: cookie } });
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
 * Detect the image type from magic bytes. Returns null for anything that is
 * not an image we recognise.
 */
function detectImageType(buffer: Buffer): { mime: string; ext: string } | null {
  const hex = buffer.subarray(0, 4).toString('hex');
  if (hex.startsWith('ffd8ff')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (hex === '89504e47') return { mime: 'image/png', ext: 'png' };
  if (hex.startsWith('474946')) return { mime: 'image/gif', ext: 'gif' };
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

/**
 * Upload a photo buffer to Strapi media library.
 * Returns the Strapi media ID.
 */
async function uploadPhotoBuffer(buffer: Buffer, playerName: string): Promise<number | null> {
  try {
    // Sniff the real type: FA\u010cR serves PNGs labelled image/jpeg, and a session
    // that has expired yields an HTML page \u2014 neither should land in the media
    // library as "<name>.jpg".
    const kind = detectImageType(buffer);
    if (!kind) {
      console.warn(`  Skipped photo for ${playerName}: not an image (${buffer.length} bytes)`);
      return null;
    }

    const blob = new Blob([buffer], { type: kind.mime });

    const safeName = playerName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase();

    const formData = new FormData();
    formData.append('files', blob, `${safeName}.${kind.ext}`);

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
  // Session cookie from the last scrape, needed to download photos.
  let facrCookie = '';
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
      const { players: clubPlayers, cookie } = await scrapePlayers(email, password, club);
      facrCookie = cookie;
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
        photoId = await uploadPhotoFromUrl(player.photoUrl, player.name, facrCookie);
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

  await flushWebCache();
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
