/**
 * Test script to check what games API returns
 */

import { MarketplaceStorageDB } from '../storage/MarketplaceStorageDB.js';
import { MarketplaceStorage } from '../storage/MarketplaceStorage.js';
import { StudioProjectsStorageDB, StudioProjectsStorage } from '../storage/StudioProjectsStorage.js';
import { GameSessionTracker } from '../websocket/GameSessionTracker.js';
import { createDbPool } from '../lib/db.js';
import path from 'path';
import { fetchGameSummaries } from '../routes/games.routes.js';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

async function testGamesApi() {
  let dbPool: Awaited<ReturnType<typeof createDbPool>> | null = null;

  try {
    if (process.env.DATABASE_URL) {
      dbPool = await createDbPool();
    }

    const marketplaceStorage = dbPool
      ? new MarketplaceStorageDB(dbPool)
      : new MarketplaceStorage(DATA_DIR);
    const studioStorage = dbPool
      ? new StudioProjectsStorageDB(dbPool)
      : new StudioProjectsStorage(DATA_DIR);
    const gameSessionTracker = new GameSessionTracker();

    await marketplaceStorage.initialize();
    await studioStorage.initialize();

    const dependencies = {
      studioProjectsStorage: studioStorage,
      marketplaceStorage,
      gameSessionTracker,
    };

    console.log('\n=== Testing fetchGameSummaries ===\n');

    const summaries = await fetchGameSummaries(dependencies);

    console.log(`Total games returned: ${summaries.length}\n`);

    for (const summary of summaries) {
      console.log(`- ${summary.id}: "${summary.title}"`);
      console.log(`  Author: ${summary.authorName || summary.authorId}`);
      console.log(`  Tags: ${summary.tags.join(', ')}`);
      console.log(`  Downloads: ${summary.downloads}, Likes: ${summary.likes}`);
      console.log(`  Players Online: ${summary.playersOnline}`);
      console.log('');
    }

    const pvpGames = summaries.filter(s => s.tags.includes('pvp'));
    console.log(`\nPVP games in results: ${pvpGames.length}`);
    if (pvpGames.length > 0) {
      for (const game of pvpGames) {
        console.log(`  - ${game.title} (${game.id})`);
      }
    } else {
      console.log('  ❌ No PVP games found in API results!');
    }

  } catch (error) {
    console.error('Error testing games API:', error);
    throw error;
  } finally {
    if (dbPool) {
      await dbPool.$disconnect();
    }
  }
}

void testGamesApi()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

