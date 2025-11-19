/**
 * Script to assign PvP game to a specific user
 * This transfers ownership of the PvP game from mock_user_pvp to the specified user
 */

import { UserStorageDB } from '../auth/UserStorageDB.js';
import { MarketplaceStorageDB } from '../storage/MarketplaceStorageDB.js';
import { StudioProjectsStorageDB } from '../storage/StudioProjectsStorage.js';
import { createDbPool } from '../lib/db.js';

const TARGET_EMAIL = 'pvpkurwa@forge.pl';
const TARGET_USERNAME = 'PVPPPP';
const PVP_AUTHOR_ID = 'mock_user_pvp';

async function assignPvpGameToUser() {
  let dbPool: Awaited<ReturnType<typeof createDbPool>> | null = null;

  try {
    console.log('Starting PvP game assignment...');
    console.log(`Target user: ${TARGET_USERNAME} (${TARGET_EMAIL})`);
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set (using JSON storage)');

    if (!process.env.DATABASE_URL) {
      console.error('❌ This script requires DATABASE_URL to be set');
      process.exit(1);
    }

    console.log('Connecting to database...');
    dbPool = await createDbPool();
    console.log('✓ Database connection established');

    const userStorage = new UserStorageDB(dbPool);
    const marketplaceStorage = new MarketplaceStorageDB(dbPool);
    const studioStorage = new StudioProjectsStorageDB(dbPool);

    await userStorage.initialize();
    await marketplaceStorage.initialize();
    await studioStorage.initialize();

    // Find target user by email or username
    console.log(`\nLooking for user with email: ${TARGET_EMAIL} or username: ${TARGET_USERNAME}...`);
    let targetUser = await userStorage.findUserByEmail(TARGET_EMAIL);
    
    if (!targetUser) {
      // Try to find by username using direct Prisma query
      const userByUsername = await dbPool.user.findUnique({
        where: { username: TARGET_USERNAME },
      });
      if (userByUsername) {
        targetUser = {
          id: userByUsername.id,
          email: userByUsername.email,
          username: userByUsername.username ?? undefined,
          passwordHash: userByUsername.passwordHash,
          createdAt: userByUsername.createdAt.getTime(),
          updatedAt: userByUsername.updatedAt.getTime(),
          active: userByUsername.active,
          role: userByUsername.role as 'user' | 'moderator' | 'admin' | 'root',
        };
      }
    }

    if (!targetUser) {
      console.error(`❌ User not found with email ${TARGET_EMAIL} or username ${TARGET_USERNAME}`);
      process.exit(1);
    }

    console.log(`✓ Found user: ${targetUser.id}`);
    console.log(`  Email: ${targetUser.email}`);
    console.log(`  Username: ${targetUser.username ?? 'N/A'}`);

    // Find PvP game in marketplace
    console.log(`\nLooking for PvP game with authorId: ${PVP_AUTHOR_ID}...`);
    const pvpGames = await marketplaceStorage.getItems({
      authorId: PVP_AUTHOR_ID,
      type: 'build',
      tags: ['pvp'],
    });

    if (pvpGames.length === 0) {
      console.error('❌ No PvP game found with the specified authorId');
      process.exit(1);
    }

    const pvpGame = pvpGames[0]!;
    console.log(`✓ Found PvP game: ${pvpGame.id}`);
    console.log(`  Title: ${pvpGame.title}`);
    console.log(`  Current authorId: ${pvpGame.authorId}`);

    // Update marketplace item authorId directly in database
    console.log(`\nUpdating marketplace item authorId from ${pvpGame.authorId} to ${targetUser.id}...`);
    await dbPool.marketplaceItem.update({
      where: { id: pvpGame.id },
      data: {
        authorId: targetUser.id,
        authorName: targetUser.username ?? 'Unknown',
      },
    });
    console.log('✓ Marketplace item updated');

    // Find PvP project in studio
    console.log(`\nLooking for PvP project with userId: ${PVP_AUTHOR_ID}...`);
    const pvpProjects = await studioStorage.listProjects(PVP_AUTHOR_ID);
    const pvpProject = pvpProjects.find(
      (p) => p.projectData?.metadata?.marketplaceItemId === pvpGame.id || p.tags?.includes('pvp')
    );

    if (!pvpProject) {
      console.log('⚠ No matching PvP project found in studio');
    } else {
      console.log(`✓ Found PvP project: ${pvpProject.id}`);
      console.log(`  Name: ${pvpProject.name}`);
      console.log(`  Current userId: ${pvpProject.userId}`);

      // Update project userId directly in database
      console.log(`\nUpdating project userId from ${pvpProject.userId} to ${targetUser.id}...`);
      await dbPool.userProject.update({
        where: { id: pvpProject.id },
        data: {
          userId: targetUser.id,
        },
      });
      console.log('✓ Studio project updated');
    }

    // Verify the changes
    console.log('\n=== Verifying changes ===');
    const updatedGame = await marketplaceStorage.getItem(pvpGame.id);
    if (updatedGame) {
      console.log(`Marketplace item authorId: ${updatedGame.authorId} (expected: ${targetUser.id})`);
      if (updatedGame.authorId === targetUser.id) {
        console.log('✓ Marketplace item correctly assigned');
      } else {
        console.error('❌ Marketplace item assignment failed');
      }
    }

    if (pvpProject) {
      const updatedProject = await studioStorage.getProject(targetUser.id, pvpProject.id);
      if (updatedProject) {
        console.log(`Studio project userId: ${updatedProject.userId} (expected: ${targetUser.id})`);
        if (updatedProject.userId === targetUser.id) {
          console.log('✓ Studio project correctly assigned');
        } else {
          console.error('❌ Studio project assignment failed');
        }
      }
    }

    console.log('\n✅ PvP game has been successfully assigned to the user!');
    console.log(`   User ID: ${targetUser.id}`);
    console.log(`   Marketplace Item ID: ${pvpGame.id}`);
    if (pvpProject) {
      console.log(`   Studio Project ID: ${pvpProject.id}`);
    }
  } catch (error) {
    console.error('❌ Error assigning PvP game:', error);
    throw error;
  } finally {
    if (dbPool) {
      await dbPool.$disconnect();
    }
  }
}

// Run the script
void assignPvpGameToUser()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

