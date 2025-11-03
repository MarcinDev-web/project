// Import Prisma Client - handle custom output path from schema.prisma
// schema.prisma sets output to "../node_modules/.prisma/net-client"
// @ts-expect-error - Prisma client is generated at build time
import type { PrismaClient as PrismaClientType } from '../../node_modules/.prisma/net-client';

let PrismaClientConstructor: (new (args?: any) => PrismaClientType) | null = null;
let prisma: PrismaClientType | null = null;

async function loadPrismaConstructor(): Promise<new (args?: any) => PrismaClientType> {
  if (PrismaClientConstructor) {
    return PrismaClientConstructor;
  }
  
  try {
    // Try custom output location first (from schema.prisma)
    // @ts-expect-error - Prisma client is generated at build time
    const customModule = await import('../../node_modules/.prisma/net-client');
    PrismaClientConstructor = customModule.PrismaClient as new (args?: any) => PrismaClientType;
    return PrismaClientConstructor;
  } catch {
    // Fallback to standard location (should not happen, but keep for compatibility)
    const standardModule = await import('@prisma/client');
    PrismaClientConstructor = (standardModule as any).PrismaClient as new (args?: any) => PrismaClientType;
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

    const Client = await loadPrismaConstructor();
    prisma = new Client({
      datasources: {
        db: {
          url: connectionString,
        },
      },
    }) as PrismaClientType;
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
  await client.$connect();
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
