// Import Prisma Client - handle custom output path from schema.prisma
// schema.prisma sets output to "../../node_modules/.prisma/collab-client"
// Use relative path for type imports (works during compilation)
import type { PrismaClient as PrismaClientType } from '../../node_modules/.prisma/collab-client/index.js';
import { Prisma } from '../../node_modules/.prisma/collab-client/index.js';

type PrismaClientCtor = new (args?: Prisma.PrismaClientOptions) => PrismaClientType;

let PrismaClientConstructor: PrismaClientCtor | null = null;
let prisma: PrismaClientType | null = null;

async function loadPrismaConstructor(): Promise<PrismaClientCtor> {
  if (PrismaClientConstructor) {
    return PrismaClientConstructor;
  }

  try {
    // Try custom output location first (from schema.prisma)
    // From /app/apps/collab-server/dist/lib/db.js to /app/node_modules/.prisma/collab-client
    // Relative path: ../../../node_modules/.prisma/collab-client
    const customModule = await import('../../../node_modules/.prisma/collab-client/index.js');
    PrismaClientConstructor = customModule.PrismaClient as PrismaClientCtor;
    return PrismaClientConstructor;
  } catch {
    // Fallback: try alternative relative path (for development)
    try {
      const customModuleRel = await import('../../node_modules/.prisma/collab-client/index.js');
      PrismaClientConstructor = customModuleRel.PrismaClient as PrismaClientCtor;
      return PrismaClientConstructor;
    } catch {
      // Final fallback to standard location (should not happen, but keep for compatibility)
      const standardModule = await import('@prisma/client');
      PrismaClientConstructor = (standardModule as any).PrismaClient as PrismaClientCtor;
      return PrismaClientConstructor;
    }
  }
}

export async function getPrismaClient(): Promise<PrismaClientType> {
  if (!prisma) {
    const PrismaClient = await loadPrismaConstructor();
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: connectionString,
        },
      },
    });
  }
  return prisma;
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
