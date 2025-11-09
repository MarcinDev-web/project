/**
 * Script to check users in database
 */

import { getPrismaClient, disconnectPrisma } from '../lib/db.js';

async function checkUsers() {
  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.error('ERROR: DATABASE_URL environment variable is not set');
      console.error('Please set DATABASE_URL to your PostgreSQL connection string');
      process.exit(1);
    }

    console.log('Connecting to database...');
    const prisma = await getPrismaClient();

    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`\nTotal users in database: ${users.length}\n`);

    if (users.length === 0) {
      console.log('No users found in database.');
    } else {
      console.log('Users:');
      console.log('─'.repeat(80));
      users.forEach((user, index) => {
        console.log(`${index + 1}. ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Username: ${user.username || '(not set)'}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.active}`);
        console.log(`   Created: ${new Date(user.createdAt).toLocaleString()}`);
        console.log('');
      });
    }

    // Check friends relationships
    const friendsCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM friends
    `.catch(() => [{ count: 0n }]);

    console.log(`\nFriends relationships: ${friendsCount[0]?.count || 0}`);

    await disconnectPrisma();
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsers();

