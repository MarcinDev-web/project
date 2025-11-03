/**
 * Migration script to migrate marketplace data from JSON to PostgreSQL
 */

import { getPrismaClient, ensureSchema, disconnectPrisma } from '../lib/db';
import { MarketplaceStorage } from '../storage/MarketplaceStorage';
import { MarketplaceStorageDB } from '../storage/MarketplaceStorageDB';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const JSON_FILE = path.join(DATA_DIR, 'marketplace.json');
const BACKUP_FILE = path.join(DATA_DIR, `marketplace.json.backup.${Date.now()}`);

async function migrateMarketplace(): Promise<void> {
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    console.error('Please set DATABASE_URL to your PostgreSQL connection string');
    process.exit(1);
  }

  // Check if JSON file exists
  try {
    await fs.access(JSON_FILE);
  } catch {
    console.log('No marketplace.json file found. Nothing to migrate.');
    process.exit(0);
  }

  console.log('Starting marketplace migration...');
  console.log(`Source: ${JSON_FILE}`);
  console.log(`Database: ${process.env.DATABASE_URL.split('@')[1] || 'connected'}`);

  // Initialize database
  const prisma = await getPrismaClient();
  try {
    await ensureSchema();
    console.log('✓ Database schema ensured');
  } catch (error) {
    console.error('Failed to ensure database schema:', error);
    process.exit(1);
  }

  // Load JSON data
  let jsonStorage: MarketplaceStorage;
  let items: Awaited<ReturnType<MarketplaceStorage['getItems']>>;

  try {
    jsonStorage = new MarketplaceStorage(DATA_DIR);
    await jsonStorage.initialize();
    items = await jsonStorage.getItems({ limit: 10000 }); // Get all items
    console.log(`✓ Loaded ${items.length} items from JSON file`);
  } catch (error) {
    console.error('Failed to load JSON data:', error);
    process.exit(1);
  }

  if (items.length === 0) {
    console.log('No items to migrate.');
    await disconnectPrisma();
    process.exit(0);
  }

  // Backup JSON file
  try {
    await fs.copyFile(JSON_FILE, BACKUP_FILE);
    console.log(`✓ Backup created: ${BACKUP_FILE}`);
  } catch (error) {
    console.error('Failed to create backup:', error);
    process.exit(1);
  }

  // Migrate to database
  const dbStorage = new MarketplaceStorageDB(prisma);
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of items) {
    try {
      // Check if item already exists
      const existing = await dbStorage.getItem(item.id);
      if (existing) {
        console.log(`  ⏭  Skipping ${item.id} (already exists)`);
        skipped++;
        continue;
      }

      // Create item in database
      // We need to reconstruct the item without auto-generated fields
      const { id, createdAt, updatedAt, downloads, likes, ...itemData } = item;
      await dbStorage.createItem({
        ...itemData,
      });

      // If the item had non-zero downloads/likes, update them
      if (downloads > 0 || likes > 0) {
        await dbStorage.updateItem(id, {
          downloads,
          likes,
          // Also set created_at and updated_at to match original
          updatedAt,
        });
      }

      // Update timestamps to match original
      if (createdAt || updatedAt) {
        const updateData: { createdAt?: Date; updatedAt?: Date } = {};
        if (createdAt) {
          updateData.createdAt = new Date(createdAt);
        }
        if (updatedAt) {
          updateData.updatedAt = new Date(updatedAt);
        }
        await prisma.marketplaceItem.update({
          where: { id },
          data: updateData,
        });
      }

      migrated++;
      if (migrated % 10 === 0) {
        console.log(`  → Migrated ${migrated} items...`);
      }
    } catch (error) {
      console.error(`  ✗ Error migrating ${item.id}:`, error);
      errors++;
    }
  }

  // Verify migration
  console.log('\nVerifying migration...');
  const dbItems = await dbStorage.getItems({ limit: 10000 });

  console.log(`\nMigration complete!`);
  console.log(`  ✓ Migrated: ${migrated} items`);
  console.log(`  ⏭  Skipped: ${skipped} items (already exist)`);
  console.log(`  ✗ Errors: ${errors} items`);
  console.log(`  📊 Total in database: ${dbItems.length} items`);
  console.log(`\nBackup saved to: ${BACKUP_FILE}`);

  if (dbItems.length !== items.length) {
    console.warn(`⚠  Warning: Item count mismatch! JSON: ${items.length}, DB: ${dbItems.length}`);
  } else {
    console.log('✓ Item counts match!');
  }

  // Close database connection
  await disconnectPrisma();
}

// Run migration
if (import.meta.url === `file://${process.argv[1]}`) {
  void migrateMarketplace()
    .then(() => {
      console.log('\n✓ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Migration failed:', error);
      process.exit(1);
    });
}
