/**
 * Clear all data from database and optionally clear JSON cache files.
 * 
 * This script will:
 * - Delete all data from all tables (users, forum, marketplace, etc.)
 * - Optionally clear JSON cache files in data/ directory
 * - Keep database schema intact
 * 
 * Usage:
 *   tsx src/scripts/clearDatabase.ts              # Clear database only
 *   tsx src/scripts/clearDatabase.ts --clear-cache # Clear database + JSON cache
 */

import { getPrismaClient, disconnectPrisma } from '../lib/db.js';
import { readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'path';

async function clearDatabase(): Promise<void> {
  const prisma = await getPrismaClient();
  
  console.log('🗑️  Clearing database...');
  
  try {
    // Delete in order respecting foreign key constraints
    // Start with tables that have foreign keys pointing to them
    
    console.log('  - Clearing forum data...');
    await prisma.forumThread.deleteMany({}); // Cascades to posts, reactions, votes
    
    console.log('  - Clearing support tickets...');
    await prisma.supportTicketMessage.deleteMany({});
    await prisma.supportTicket.deleteMany({});
    await prisma.supportFAQ.deleteMany({});
    
    console.log('  - Clearing marketplace data...');
    await prisma.marketplaceLike.deleteMany({});
    await prisma.marketplaceResaleListing.deleteMany({});
    await prisma.marketplaceBuild.deleteMany({});
    await prisma.marketplaceAvatar.deleteMany({});
    await prisma.marketplaceItem.deleteMany({});
    
    console.log('  - Clearing shop data...');
    await prisma.purchaseItem.deleteMany({});
    await prisma.purchase.deleteMany({});
    await prisma.userOwnedItem.deleteMany({});
    await prisma.shopAsset.deleteMany({});
    await prisma.shopItem.deleteMany({});
    
    console.log('  - Clearing studio data...');
    await prisma.projectTeamAccess.deleteMany({});
    await prisma.teamInvitation.deleteMany({});
    await prisma.teamMember.deleteMany({});
    await prisma.studioTeam.deleteMany({});
    await prisma.userProject.deleteMany({});
    await prisma.studioSetting.deleteMany({});
    await prisma.studioMetricsDaily.deleteMany({});
    await prisma.userAvatarPreset.deleteMany({});
    
    console.log('  - Clearing game sessions...');
    await prisma.gameSession.deleteMany({});
    
    console.log('  - Clearing token blacklist...');
    await prisma.tokenBlacklist.deleteMany({});
    
    console.log('  - Clearing users...');
    await prisma.user.deleteMany({});
    
    // Note: ForumCategory is kept (it's system data, not user data)
    // If you want to clear categories too, uncomment:
    // await prisma.forumCategory.deleteMany({});
    
    console.log('✅ Database cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

async function clearJsonCache(): Promise<void> {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  
  if (!existsSync(dataDir)) {
    console.log('📁 Data directory does not exist, skipping cache clear.');
    return;
  }
  
  console.log('🗑️  Clearing JSON cache files...');
  
  try {
    const files = await readdir(dataDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    for (const file of jsonFiles) {
      const filePath = path.join(dataDir, file);
      await unlink(filePath);
      console.log(`  - Deleted ${file}`);
    }
    
    console.log(`✅ Cleared ${jsonFiles.length} JSON cache files!`);
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  const clearCache = process.argv.includes('--clear-cache');
  const hasDb = Boolean(process.env.DATABASE_URL);
  
  if (!hasDb) {
    console.log('⚠️  DATABASE_URL not set. Only clearing JSON cache.');
    if (clearCache) {
      await clearJsonCache();
    } else {
      console.log('💡 Use --clear-cache flag to clear JSON cache files.');
    }
    return;
  }
  
  try {
    await clearDatabase();
    
    if (clearCache) {
      await clearJsonCache();
    } else {
      console.log('💡 Use --clear-cache flag to also clear JSON cache files.');
    }
    
    console.log('\n✨ All done! Database is now empty.');
  } catch (error) {
    console.error('\n❌ Failed to clear database:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

