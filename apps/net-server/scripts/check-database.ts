#!/usr/bin/env tsx
/**
 * Database connection check script
 * Tests database connection and displays status
 */

import { getPrismaClient, ensureSchema } from '../src/lib/db.js';

async function checkDatabase() {
  console.log('🔍 Checking database connection...\n');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    console.log('\nTo set DATABASE_URL:');
    console.log('  - Create .env file in apps/net-server/');
    console.log('  - Add: DATABASE_URL="postgresql://user:password@host:port/database"');
    console.log('  - Or set it as environment variable');
    process.exit(1);
  }

  // Mask password in connection string for display
  const displayUrl = process.env.DATABASE_URL.replace(
    /:([^:@]+)@/,
    (_, password) => `:${'*'.repeat(password.length)}@`
  );
  console.log(`📊 Connection string: ${displayUrl}\n`);

  try {
    // Test connection
    console.log('1️⃣  Testing database connection...');
    const client = await getPrismaClient();
    console.log('   ✅ Connection established\n');

    // Test query
    console.log('2️⃣  Running test query...');
    const result = await client.$queryRaw`SELECT version(), current_database(), current_user`;
    const dbInfo = result as Array<{ version: string; current_database: string; current_user: string }>;
    if (dbInfo[0]) {
      console.log(`   ✅ Database: ${dbInfo[0].current_database}`);
      console.log(`   ✅ User: ${dbInfo[0].current_user}`);
      console.log(`   ✅ PostgreSQL: ${dbInfo[0].version.split(' ')[0]} ${dbInfo[0].version.split(' ')[1]}\n`);
    }

    // Check schema
    console.log('3️⃣  Checking database schema...');
    await ensureSchema();
    console.log('   ✅ Schema check passed\n');

    // Check migrations
    console.log('4️⃣  Checking migrations...');
    try {
      const migrations = await client.$queryRaw<
        Array<{ migration_name: string; applied_at: Date }>
      >`
        SELECT migration_name, applied_at 
        FROM _prisma_migrations 
        ORDER BY applied_at DESC 
        LIMIT 10
      `;
      if (migrations.length > 0) {
        console.log(`   ✅ Found ${migrations.length} migration(s):`);
        migrations.forEach((m, i) => {
          console.log(`      ${i + 1}. ${m.migration_name} (${m.applied_at.toISOString()})`);
        });
      } else {
        console.log('   ⚠️  No migrations found (may need to run: pnpm db:migrate)');
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        console.log('   ⚠️  Migrations table not found (may need to run: pnpm db:migrate)');
      } else {
        console.log('   ⚠️  Could not check migrations:', error instanceof Error ? error.message : error);
      }
    }
    console.log('');

    // Check tables
    console.log('5️⃣  Checking database tables...');
    const tables = await client.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    if (tables.length > 0) {
      console.log(`   ✅ Found ${tables.length} table(s):`);
      tables.forEach((t, i) => {
        console.log(`      ${i + 1}. ${t.table_name}`);
      });
    } else {
      console.log('   ⚠️  No tables found');
    }
    console.log('');

    console.log('✅ Database check completed successfully!');
    await client.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database check failed:');
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      if (error.message.includes('P1001')) {
        console.error('\n💡 Tip: Database server may be unreachable. Check:');
        console.error('   - Is PostgreSQL running?');
        console.error('   - Is DATABASE_URL correct?');
        console.error('   - Are firewall rules allowing connection?');
      } else if (error.message.includes('P1000')) {
        console.error('\n💡 Tip: Authentication failed. Check:');
        console.error('   - Database credentials in DATABASE_URL');
        console.error('   - User permissions');
      } else if (error.message.includes('P1003')) {
        console.error('\n💡 Tip: Database does not exist. Check:');
        console.error('   - Database name in DATABASE_URL');
        console.error('   - Create database if needed');
      }
    } else {
      console.error('   Unknown error:', error);
    }
    process.exit(1);
  }
}

checkDatabase().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

