/**
 * Script to create an admin account.
 * Usage:
 *   tsx src/scripts/createAdmin.ts <email> <password>
 *   OR
 *   tsx src/scripts/createAdmin.ts --email <email> --password <password>
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

interface CreateAdminOptions {
  email: string;
  password: string;
  makeExistingAdmin?: boolean; // If true, make existing user admin instead of creating new
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

async function createAdminAccount(options: CreateAdminOptions): Promise<void> {
  const { email, password, makeExistingAdmin = false } = options;
  const emailLower = email.toLowerCase();

  // Validate email
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new Error('Invalid email address');
  }

  // Validate password
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  console.log('Loading users...');
  const users = await loadUsers();

  if (users[emailLower]) {
    if (makeExistingAdmin) {
      // Update existing user to admin
      const user = users[emailLower];
      if (user.role === 'admin') {
        console.log(`✅ User ${emailLower} is already an admin.`);
        return;
      }

      console.log(`Updating existing user ${emailLower} to admin role...`);
      users[emailLower] = {
        ...user,
        role: 'admin',
        updatedAt: Date.now(),
      };
    } else {
      throw new Error(
        `User with email ${emailLower} already exists. Use --make-existing-admin to promote existing user.`
      );
    }
  } else {
    // Create new admin user
    console.log(`Creating new admin account for ${emailLower}...`);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = Date.now();

    const user: User = {
      id: generateUserId(),
      email: emailLower,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      role: 'admin',
      active: true,
    };

    users[emailLower] = user;
  }

  console.log('Saving users...');
  await saveUsers(users);

  console.log(`✅ Admin account created/updated successfully!`);
  console.log(`   Email: ${emailLower}`);
  console.log(`   Role: admin`);
}

// Parse command line arguments
function parseArgs(): CreateAdminOptions | null {
  const args = process.argv.slice(2);

  // Remove quotes from arguments (PowerShell/Windows issue)
  const cleanArgs = args.map((arg) => arg.replace(/^["']|["']$/g, ''));

  // Check for --email and --password flags
  let email: string | undefined;
  let password: string | undefined;
  let makeExistingAdmin = false;

  for (let i = 0; i < cleanArgs.length; i++) {
    const arg = cleanArgs[i];
    if (!arg) continue;

    if (arg === '--email' && i + 1 < cleanArgs.length) {
      email = cleanArgs[i + 1];
      i++;
    } else if (arg === '--password' && i + 1 < cleanArgs.length) {
      password = cleanArgs[i + 1];
      i++;
    } else if (arg === '--make-existing-admin') {
      makeExistingAdmin = true;
    } else if (!email && !arg.startsWith('--')) {
      email = arg;
    } else if (!password && !arg.startsWith('--')) {
      password = arg;
    }
  }

  if (!email || !password) {
    console.error('Usage:');
    console.error('  tsx src/scripts/createAdmin.ts <email> <password>');
    console.error('  OR');
    console.error('  tsx src/scripts/createAdmin.ts --email <email> --password <password>');
    console.error('');
    console.error('Options:');
    console.error(
      '  --make-existing-admin    Promote existing user to admin instead of creating new'
    );
    console.error('');
    console.error('Received arguments:', JSON.stringify(cleanArgs));
    return null;
  }

  return { email, password, makeExistingAdmin };
}

// Run script if executed directly
async function main() {
  try {
    const options = parseArgs();
    if (!options) {
      process.exit(1);
      return;
    }

    await createAdminAccount(options);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Always run main() - this script is meant to be executed directly
void main();

export { createAdminAccount };

