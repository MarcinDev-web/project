// Import Prisma Client - handle custom output path from schema.prisma
// schema.prisma sets output to "../node_modules/.prisma/net-client"
import type { PrismaClient as PrismaClientType } from '@prisma/client';

let PrismaClientConstructor: new (args?: any) => PrismaClientType | null = null;
let prisma: PrismaClientType | null = null;

async function loadPrismaConstructor(): Promise<new (args?: any) => PrismaClientType> {
  if (PrismaClientConstructor) {
    return PrismaClientConstructor;
  }
  
  try {
    // Try custom output location first (from schema.prisma)
    const customModule = await import('../node_modules/.prisma/net-client');
    PrismaClientConstructor = customModule.PrismaClient as any;
    return PrismaClientConstructor;
  } catch {
    // Fallback to standard location
    const standardModule = await import('@prisma/client');
    PrismaClientConstructor = standardModule.PrismaClient as any;
    return PrismaClientConstructor;
  }
}

export async function getPrismaClient(): Promise<PrismaClientType> {
  if (!prisma) {
    const Client = await loadPrismaConstructor();
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    // In production, ensure SSL is used
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && !connectionString.includes('sslmode=')) {
      console.warn('⚠️  WARNING: DATABASE_URL should use SSL (sslmode=require) in production');
    }

    prisma = new PrismaClientConstructor({
      datasources: {
        db: {
          url: connectionString,
        },
      },
    });
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
