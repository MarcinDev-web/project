/**
 * Script to create profile for existing admin user.
 * Usage: tsx src/scripts/createAdminProfile.ts
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || './data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

async function createAdminProfile() {
  console.log('Loading users...');

  if (!existsSync(USERS_FILE)) {
    console.error('❌ users.json not found');
    process.exit(1);
  }

  const usersData = await readFile(USERS_FILE, 'utf-8');
  const users = JSON.parse(usersData) as Record<
    string,
    { id: string; email: string; role?: string; createdAt: number }
  >;

  // Find admin user
  const adminUser = Object.values(users).find((u) => u.role === 'admin');
  if (!adminUser) {
    console.error('❌ No admin user found');
    process.exit(1);
  }

  console.log(`Found admin user: ${adminUser.email} (${adminUser.id})`);

  // Ensure profiles file exists
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }

  let profiles: Record<string, any> = {};
  if (existsSync(PROFILES_FILE)) {
    const profilesData = await readFile(PROFILES_FILE, 'utf-8');
    profiles = JSON.parse(profilesData);
  }

  // Check if profile already exists
  if (profiles[adminUser.id]) {
    console.log(`✅ Profile already exists for ${adminUser.email}`);
    return;
  }

  // Create profile
  profiles[adminUser.id] = {
    id: adminUser.id,
    email: adminUser.email,
    createdAt: adminUser.createdAt,
    updatedAt: Date.now(),
    role: adminUser.role,
  };

  console.log('Saving profile...');
  await writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf-8');

  console.log(`✅ Profile created for ${adminUser.email}`);
}

void createAdminProfile().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
