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
 *
 * Environment variables:
 *   SPORTBM_EMAIL    - SportBM login email
 *   SPORTBM_PASSWORD - SportBM login password
 *   STRAPI_URL       - Strapi URL (default: http://localhost:1337)
 *   STRAPI_API_TOKEN - Strapi API token
 */

import {
  sportbmLogin,
  fetchGroups,
  fetchGroupParticipants,
  fetchPlayerProfile,
  type SportbmPlayer,
} from '../lib/sportbm.js';
import { strapiGet, strapiPost, strapiPut } from '../lib/strapi.js';

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

/**
 * Download a photo from SportBM and upload it to Strapi media library.
 */
async function uploadPhotoToStrapi(photoUrl: string, playerName: string): Promise<number | null> {
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) {
      console.warn(`  Failed to download photo for ${playerName}: ${res.status}`);
      return null;
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const blob = new Blob([buffer], { type: contentType });

    const safeName = playerName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase();

    const formData = new FormData();
    formData.append('files', blob, `${safeName}.${ext}`);

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
  const email = process.env.SPORTBM_EMAIL;
  const password = process.env.SPORTBM_PASSWORD;

  if (!email || !password) {
    console.error('Missing SPORTBM_EMAIL or SPORTBM_PASSWORD environment variables');
    process.exit(1);
  }

  // 1. Login to SportBM
  console.log('Logging in to SportBM...');
  const cookies = await sportbmLogin(email, password);
  console.log('Login successful.');

  // 2. Fetch all groups
  console.log('\nFetching groups...');
  const groups = await fetchGroups(cookies);
  console.log(`Found ${groups.length} groups:`);
  for (const g of groups) {
    console.log(`  - ${g.name} (id: ${g.id}, ${g.participants_count} participants)`);
  }

  // 3. Load category mapping from Strapi
  console.log('\nLoading category mapping from Strapi...');
  const categoryMapping = await loadCategoryMapping();
  console.log(`Found ${categoryMapping.size} categories with sportbmCategoryId:`);
  for (const [sportbmId, docId] of categoryMapping) {
    console.log(`  - SportBM ${sportbmId} -> Strapi ${docId}`);
  }

  // 4. Collect all players across groups (deduplicate by user_role.id)
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

  // 5. Load existing players from Strapi for upsert
  console.log('\nLoading existing players from Strapi...');
  const existingPlayers = await loadExistingPlayers();
  console.log(`Found ${existingPlayers.size} existing players with sportbmId.`);

  // 6. Upsert players in Strapi
  console.log('\nSyncing players to Strapi...');
  let created = 0;
  let updated = 0;
  let photosUploaded = 0;

  for (const [sportbmId, { profile, categoryDocumentIds }] of playerMap) {
    const name = `${profile.user.first_name} ${profile.user.last_name}`;
    const existing = existingPlayers.get(String(sportbmId));

    // Upload photo if available and not already set
    let photoId: number | null = null;
    const photoUrl = profile.user_role.photo;
    if (photoUrl && (!existing || !existing.photo)) {
      photoId = await uploadPhotoToStrapi(photoUrl, name);
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

  // 7. Summary
  console.log(`\nSync complete:`);
  console.log(`  Groups:          ${groups.length}`);
  console.log(`  Unique players:  ${playerMap.size}`);
  console.log(`  Created:         ${created}`);
  console.log(`  Updated:         ${updated}`);
  console.log(`  Photos uploaded: ${photosUploaded}`);
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
