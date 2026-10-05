#!/usr/bin/env tsx
/**
 * CLI: Sync players from SportBM to Strapi (upsert).
 *
 * - Players with matching sportbmId are updated — only when a field differs
 * - New players are created
 * - Players without sportbmId (manually added) are left untouched
 * - Re-running after adding sportbmCategoryId to categories will correctly pair players
 *
 * Production runs it live from the lily host cron (nightly). --from-file reads
 * a local scrape (scrape-sportbm.ts) and is meant for offline development.
 *
 * Usage:
 *   docker compose exec api npx tsx src/cli/sync-sportbm-players.ts
 *   docker compose exec api npx tsx src/cli/sync-sportbm-players.ts --dry-run
 *   docker compose exec api npx tsx src/cli/sync-sportbm-players.ts --from-file
 *
 * --dry-run reads SportBM and Strapi and prints every change it would make
 * (with old -> new values), but writes nothing: no players, no photos, no
 * cache flush.
 *
 * Exits non-zero when any player failed to sync, so the cron job is flagged.
 *
 * Environment variables:
 *   SPORTBM_EMAIL    - SportBM login email (not needed with --from-file)
 *   SPORTBM_PASSWORD - SportBM login password (not needed with --from-file)
 *   STRAPI_URL       - Strapi URL (default: http://localhost:1337)
 *   STRAPI_API_TOKEN - Strapi API token
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  sportbmLogin,
  fetchGroups,
  fetchGroupParticipants,
  fetchPlayerProfile,
  toShirtNumber,
  type SportbmPlayer,
} from '../lib/sportbm.js';
import { strapiGet, strapiPost, strapiPut } from '../lib/strapi.js';
import { changedFields, relationIds } from '../lib/sync-diff.js';
import { detectImageType } from '../lib/media.js';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '';

interface StrapiCategory {
  id: number;
  documentId: string;
  name: string;
  sportbmCategoryId: string | null;
}

interface StrapiExistingPlayer {
  id: number;
  documentId: string;
  name: string;
  sportbmId: string | null;
  dateOfBirth: string | null;
  number: number | null;
  photo: { id: number } | null;
  categories?: { documentId: string }[] | null;
}

/** Player data from scrape-sportbm.ts JSON */
interface FilePlayer {
  sportbmId: string;
  name: string;
  dateOfBirth: string | null;
  number: number | string | null;
  photoFilename: string | null;
  groupIds: number[];
}

/** One player as SportBM has it, ready to be written to Strapi. */
interface SyncEntry {
  sportbmId: string;
  name: string;
  dateOfBirth: string | null;
  number: number | null;
  categoryDocumentIds: string[];
  /** Loads the photo bytes; null when SportBM has no photo for the player. */
  loadPhoto: (() => Promise<Buffer | null>) | null;
}

interface CategoryMapping {
  /** sportbmCategoryId -> category documentId */
  bySportbmId: Map<string, string>;
  /** category documentId -> name, for readable dry-run output */
  names: Map<string, string>;
}

/**
 * Upload a photo to the Strapi media library. Rejects anything that is not
 * an image (an expired session or a redirect yields an HTML page).
 */
