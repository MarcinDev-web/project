/**
 * Script to regenerate all marketplace item thumbnails (removes tags from thumbnails)
 */

import { MarketplaceStorageDB } from '../storage/MarketplaceStorageDB.js';
import { generateAndSaveThumbnail } from '../utils/thumbnailGenerator.js';
import { createDbPool } from '../lib/db.js';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const THUMBNAIL_DIR = path.join(DATA_DIR, 'thumbnails');

async function regenerateAllThumbnails() {
  console.log('Starting thumbnail regeneration...');
  
  const dbPool = createDbPool();
  const marketplaceStorage = new MarketplaceStorageDB(dbPool);
  
  try {
    // Get all marketplace items
    const allItems = await marketplaceStorage.getItems({});
    console.log(`Found ${allItems.length} items to regenerate`);
    
    let regenerated = 0;
    let failed = 0;
    
    for (const item of allItems) {
      try {
        await generateAndSaveThumbnail(
          THUMBNAIL_DIR,
          item.id,
          item.title,
          item.tags || [],
          item.type
        );
        const thumbnailUrl = `/api/marketplace/thumbnails/${item.id}`;
        await marketplaceStorage.updateItem(item.id, { thumbnailUrl });
        regenerated++;
        console.log(`  ✓ ${item.title} (${item.id})`);
      } catch (error) {
        console.warn(`  ✗ ${item.title} (${item.id}): ${error instanceof Error ? error.message : String(error)}`);
        failed++;
      }
    }
    
    console.log('\nRegeneration complete!');
    console.log(`  Regenerated: ${regenerated}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Total: ${allItems.length}`);
  } catch (error) {
    console.error('Error regenerating thumbnails:', error);
    process.exit(1);
  } finally {
    await dbPool.end();
  }
}

// Run if executed directly
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '')) {
  regenerateAllThumbnails().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

