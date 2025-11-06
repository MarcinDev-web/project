/**
 * Script to migrate existing users from JSON file storage to PostgreSQL database.
 * Run this after deploying with database support.
 *
 * Usage:
 *   tsx src/scripts/migrateUsersToDB.ts
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createDbPool } from '../lib/db.js';
import { UserStorageDB } from '../auth/UserStorageDB.js';
import type { User } from '../types/auth.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');

interface JsonUser extends User {
  // JSON file uses number timestamps, database uses Date objects
}

async function loadUsersFromJson(): Promise<Record<string, JsonUser>> {
  try {
    const data = await readFile(USERS_FILE, 'utf-8');
    return JSON.parse(data) as Record<string, JsonUser>;
  } catch (error) {
    console.error('Failed to load users from JSON file:', error);
    return {};
  }
}

async function migrateUsers(): Promise<void> {
  console.log('🔄 Starting user migration from JSON to database...');

  // Load existing users from JSON file
  console.log('📂 Loading users from JSON file...');
  const jsonUsers = await loadUsersFromJson();
  const users = Object.values(jsonUsers);

  if (users.length === 0) {
    console.log('⚠️  No users found in JSON file. Nothing to migrate.');
    return;
  }

  console.log(`📊 Found ${users.length} users to migrate`);

  // Initialize database connection
  console.log('🗄️  Connecting to database...');
  const dbPool = createDbPool();

  try {
    // Create UserStorageDB instance
    const userStorage = new UserStorageDB(dbPool);

    // Migrate users one by one
    let migrated = 0;
    let skipped = 0;

    for (const user of users) {
      try {
        // Check if user already exists in database
        const existing = await userStorage.findUserByEmail(user.email);
        if (existing) {
          console.log(`⏭️  User ${user.email} already exists in database, skipping...`);
          skipped++;
          continue;
        }

        // Create user in database using raw SQL to preserve original data
        await dbPool.user.create({
          data: {
            id: user.id,
            email: user.email,
            passwordHash: user.passwordHash,
            createdAt: new Date(user.createdAt),
            updatedAt: new Date(user.updatedAt),
            active: user.active ?? true,
            role: user.role ?? 'user',
          },
        });

        console.log(`✅ Migrated user: ${user.email} (${user.role})`);
        migrated++;
      } catch (error) {
        console.error(`❌ Failed to migrate user ${user.email}:`, error);
      }
    }

    console.log('🎉 Migration completed!');
    console.log(`   ✅ Migrated: ${migrated} users`);
    console.log(`   ⏭️  Skipped: ${skipped} users (already existed)`);
    console.log(`   📊 Total processed: ${users.length} users`);

  } finally {
    // Close database connection
    await dbPool.$disconnect();
  }
}

// Run script if executed directly
async function main() {
  try {
    await migrateUsers();
    console.log('🏁 User migration script completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Always run main() - this script is meant to be executed directly
void main();
