/**
 * Debug script to check why games API returns empty list
 */

import { MarketplaceStorageDB } from '../storage/MarketplaceStorageDB.js';
import { MarketplaceStorage } from '../storage/MarketplaceStorage.js';
import { StudioProjectsStorageDB, StudioProjectsStorage } from '../storage/StudioProjectsStorage.js';
import { GameSessionTracker } from '../websocket/GameSessionTracker.js';
import { createDbPool } from '../lib/db.js';
import path from 'path';

const DATA_DIR = process.env.DATABASE_DIR || path.join(process.cwd(), 'data');

async function debugGamesApi() {
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

    console.log('\n=== Debugging Games API ===\n');

    // Step 1: Get published projects
    const publishedProjects = await studioStorage.listPublishedProjectsGlobal();
    console.log(`1. Published projects: ${publishedProjects.length}`);
    for (const project of publishedProjects) {
      console.log(`   - ${project.id}: "${project.name}" (userId: ${project.userId})`);
      console.log(`     marketplaceItemId: ${project.projectData?.metadata?.marketplaceItemId || 'MISSING'}`);
    }

    // Step 2: Get marketplace builds
    const marketplaceBuilds = await marketplaceStorage.getItems({
      type: 'build',
      public: true,
      limit: 1000,
    });
    console.log(`\n2. Public marketplace builds: ${marketplaceBuilds.length}`);
    for (const item of marketplaceBuilds) {
      console.log(`   - ${item.id}: "${item.title}" (authorId: ${item.authorId}, public: ${item.public})`);
    }

    // Step 3: Check matching
    console.log(`\n3. Matching projects to marketplace items:`);
    const buildsById = new Map<string, typeof marketplaceBuilds[0]>();
    const buildsByAuthor = new Map<string, typeof marketplaceBuilds[]>();

    for (const item of marketplaceBuilds) {
      buildsById.set(item.id, item);
      const list = buildsByAuthor.get(item.authorId) ?? [];
      list.push(item);
      buildsByAuthor.set(item.authorId, list);
    }

    for (const project of publishedProjects) {
      const metadata = project.projectData?.metadata ?? {};
      const marketplaceItemId = metadata.marketplaceItemId;
      
      console.log(`\n   Project: ${project.id} ("${project.name}")`);
      console.log(`   - userId: ${project.userId}`);
      console.log(`   - marketplaceItemId in metadata: ${marketplaceItemId || 'MISSING'}`);
      
      if (marketplaceItemId) {
        const matchById = buildsById.get(marketplaceItemId);
        if (matchById) {
          console.log(`   ✓ Found by ID: ${matchById.id} ("${matchById.title}")`);
        } else {
          console.log(`   ✗ NOT FOUND by ID: ${marketplaceItemId} not in buildsById`);
        }
      }
      
      const candidatesByAuthor = buildsByAuthor.get(project.userId) ?? [];
      console.log(`   - Candidates by author (${project.userId}): ${candidatesByAuthor.length}`);
      for (const candidate of candidatesByAuthor) {
        console.log(`     - ${candidate.id}: "${candidate.title}"`);
        const titleMatch = candidate.title === project.name;
        const descMatch = candidate.description?.includes(project.name);
        console.log(`       title match: ${titleMatch}, desc match: ${descMatch}`);
      }
    }

  } catch (error) {
    console.error('Error debugging games API:', error);
    throw error;
  } finally {
    if (dbPool) {
      await dbPool.$disconnect();
    }
  }
}

void debugGamesApi()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

