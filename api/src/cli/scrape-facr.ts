#!/usr/bin/env tsx
/**
 * CLI: Scrape all FAČR data locally and save to api/data/ as JSON + photos.
 *
 * Run this on a machine where FAČR IS is reachable, then commit the data
 * and use sync scripts with --from-file on production.
 *
 * Usage:
 *   docker compose exec api npx tsx src/cli/scrape-facr.ts
 *
 * Environment variables:
 *   FACR_EMAIL    - FAČR IS login email
 *   FACR_PASSWORD - FAČR IS login password
 *
 * Output:
 *   api/data/tournaments.json
 *   api/data/matches.json
 *   api/data/standings.json
 *   api/data/players.json
 *   api/data/photos/*.jpg
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import {
  scrapeCompetitions,
  scrapeMatchesXlsx,
  scrapeStandings,
  scrapePlayers,
  parseMatchRows,
  type FacrPlayer,
  type XlsxRow,
} from '../lib/facr.js';

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

async function downloadPhoto(player: FacrPlayer): Promise<string | null> {
  if (!player.photoUrl) return null;

  const filename = `${sanitizeFilename(player.name)}.jpg`;
  const filepath = path.join(PHOTOS_DIR, filename);

  try {
    const res = await fetch(player.photoUrl);
    if (!res.ok) {
      console.warn(`  Failed to download photo for ${player.name}: ${res.status}`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
    return filename;
  } catch (err) {
    console.warn(`  Photo download error for ${player.name}: ${err}`);
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

  ensureDirs();

  // 1. Scrape competitions
  console.log('\n=== Scraping tournaments ===');
  const tournaments = await scrapeCompetitions(email, password);
  fs.writeFileSync(
    path.join(DATA_DIR, 'tournaments.json'),
    JSON.stringify(tournaments, null, 2),
  );
  console.log(`Saved ${tournaments.length} tournaments to data/tournaments.json`);

  // 2. Scrape matches (Excel → parsed JSON)
  console.log('\n=== Scraping matches ===');
  const xlsxBuffer = await scrapeMatchesXlsx(email, password);
  const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as XlsxRow[];
  const matches = parseMatchRows(rows);
  fs.writeFileSync(
    path.join(DATA_DIR, 'matches.json'),
    JSON.stringify(matches, null, 2),
  );
  console.log(`Saved ${matches.length} matches to data/matches.json`);

  // 3. Scrape standings
  console.log('\n=== Scraping standings ===');
  const standings = await scrapeStandings(email, password);
  fs.writeFileSync(
    path.join(DATA_DIR, 'standings.json'),
    JSON.stringify(standings, null, 2),
  );
  console.log(`Saved ${standings.length} competition standings to data/standings.json`);

  // 4. Scrape players + download photos
  console.log('\n=== Scraping players ===');
  const players = await scrapePlayers(email, password);

  // Download photos
  console.log(`\nDownloading photos for ${players.length} players...`);
  const playersWithPhotos = [];
  let photosDownloaded = 0;

  for (const player of players) {
    const photoFilename = await downloadPhoto(player);
    if (photoFilename) photosDownloaded++;

    playersWithPhotos.push({
      ...player,
      photoFilename: photoFilename,
    });
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'players.json'),
    JSON.stringify(playersWithPhotos, null, 2),
  );
  console.log(`Saved ${playersWithPhotos.length} players to data/players.json`);
  console.log(`Downloaded ${photosDownloaded} photos to data/photos/`);

  // Summary
  console.log('\n=== Scrape complete ===');
  console.log(`  Tournaments: ${tournaments.length}`);
  console.log(`  Matches:     ${matches.length}`);
  console.log(`  Standings:   ${standings.length} competitions`);
  console.log(`  Players:     ${playersWithPhotos.length}`);
  console.log(`  Photos:      ${photosDownloaded}`);
  console.log(`\nData saved to: ${DATA_DIR}`);
}

main().catch((err) => {
  console.error('Scrape failed:', err.message);
  process.exit(1);
});
