/**
 * Script to create test accounts for the platform.
 * Creates:
 * - 1 admin account (additional to existing admin)
 * - 3 moderator accounts
 * - 5 user accounts
 *
 * Usage:
 *   tsx src/scripts/createTestAccounts.ts
 */

import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { User } from '../types/auth.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

interface CreateAccountsOptions {
  adminCount: number;
  moderatorCount: number;
  userCount: number;
}

async function loadUsers(): Promise<Record<string, User>> {
  if (!existsSync(USERS_FILE)) {
    return {};
  }

  const data = await readFile(USERS_FILE, 'utf-8');
  return JSON.parse(data) as Record<string, User>;
}

async function saveUsers(users: Record<string, User>): Promise<void> {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }

  await writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function generateUserId(): string {
  const bytes = randomBytes(16);
  return bytes.toString('hex');
}

function generateSecurePassword(): string {
  // Generate a secure password with mixed characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';

  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special

  // Fill the rest randomly
  for (let i = 4; i < 16; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

function generateEmail(prefix: string, role: string, index: number): string {
  const timestamp = Date.now();
  return `${prefix}_${role}_${index}_${timestamp}@forge.pl`;
}

async function createAccounts(options: CreateAccountsOptions): Promise<void> {
  const { adminCount, moderatorCount, userCount } = options;

  console.log('Loading existing users...');
  const users = await loadUsers();

  console.log(`Creating ${adminCount} admin account(s)...`);
  for (let i = 0; i < adminCount; i++) {
    const email = generateEmail('admin', 'account', i + 1);
    const password = generateSecurePassword();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = Date.now();

    const user: User = {
      id: generateUserId(),
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      role: 'admin',
      active: true,
    };

    users[email] = user;
    console.log(`  ✅ Admin account: ${email}`);
    console.log(`     Password: ${password}`);
  }

  console.log(`Creating ${moderatorCount} moderator account(s)...`);
  for (let i = 0; i < moderatorCount; i++) {
    const email = generateEmail('moderator', 'account', i + 1);
    const password = generateSecurePassword();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = Date.now();

    const user: User = {
      id: generateUserId(),
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      role: 'moderator',
      active: true,
    };

    users[email] = user;
    console.log(`  ✅ Moderator account: ${email}`);
    console.log(`     Password: ${password}`);
  }

  console.log(`Creating ${userCount} user account(s)...`);
  for (let i = 0; i < userCount; i++) {
    const email = generateEmail('user', 'account', i + 1);
    const password = generateSecurePassword();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = Date.now();

    const user: User = {
      id: generateUserId(),
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      role: 'user',
      active: true,
    };

    users[email] = user;
    console.log(`  ✅ User account: ${email}`);
    console.log(`     Password: ${password}`);
  }

  console.log('Saving users...');
  await saveUsers(users);

  console.log('✅ All accounts created successfully!');
  console.log(`   Total accounts created: ${adminCount + moderatorCount + userCount}`);
}

// Run script if executed directly
async function main() {
  try {
    // Create the required accounts as specified by the user
    await createAccounts({
      adminCount: 1,      // 1 additional admin (total will be 2 admins)
      moderatorCount: 3,  // 3 moderator accounts
      userCount: 5,       // 5 user accounts
    });
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Always run main() - this script is meant to be executed directly
void main();
