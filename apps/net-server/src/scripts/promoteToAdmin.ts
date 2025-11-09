/**
 * Script to promote a user to admin role in the database.
 * Usage:
 *   tsx src/scripts/promoteToAdmin.ts <email>
 *   OR
 *   tsx src/scripts/promoteToAdmin.ts --email <email>
 *   OR
 *   tsx src/scripts/promoteToAdmin.ts --username <username>
 */

import { getPrismaClient, disconnectPrisma } from '../lib/db.js';

interface PromoteOptions {
  email?: string;
  username?: string;
}

async function promoteToAdmin(options: PromoteOptions): Promise<void> {
  const { email, username } = options;

  if (!email && !username) {
    throw new Error('Either email or username must be provided');
  }

  console.log('🗄️  Connecting to database...');
  const prisma = await getPrismaClient();

  try {
    // Find user by email or username
    let user;
    if (email) {
      user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (!user) {
        throw new Error(`User with email ${email} not found`);
      }
    } else if (username) {
      user = await prisma.user.findUnique({
        where: { username: username },
      });
      if (!user) {
        throw new Error(`User with username ${username} not found`);
      }
    }

    if (!user) {
      throw new Error('User not found');
    }

    // Check if already admin
    if (user.role === 'admin') {
      console.log(`✅ User ${user.email} (${user.username || 'no username'}) is already an admin.`);
      return;
    }

    // Update user role to admin
    console.log(`🔄 Promoting user ${user.email} (${user.username || 'no username'}) to admin...`);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: 'admin',
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Successfully promoted user to admin!`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Username: ${user.username || 'not set'}`);
    console.log(`   Role: admin`);
  } finally {
    await disconnectPrisma();
  }
}

// Parse command line arguments
function parseArgs(): PromoteOptions | null {
  const args = process.argv.slice(2);

  // Remove quotes from arguments (PowerShell/Windows issue)
  const cleanArgs = args.map((arg) => arg.replace(/^["']|["']$/g, ''));

  let email: string | undefined;
  let username: string | undefined;

  for (let i = 0; i < cleanArgs.length; i++) {
    const arg = cleanArgs[i];
    if (!arg) continue;

    if (arg === '--email' && i + 1 < cleanArgs.length) {
      email = cleanArgs[i + 1];
      i++;
    } else if (arg === '--username' && i + 1 < cleanArgs.length) {
      username = cleanArgs[i + 1];
      i++;
    } else if (!email && !arg.startsWith('--')) {
      // Assume first non-flag argument is email
      email = arg;
    }
  }

  if (!email && !username) {
    console.error('Usage:');
    console.error('  tsx src/scripts/promoteToAdmin.ts <email>');
    console.error('  OR');
    console.error('  tsx src/scripts/promoteToAdmin.ts --email <email>');
    console.error('  OR');
    console.error('  tsx src/scripts/promoteToAdmin.ts --username <username>');
    console.error('');
    console.error('Received arguments:', JSON.stringify(cleanArgs));
    return null;
  }

  // At least one is defined due to check above
  return { email, username } as PromoteOptions;
}

// Run script if executed directly
async function main() {
  try {
    const options = parseArgs();
    if (!options) {
      process.exit(1);
      return;
    }

    await promoteToAdmin(options);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Always run main() - this script is meant to be executed directly
void main();

export { promoteToAdmin };

