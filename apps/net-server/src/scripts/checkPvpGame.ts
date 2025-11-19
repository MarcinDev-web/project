/**
 * Diagnostic script to check if PVP game is properly set up
 */

import { MarketplaceStorageDB } from '../storage/MarketplaceStorageDB.js';
import { MarketplaceStorage } from '../storage/MarketplaceStorage.js';
import { StudioProjectsStorageDB, StudioProjectsStorage } from '../storage/StudioProjectsStorage.js';
import { createDbPool } from '../lib/db.js';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const PVP_AUTHOR_ID = 'mock_user_pvp';

async function checkPvpGame() {
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

    await marketplaceStorage.initialize();
    await studioStorage.initialize();

    console.log('\n=== Checking PVP Game Setup ===\n');

    // Check marketplace items
    const pvpMarketplaceItems = await marketplaceStorage.getItems({
      tags: ['pvp'],
      type: 'build',
      public: true,
    });

    console.log(`Marketplace items with PVP tag: ${pvpMarketplaceItems.length}`);
    for (const item of pvpMarketplaceItems) {
      console.log(`  - ${item.id}: "${item.title}" (public: ${item.public}, downloads: ${item.downloads}, likes: ${item.likes})`);
    }

    // Check published projects
    const publishedProjects = await studioStorage.listPublishedProjectsGlobal();
    console.log(`\nTotal published projects: ${publishedProjects.length}`);

    const pvpProjects = publishedProjects.filter((p) => 
      p.tags?.includes('pvp') || p.name.toLowerCase().includes('pvp')
    );
    console.log(`Published projects with PVP tag: ${pvpProjects.length}`);

    for (const project of pvpProjects) {
      const marketplaceId = project.projectData?.metadata?.marketplaceItemId;
      console.log(`  - ${project.id}: "${project.name}"`);
      console.log(`    Published: ${project.isPublished}`);
      console.log(`    Tags: ${project.tags?.join(', ') || 'none'}`);
      console.log(`    Marketplace Item ID: ${marketplaceId || 'MISSING'}`);
      console.log(`    User ID: ${project.userId}`);
    }

    // Check projects by author
    const authorProjects = await studioStorage.listProjects(PVP_AUTHOR_ID);
    console.log(`\nProjects by ${PVP_AUTHOR_ID}: ${authorProjects.length}`);
    for (const project of authorProjects) {
      const marketplaceId = project.projectData?.metadata?.marketplaceItemId;
      console.log(`  - ${project.id}: "${project.name}"`);
      console.log(`    Published: ${project.isPublished}`);
      console.log(`    Marketplace Item ID: ${marketplaceId || 'MISSING'}`);
    }

    // Check if marketplace items match projects
    console.log('\n=== Matching Check ===');
    for (const project of publishedProjects) {
      const marketplaceId = project.projectData?.metadata?.marketplaceItemId;
      if (marketplaceId) {
        const marketplaceItem = await marketplaceStorage.getItem(marketplaceId);
        if (marketplaceItem) {
          console.log(`✓ Project ${project.id} linked to marketplace item ${marketplaceId}`);
        } else {
          console.log(`✗ Project ${project.id} has marketplaceItemId ${marketplaceId} but item not found!`);
        }
      } else {
        console.log(`✗ Project ${project.id} has no marketplaceItemId`);
      }
    }

    console.log('\n=== Summary ===');
    if (pvpMarketplaceItems.length === 0) {
      console.log('❌ No PVP marketplace items found');
    } else {
      console.log(`✓ Found ${pvpMarketplaceItems.length} PVP marketplace item(s)`);
    }

    if (pvpProjects.length === 0) {
      console.log('❌ No published PVP projects found');
    } else {
      console.log(`✓ Found ${pvpProjects.length} published PVP project(s)`);
    }

    const projectsWithLink = pvpProjects.filter(p => p.projectData?.metadata?.marketplaceItemId);
    if (projectsWithLink.length === 0) {
      console.log('❌ No PVP projects linked to marketplace items');
    } else {
      console.log(`✓ Found ${projectsWithLink.length} PVP project(s) linked to marketplace`);
    }

  } catch (error) {
    console.error('Error checking PVP game:', error);
    throw error;
  } finally {
    if (dbPool) {
      await dbPool.$disconnect();
    }
  }
}

void checkPvpGame()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

