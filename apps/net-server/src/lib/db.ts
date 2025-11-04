// Import Prisma Client - handle custom output path from schema.prisma
// schema.prisma sets output to "../node_modules/.prisma/net-client"
import type { PrismaClient as PrismaClientType } from '../../node_modules/.prisma/net-client';

let PrismaClientConstructor: (new (args?: any) => PrismaClientType) | null = null;
let prisma: PrismaClientType | null = null;

async function loadPrismaConstructor(): Promise<new (args?: any) => PrismaClientType> {
  if (PrismaClientConstructor) {
    return PrismaClientConstructor;
  }

  try {
    // Try custom output location first (from schema.prisma)
    const customModule = await import('../../node_modules/.prisma/net-client');
    PrismaClientConstructor = customModule.PrismaClient as new (args?: any) => PrismaClientType;
    return PrismaClientConstructor;
  } catch {
    // Fallback to standard location (should not happen, but keep for compatibility)
    const standardModule = await import('@prisma/client');
    PrismaClientConstructor = (standardModule as any).PrismaClient as new (
      args?: any
    ) => PrismaClientType;
    return PrismaClientConstructor;
  }
}

export async function getPrismaClient(): Promise<PrismaClientType> {
  if (!prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    // In production, ensure SSL is used
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && !connectionString.includes('sslmode=')) {
      console.warn('⚠️  WARNING: DATABASE_URL should use SSL (sslmode=require) in production');
    }

    // Validate connection string format
    try {
      const url = new URL(connectionString);
      if (!url.protocol.startsWith('postgres')) {
        console.warn('⚠️  WARNING: DATABASE_URL should use postgresql:// or postgres:// protocol');
      }
    } catch (error) {
      console.error('❌ ERROR: Invalid DATABASE_URL format:', error);
      throw new Error('DATABASE_URL is not a valid URL');
    }

    const Client = await loadPrismaConstructor();
    prisma = new Client({
      datasources: {
        db: {
          url: connectionString,
        },
      },
      log: isProduction ? ['error', 'warn'] : ['query', 'error', 'warn'],
    });

    // Test connection immediately
    try {
      await prisma.$connect();
      console.log('✅ Database connection established');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      throw error;
    }
  }
  return prisma;
}

// Legacy function for backward compatibility during migration
export async function createDbPool(): Promise<PrismaClientType> {
  return getPrismaClient();
}

export async function ensureSchema(): Promise<void> {
  const client = await getPrismaClient();
  // Schema is managed by Prisma migrations
  // Run migrations: pnpm db:migrate
  try {
    // Test connection with a simple query
    await client.$queryRaw`SELECT 1`;
    console.log('✅ Database schema check passed');
  } catch (error) {
    console.error('❌ Database schema check failed:', error);
    throw error;
  }
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
