#!/usr/bin/env tsx
/**
 * CLI: Sync players from SportBM to Strapi (upsert).
 *
 * - Players with matching sportbmId are updated
 * - New players are created
 * - Players without sportbmId (manually added) are left untouched
 * - Re-running after adding sportbmCategoryId to categories will correctly pair players
 *
 * Usage:
 *   docker compose exec api npx tsx src/cli/sync-sportbm-players.ts
 *   docker compose exec api npx tsx src/cli/sync-sportbm-players.ts --from-file
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
  type SportbmPlayer,
} from '../lib/sportbm.js';
import { strapiGet, strapiPost, strapiPut } from '../lib/strapi.js';
import { flushWebCache } from '../lib/cache-flush.js';

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
  photo: { id: number } | null;
}

interface PlayerData {
  profile: SportbmPlayer;
  categoryDocumentIds: string[];
}

/** Player data from scrape-sportbm.ts JSON */
interface FilePlayer {
  sportbmId: string;
  name: string;
  dateOfBirth: string | null;
  number: number | null;
  photoFilename: string | null;
  groupIds: number[];
}

/** Adapted PlayerData for file-based sync */
interface FilePlayerData {
  filePlayer: FilePlayer;
  categoryDocumentIds: string[];
}

/**
 * Upload a photo buffer to Strapi media library.
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

/**
 * Download a photo from SportBM and upload it to Strapi media library.
 */
async function uploadPhotoFromUrl(photoUrl: string, playerName: string): Promise<number | null> {
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) {
      console.warn(`  Failed to download photo for ${playerName}: ${res.status}`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    return uploadPhotoBuffer(buffer, playerName);
  } catch (err) {
    console.warn(`  Photo error for ${playerName}: ${err}`);
    return null;
  }
}

/**
 * Upload a local photo file to Strapi media library.
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
 * Load all existing players with sportbmId from Strapi.
 */
async function loadExistingPlayers(): Promise<Map<string, StrapiExistingPlayer>> {
  const bySporbmId = new Map<string, StrapiExistingPlayer>();
  let page = 1;

  while (true) {
    const res = await strapiGet<StrapiExistingPlayer>(
      '/players',
      {
        fields: ['name', 'sportbmId'],
        populate: ['photo'],
        pagination: { pageSize: 100, page },
      },
    );

    for (const player of res.data) {
      if (player.sportbmId) {
        bySporbmId.set(player.sportbmId, player);
      }
    }

    const totalPages = res.meta?.pagination?.pageCount ?? 1;
    if (page >= totalPages) break;
    page++;
  }

  return bySporbmId;
}

/**
 * Load Strapi categories and build sportbmCategoryId -> documentId mapping.
 */
async function loadCategoryMapping(): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
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
      if (cat.sportbmCategoryId) {
        mapping.set(cat.sportbmCategoryId, cat.documentId);
      }
    }

    const totalPages = res.meta?.pagination?.pageCount ?? 1;
    if (page >= totalPages) break;
    page++;
  }

  return mapping;
}