async function uploadPhotoBuffer(buffer: Buffer, playerName: string): Promise<number | null> {
  try {
    const kind = detectImageType(buffer);
    if (!kind) {
      console.warn(`  Skipped photo for ${playerName}: not an image (${buffer.length} bytes)`);
      return null;
    }

    const blob = new Blob([buffer], { type: kind.mime });

    const safeName = playerName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
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

/** Download a photo from SportBM. */
function photoFromUrl(photoUrl: string, playerName: string): () => Promise<Buffer | null> {
  return async () => {
    try {
      const res = await fetch(photoUrl);
      if (!res.ok) {
        console.warn(`  Failed to download photo for ${playerName}: ${res.status}`);
        return null;
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      console.warn(`  Photo error for ${playerName}: ${err}`);
      return null;
    }
  };
}

/** Read a photo saved by scrape-sportbm.ts. */
function photoFromFile(photoFilename: string, playerName: string): () => Promise<Buffer | null> {
  return async () => {
    const filePath = path.join(__dirname, '../../data/photos', photoFilename);
    if (!fs.existsSync(filePath)) {
      console.warn(`  Photo file not found for ${playerName}: ${filePath}`);
      return null;
    }
    return fs.readFileSync(filePath);
  };
}

/**
 * Load all existing players with sportbmId from Strapi.
 */
async function loadExistingPlayers(): Promise<Map<string, StrapiExistingPlayer>> {
  const bySportbmId = new Map<string, StrapiExistingPlayer>();
  let page = 1;

  while (true) {
    const res = await strapiGet<StrapiExistingPlayer>(
      '/players',
      {
        fields: ['name', 'sportbmId', 'dateOfBirth', 'number'],
        populate: {
          photo: { fields: ['id'] },
          categories: { fields: ['documentId'] },
        },
        pagination: { pageSize: 100, page },
      },
    );

    for (const player of res.data) {
      if (player.sportbmId) {
        bySportbmId.set(player.sportbmId, player);
      }
    }

    const totalPages = res.meta?.pagination?.pageCount ?? 1;
    if (page >= totalPages) break;
    page++;
  }

  return bySportbmId;
}

/**
 * Load Strapi categories and build sportbmCategoryId -> documentId mapping.
 */
async function loadCategoryMapping(): Promise<CategoryMapping> {
  const bySportbmId = new Map<string, string>();
  const names = new Map<string, string>();
  let page = 1;

  while (true) {
    const res = await strapiGet<StrapiCategory>(
      '/categories',
      {
        fields: ['name', 'sportbmCategoryId'],
        pagination: { pageSize: 100, page },
      },
    );

    for (const cat of res.data) {
      names.set(cat.documentId, cat.name);
      if (cat.sportbmCategoryId) {
        bySportbmId.set(cat.sportbmCategoryId, cat.documentId);
      }
    }

    const totalPages = res.meta?.pagination?.pageCount ?? 1;
    if (page >= totalPages) break;
    page++;
  }

  return { bySportbmId, names };
}

/** Entries from a scrape-sportbm.ts JSON file. */
function entriesFromFile(mapping: CategoryMapping): SyncEntry[] {
  const filePath = path.join(__dirname, '../../data/sportbm-players.json');
  const filePlayers: FilePlayer[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`\nLoaded ${filePlayers.length} players from file`);

  const entries: SyncEntry[] = [];
  for (const fp of filePlayers) {
    const categoryDocumentIds = fp.groupIds
      .map((groupId) => mapping.bySportbmId.get(String(groupId)))
      .filter((id): id is string => !!id);

    if (categoryDocumentIds.length === 0) {
      console.log(`  Skipping "${fp.name}" (sportbmId: ${fp.sportbmId}) - no matching Strapi categories for groups: ${fp.groupIds.join(', ')}`);
      continue;
    }

    entries.push({
      sportbmId: fp.sportbmId,
      name: fp.name,
      dateOfBirth: fp.dateOfBirth,
      number: toShirtNumber(fp.number),
      categoryDocumentIds,
      loadPhoto: fp.photoFilename ? photoFromFile(fp.photoFilename, fp.name) : null,
    });
  }
  return entries;
}

/** Entries scraped live from SportBM. */
async function entriesFromSportbm(mapping: CategoryMapping): Promise<SyncEntry[]> {
  const email = process.env.SPORTBM_EMAIL;
  const password = process.env.SPORTBM_PASSWORD;

  if (!email || !password) {
    console.error('Missing SPORTBM_EMAIL or SPORTBM_PASSWORD environment variables');
    process.exit(1);
  }

  console.log('\nLogging in to SportBM...');
  const cookies = await sportbmLogin(email, password);
  console.log('Login successful.');

  console.log('\nFetching groups...');
  const groups = await fetchGroups(cookies);
  console.log(`Found ${groups.length} groups:`);
  for (const g of groups) {
    console.log(`  - ${g.name} (id: ${g.id}, ${g.participants_count} participants)`);
  }

  // Collect all players across groups (deduplicate by user_role.id)
  console.log('\nCollecting players from all groups...');
  const players = new Map<number, { profile: SportbmPlayer; categoryDocumentIds: string[] }>();

  for (const group of groups) {
    const categoryDocId = mapping.bySportbmId.get(String(group.id));
    if (!categoryDocId) {
      console.log(`  Skipping group "${group.name}" (id: ${group.id}) - no matching Strapi category`);
      continue;
    }

    console.log(`  Fetching participants for "${group.name}"...`);
    const participants = await fetchGroupParticipants(group.id, cookies);
    console.log(`    Found ${participants.length} participants`);

    for (const p of participants) {
      const playerId = p.user_role.id;
      const existing = players.get(playerId);

      if (existing) {
        if (!existing.categoryDocumentIds.includes(categoryDocId)) {
          existing.categoryDocumentIds.push(categoryDocId);
        }
      } else {
        const profile = await fetchPlayerProfile(playerId, cookies);
        players.set(playerId, { profile, categoryDocumentIds: [categoryDocId] });
      }
    }
  }

  console.log(`\nTotal unique players from SportBM: ${players.size}`);

  return [...players].map(([sportbmId, { profile, categoryDocumentIds }]) => {
    const name = `${profile.user.first_name} ${profile.user.last_name}`;
    return {
      sportbmId: String(sportbmId),
      name,
      dateOfBirth: profile.user.birth_date || null,
      number: toShirtNumber(profile.number),
      categoryDocumentIds,
      loadPhoto: profile.photo ? photoFromUrl(profile.photo, name) : null,
    };
  });
}

async function main() {
  const fromFile = process.argv.includes('--from-file');
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('DRY RUN: nothing will be written to Strapi');
  }

  // 1. Load category mapping from Strapi (needed for both modes)
  console.log('Loading category mapping from Strapi...');
  const mapping = await loadCategoryMapping();
  console.log(`Found ${mapping.bySportbmId.size} categories with sportbmCategoryId:`);
  for (const [sportbmId, docId] of mapping.bySportbmId) {
    console.log(`  - SportBM ${sportbmId} -> Strapi ${docId} (${mapping.names.get(docId) ?? '?'})`);
  }

  // 2. Load existing players from Strapi for upsert
  console.log('\nLoading existing players from Strapi...');
  const existingPlayers = await loadExistingPlayers();
  console.log(`Found ${existingPlayers.size} existing players with sportbmId.`);

  // 3. Collect what SportBM has
  const entries = fromFile ? entriesFromFile(mapping) : await entriesFromSportbm(mapping);

  // 4. Upsert — PUT only players whose fields differ (Strapi bumps updatedAt
  //    and fires the cache-clear webhook even on an identical write)
  console.log(`\nSyncing ${entries.length} players to Strapi...`);
  const categoryNames = (ids: unknown) => (Array.isArray(ids) ? ids : [])
    .map((id) => mapping.names.get(String(id)) ?? String(id)).sort().join(', ');
  const show = (field: string, value: unknown) => (field === 'categories'
    ? `[${categoryNames(value)}]`
    : JSON.stringify(value ?? null));

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let photosUploaded = 0;

  for (const entry of entries) {
    const existing = existingPlayers.get(entry.sportbmId);
    const data: Record<string, unknown> = {
      name: entry.name,
      sportbmId: entry.sportbmId,
      dateOfBirth: entry.dateOfBirth,
      number: entry.number,
      categories: entry.categoryDocumentIds,
    };
    const stored: Record<string, unknown> = existing
      ? {
        name: existing.name,
        sportbmId: existing.sportbmId,
        dateOfBirth: existing.dateOfBirth,
        number: existing.number,
        categories: relationIds(existing.categories),
      }
      : {};
    // A photo is only ever added, never replaced
    const wantsPhoto = entry.loadPhoto !== null && !existing?.photo;

    if (dryRun) {
      if (!existing) {
        console.log(`  Would create: ${entry.name} (sportbmId: ${entry.sportbmId}) [${categoryNames(entry.categoryDocumentIds)}]`
          + `${wantsPhoto ? ' + photo' : ''}`);
        created++;
        continue;
      }
      const changes = changedFields(stored, data);
      if (changes.length === 0 && !wantsPhoto) {
        unchanged++;
        continue;
      }
      const details = changes.map((f) => `${f}: ${show(f, stored[f])} -> ${show(f, data[f])}`);
      if (wantsPhoto) details.push('photo: none -> try SportBM photo');
      console.log(`  Would update: ${entry.name} (sportbmId: ${entry.sportbmId}): ${details.join('; ')}`);
      updated++;
      continue;
    }

    try {
      if (wantsPhoto) {
        const buffer = await entry.loadPhoto!();
        const photoId = buffer ? await uploadPhotoBuffer(buffer, entry.name) : null;
        if (photoId) {
          data.photo = photoId;
          photosUploaded++;
        }
      }

      if (existing) {
        // A photo that failed to load is not a change, so the player is not
        // rewritten every night for a photo SportBM cannot deliver.
        const changes = changedFields({ ...stored, photo: null }, data);
        if (changes.length === 0) {
          unchanged++;
          continue;
        }
        await strapiPut(`/players/${existing.documentId}`, { data });
        updated++;
        console.log(`  Updated: ${entry.name} (sportbmId: ${entry.sportbmId}): ${changes.join(', ')}`);
      } else {
        await strapiPost('/players', { data: { ...data, type: 'hráč' } });
        created++;
        console.log(`  Created: ${entry.name} (sportbmId: ${entry.sportbmId})`);
      }
    } catch (err) {
      failed++;
      console.error(`  Failed to sync ${entry.name}: ${err}`);
    }
  }

  console.log(`\n${dryRun ? 'Dry run' : 'Sync'} complete:`);
  console.log(`  Players:         ${entries.length}`);
  console.log(`  ${dryRun ? 'Would create:   ' : 'Created:        '} ${created}`);
  console.log(`  ${dryRun ? 'Would update:   ' : 'Updated:        '} ${updated}`);
  console.log(`  Unchanged:       ${unchanged}`);
  if (!dryRun) {
    console.log(`  Photos uploaded: ${photosUploaded}`);
    console.log(`  Failed:          ${failed}`);
  }

  if (dryRun) return;

  if (failed > 0) {
    console.error(`${failed} player(s) failed to sync`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
