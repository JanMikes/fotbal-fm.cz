#!/usr/bin/env tsx
/**
 * CLI: Scrape all SportBM player data locally and save to api/data/ as JSON + photos.
 *
 * Run this on a machine where SportBM is reachable, then commit the data
 * and use sync-sportbm-players.ts --from-file on production.
 *
 * Usage:
 *   docker compose exec api npx tsx src/cli/scrape-sportbm.ts
 *
 * Environment variables:
 *   SPORTBM_EMAIL    - SportBM login email
 *   SPORTBM_PASSWORD - SportBM login password
 *
 * Output:
 *   api/data/sportbm-players.json
 *   api/data/photos/*.jpg
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

const DATA_DIR = path.join(__dirname, '../../data');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase();
}

async function downloadPhoto(photoUrl: string, playerName: string): Promise<string | null> {
  const filename = `${sanitizeFilename(playerName)}.jpg`;
  const filepath = path.join(PHOTOS_DIR, filename);

  try {
    const res = await fetch(photoUrl);
    if (!res.ok) {
      console.warn(`  Failed to download photo for ${playerName}: ${res.status}`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
    return filename;
  } catch (err) {
    console.warn(`  Photo download error for ${playerName}: ${err}`);
    return null;
  }
}

interface ScrapedPlayer {
  sportbmId: string;
  name: string;
  dateOfBirth: string | null;
  number: number | null;
  photoFilename: string | null;
  groupIds: number[];
}

async function main() {
  const email = process.env.SPORTBM_EMAIL;
  const password = process.env.SPORTBM_PASSWORD;

  if (!email || !password) {
    console.error('Missing SPORTBM_EMAIL or SPORTBM_PASSWORD environment variables');
    process.exit(1);
  }

  ensureDirs();

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

  // 3. Collect all players across groups (deduplicate by user_role.id)
  console.log('\nCollecting players from all groups...');
  const playerMap = new Map<number, { profile: SportbmPlayer; groupIds: number[] }>();

  for (const group of groups) {
    console.log(`  Fetching participants for "${group.name}" (id: ${group.id})...`);
    const participants = await fetchGroupParticipants(group.id, cookies);
    console.log(`    Found ${participants.length} participants`);

    for (const p of participants) {
      const playerId = p.user_role.id;
      const existing = playerMap.get(playerId);

      if (existing) {
        if (!existing.groupIds.includes(group.id)) {
          existing.groupIds.push(group.id);
        }
      } else {
        const profile = await fetchPlayerProfile(playerId, cookies);
        playerMap.set(playerId, {
          profile,
          groupIds: [group.id],
        });
      }
    }
  }

  console.log(`\nTotal unique players: ${playerMap.size}`);

  // 4. Download photos and build output
  console.log('\nDownloading photos...');
  const players: ScrapedPlayer[] = [];
  let photosDownloaded = 0;

  for (const [sportbmId, { profile, groupIds }] of playerMap) {
    const name = `${profile.user.first_name} ${profile.user.last_name}`;
    let photoFilename: string | null = null;

    if (profile.photo) {
      photoFilename = await downloadPhoto(profile.photo, name);
      if (photoFilename) photosDownloaded++;
    }

    players.push({
      sportbmId: String(sportbmId),
      name,
      dateOfBirth: profile.user.birth_date || null,
      number: profile.number || null,
      photoFilename,
      groupIds,
    });
  }

  // 5. Save JSON
  fs.writeFileSync(
    path.join(DATA_DIR, 'sportbm-players.json'),
    JSON.stringify(players, null, 2),
  );

  console.log(`\n=== Scrape complete ===`);
  console.log(`  Players: ${players.length}`);
  console.log(`  Photos:  ${photosDownloaded}`);
  console.log(`\nData saved to: ${DATA_DIR}`);
}

main().catch((err) => {
  console.error('Scrape failed:', err.message);
  process.exit(1);
});