async function main() {
  const fromFile = process.argv.includes('--from-file');

  // 1. Load category mapping from Strapi (needed for both modes)
  console.log('Loading category mapping from Strapi...');
  const categoryMapping = await loadCategoryMapping();
  console.log(`Found ${categoryMapping.size} categories with sportbmCategoryId:`);
  for (const [sportbmId, docId] of categoryMapping) {
    console.log(`  - SportBM ${sportbmId} -> Strapi ${docId}`);
  }

  // 2. Load existing players from Strapi for upsert
  console.log('\nLoading existing players from Strapi...');
  const existingPlayers = await loadExistingPlayers();
  console.log(`Found ${existingPlayers.size} existing players with sportbmId.`);

  let created = 0;
  let updated = 0;
  let photosUploaded = 0;

  if (fromFile) {
    // --- FROM FILE MODE ---
    const filePath = path.join(__dirname, '../../data/sportbm-players.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const filePlayers: FilePlayer[] = JSON.parse(raw);
    console.log(`\nLoaded ${filePlayers.length} players from file`);

    // Build player data with category mapping
    const filePlayerDataList: FilePlayerData[] = [];
    for (const fp of filePlayers) {
      const categoryDocumentIds: string[] = [];
      for (const groupId of fp.groupIds) {
        const docId = categoryMapping.get(String(groupId));
        if (docId) {
          categoryDocumentIds.push(docId);
        }
      }

      if (categoryDocumentIds.length === 0) {
        console.log(`  Skipping "${fp.name}" (sportbmId: ${fp.sportbmId}) - no matching Strapi categories for groups: ${fp.groupIds.join(', ')}`);
        continue;
      }

      filePlayerDataList.push({ filePlayer: fp, categoryDocumentIds });
    }

    console.log(`\nSyncing ${filePlayerDataList.length} players to Strapi...`);

    for (const { filePlayer, categoryDocumentIds } of filePlayerDataList) {
      const existing = existingPlayers.get(filePlayer.sportbmId);

      // Upload photo if available and not already set
      let photoId: number | null = null;
      if (filePlayer.photoFilename && (!existing || !existing.photo)) {
        photoId = await uploadPhotoFromFile(filePlayer.photoFilename, filePlayer.name);
        if (photoId) photosUploaded++;
      }

      const playerData: Record<string, unknown> = {
        name: filePlayer.name,
        sportbmId: filePlayer.sportbmId,
        dateOfBirth: filePlayer.dateOfBirth,
        number: filePlayer.number,
        categories: categoryDocumentIds,
      };

      if (photoId) {
        playerData.photo = photoId;
      }

      try {
        if (existing) {
          await strapiPut(`/players/${existing.documentId}`, { data: playerData });
          updated++;
          console.log(`  Updated: ${filePlayer.name} (sportbmId: ${filePlayer.sportbmId})`);
        } else {
          await strapiPost('/players', { data: { ...playerData, type: 'hráč' } });
          created++;
          console.log(`  Created: ${filePlayer.name} (sportbmId: ${filePlayer.sportbmId})`);
        }
      } catch (err) {
        console.error(`  Failed to sync ${filePlayer.name}: ${err}`);
      }
    }

    console.log(`\nSync complete:`);
    console.log(`  Players in file: ${filePlayers.length}`);
    console.log(`  Synced:          ${filePlayerDataList.length}`);
    console.log(`  Created:         ${created}`);
    console.log(`  Updated:         ${updated}`);
    console.log(`  Photos uploaded: ${photosUploaded}`);
  } else {
    // --- LIVE MODE ---
    const email = process.env.SPORTBM_EMAIL;
    const password = process.env.SPORTBM_PASSWORD;

    if (!email || !password) {
      console.error('Missing SPORTBM_EMAIL or SPORTBM_PASSWORD environment variables');
      process.exit(1);
    }

    // Login to SportBM
    console.log('\nLogging in to SportBM...');
    const cookies = await sportbmLogin(email, password);
    console.log('Login successful.');

    // Fetch all groups
    console.log('\nFetching groups...');
    const groups = await fetchGroups(cookies);
    console.log(`Found ${groups.length} groups:`);
    for (const g of groups) {
      console.log(`  - ${g.name} (id: ${g.id}, ${g.participants_count} participants)`);
    }

    // Collect all players across groups (deduplicate by user_role.id)
    console.log('\nCollecting players from all groups...');
    const playerMap = new Map<number, PlayerData>();

    for (const group of groups) {
      const categoryDocId = categoryMapping.get(String(group.id));
      if (!categoryDocId) {
        console.log(`  Skipping group "${group.name}" (id: ${group.id}) - no matching Strapi category`);
        continue;
      }

      console.log(`  Fetching participants for "${group.name}"...`);
      const participants = await fetchGroupParticipants(group.id, cookies);
      console.log(`    Found ${participants.length} participants`);

      for (const p of participants) {
        const playerId = p.user_role.id;
        const existing = playerMap.get(playerId);

        if (existing) {
          if (!existing.categoryDocumentIds.includes(categoryDocId)) {
            existing.categoryDocumentIds.push(categoryDocId);
          }
        } else {
          const profile = await fetchPlayerProfile(playerId, cookies);
          playerMap.set(playerId, {
            profile,
            categoryDocumentIds: [categoryDocId],
          });
        }
      }
    }

    console.log(`\nTotal unique players from SportBM: ${playerMap.size}`);

    // Upsert players in Strapi
    console.log('\nSyncing players to Strapi...');

    for (const [sportbmId, { profile, categoryDocumentIds }] of playerMap) {
      const name = `${profile.user.first_name} ${profile.user.last_name}`;
      const existing = existingPlayers.get(String(sportbmId));

      // Upload photo if available and not already set
      let photoId: number | null = null;
      const photoUrl = profile.photo;
      if (photoUrl && (!existing || !existing.photo)) {
        photoId = await uploadPhotoFromUrl(photoUrl, name);
        if (photoId) photosUploaded++;
      }

      const playerData: Record<string, unknown> = {
        name,
        sportbmId: String(sportbmId),
        dateOfBirth: profile.user.birth_date || null,
        number: profile.number || null,
        categories: categoryDocumentIds,
      };

      if (photoId) {
        playerData.photo = photoId;
      }

      try {
        if (existing) {
          await strapiPut(`/players/${existing.documentId}`, { data: playerData });
          updated++;
          console.log(`  Updated: ${name} (sportbmId: ${sportbmId})`);
        } else {
          await strapiPost('/players', { data: { ...playerData, type: 'hráč' } });
          created++;
          console.log(`  Created: ${name} (sportbmId: ${sportbmId})`);
        }
      } catch (err) {
        console.error(`  Failed to sync ${name}: ${err}`);
      }
    }

    console.log(`\nSync complete:`);
    console.log(`  Groups:          ${groups.length}`);
    console.log(`  Unique players:  ${playerMap.size}`);
    console.log(`  Created:         ${created}`);
    console.log(`  Updated:         ${updated}`);
    console.log(`  Photos uploaded: ${photosUploaded}`);
  }


  await flushWebCache();
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
