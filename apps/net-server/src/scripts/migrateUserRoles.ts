/**
 * Migration script to add roles to existing users.
 * Sets all existing users without a role to 'user' by default.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { User } from '../types/auth';

const DATA_DIR = process.env.DATA_DIR || './data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function migrateUserRoles() {
  console.log('Starting user roles migration...');

  if (!existsSync(USERS_FILE)) {
    console.log('No users.json file found. Migration skipped.');
    return;
  }

  try {
    const data = await readFile(USERS_FILE, 'utf-8');
    const users = JSON.parse(data) as Record<string, User>;

    let migrated = 0;
    let adminSet = false;

    for (const [email, user] of Object.entries(users)) {
      // Set default role if missing
      if (!user.role) {
        user.role = 'user';
        migrated++;
      }

      // Optionally set first user as admin (only if no admins exist)
      if (!adminSet && migrated === 1 && !Object.values(users).some((u) => u.role === 'admin')) {
        user.role = 'admin';
        adminSet = true;
        console.log(`Set ${email} as admin (first user)`);
      }
    }

    if (migrated > 0) {
      // Write updated users back
      await writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
      console.log(`Migration complete: ${migrated} users updated with default role.`);
    } else {
      console.log('No users needed migration.');
    }

    if (adminSet) {
      console.log('First user has been set as admin.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateUserRoles().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { migrateUserRoles };
