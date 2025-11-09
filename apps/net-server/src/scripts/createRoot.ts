/**
 * Script to create a root account.
 * Usage:
 *   tsx src/scripts/createRoot.ts <email> <password>
 *   OR
 *   tsx src/scripts/createRoot.ts --email <email> --password <password>
 */

import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { User } from '../types/auth.js';
import { getPrismaClient } from '../lib/db.js';

const DATA_DIR = process.env.DATA_DIR || './data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

interface CreateRootOptions {
  email: string;
  password: string;
  makeExistingRoot?: boolean; // If true, make existing user root instead of creating new
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

async function createRootAccountJSON(options: CreateRootOptions): Promise<void> {
  const { email, password, makeExistingRoot = false } = options;
  const emailLower = email.toLowerCase();

  // Validate email
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new Error('Invalid email address');
  }

  // Validate password
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  console.log('Loading users from JSON storage...');
  const users = await loadUsers();

  if (users[emailLower]) {
    if (makeExistingRoot) {
      // Update existing user to root
      const user = users[emailLower];
      if (user.role === 'root') {
        console.log(`✅ User ${emailLower} is already a root user.`);
        return;
      }

      console.log(`Updating existing user ${emailLower} to root role...`);
      users[emailLower] = {
        ...user,
        role: 'root',
        updatedAt: Date.now(),
      };
    } else {
      throw new Error(
        `User with email ${emailLower} already exists. Use --make-existing-root to promote existing user.`
      );
    }
  } else {
    // Create new root user
    console.log(`Creating new root account for ${emailLower}...`);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = Date.now();

    const user: User = {
      id: generateUserId(),
      email: emailLower,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      role: 'root',
      active: true,
    };

    users[emailLower] = user;
  }

  console.log('Saving users...');
  await saveUsers(users);

  console.log(`✅ Root account created/updated successfully!`);
  console.log(`   Email: ${emailLower}`);
  console.log(`   Role: root`);
}

async function createRootAccountDB(options: CreateRootOptions): Promise<void> {
  const { email, password, makeExistingRoot = false } = options;
  const emailLower = email.toLowerCase();

  // Validate email
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new Error('Invalid email address');
  }

  // Validate password
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  console.log('Connecting to database...');
  const prisma = await getPrismaClient();

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (existingUser) {
      if (makeExistingRoot) {
        if (existingUser.role === 'root') {
          console.log(`✅ User ${emailLower} is already a root user.`);
          return;
        }

        console.log(`Updating existing user ${emailLower} to root role...`);
        await prisma.user.update({
          where: { email: emailLower },
          data: {
            role: 'root',
            updatedAt: new Date(),
          },
        });
      } else {
        throw new Error(
          `User with email ${emailLower} already exists. Use --make-existing-root to promote existing user.`
        );
      }
    } else {
      // Create new root user
      console.log(`Creating new root account for ${emailLower}...`);

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const userId = generateUserId();

      await prisma.user.create({
        data: {
          id: userId,
          email: emailLower,
          passwordHash,
          active: true,
          role: 'root',
        },
      });
    }

    console.log(`✅ Root account created/updated successfully!`);
    console.log(`   Email: ${emailLower}`);
    console.log(`   Role: root`);
  } finally {
    // Note: We don't disconnect Prisma here as it's a shared client
    // The connection will be reused by the server
  }
}

async function createRootAccount(options: CreateRootOptions): Promise<void> {
  // Check if database is available
  if (process.env.DATABASE_URL) {
    await createRootAccountDB(options);
  } else {
    await createRootAccountJSON(options);
  }
}

// Parse command line arguments
function parseArgs(): CreateRootOptions | null {
  const args = process.argv.slice(2);

  // Remove quotes from arguments (PowerShell/Windows issue)
  const cleanArgs = args.map((arg) => arg.replace(/^["']|["']$/g, ''));

  // Check for --email and --password flags
  let email: string | undefined;
  let password: string | undefined;
  let makeExistingRoot = false;

  for (let i = 0; i < cleanArgs.length; i++) {
    const arg = cleanArgs[i];
    if (!arg) continue;

    if (arg === '--email' && i + 1 < cleanArgs.length) {
      email = cleanArgs[i + 1];
      i++;
    } else if (arg === '--password' && i + 1 < cleanArgs.length) {
      password = cleanArgs[i + 1];
      i++;
    } else if (arg === '--make-existing-root') {
      makeExistingRoot = true;
    } else if (!email && !arg.startsWith('--')) {
      email = arg;
    } else if (!password && !arg.startsWith('--')) {
      password = arg;
    }
  }

  if (!email || !password) {
    console.error('Usage:');
    console.error('  tsx src/scripts/createRoot.ts <email> <password>');
    console.error('  OR');
    console.error('  tsx src/scripts/createRoot.ts --email <email> --password <password>');
    console.error('');
    console.error('Options:');
    console.error(
      '  --make-existing-root    Promote existing user to root instead of creating new'
    );
    console.error('');
    console.error('Received arguments:', JSON.stringify(cleanArgs));
    return null;
  }

  return { email, password, makeExistingRoot };
}

// Run script if executed directly
async function main() {
  try {
    const options = parseArgs();
    if (!options) {
      process.exit(1);
      return;
    }

    await createRootAccount(options);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Always run main() - this script is meant to be executed directly
void main();

export { createRootAccount };

