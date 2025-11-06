import type { Prisma, PrismaClient } from '@prisma/client';

// Dynamic import to avoid TypeScript compilation issues with custom Prisma output path
// Prisma generates client to custom location: ../../node_modules/.prisma/collab-client
// This requires dynamic import as TypeScript cannot resolve this path statically

type PrismaClientCtor = new (args?: Prisma.PrismaClientOptions) => PrismaClient;

interface PrismaModuleExports {
  PrismaClient?: unknown;
  default?: {
    PrismaClient?: unknown;
  };
}

let PrismaClientConstructor: PrismaClientCtor | null = null;
let prisma: PrismaClient | null = null;

function isPrismaClientCtor(value: unknown): value is PrismaClientCtor {
  return typeof value === 'function';
}

function extractPrismaClientCtor(moduleExports: unknown): PrismaClientCtor {
  if (!moduleExports || typeof moduleExports !== 'object') {
    throw new Error('Invalid Prisma module export');
  }

  const exportsObject = moduleExports as PrismaModuleExports;

  if (isPrismaClientCtor(exportsObject.PrismaClient)) {
    return exportsObject.PrismaClient;
  }

  const defaultExport = exportsObject.default;
  if (defaultExport && typeof defaultExport === 'object') {
    const maybeDefault = defaultExport as PrismaModuleExports['default'];
    if (maybeDefault?.PrismaClient && isPrismaClientCtor(maybeDefault.PrismaClient)) {
      return maybeDefault.PrismaClient;
    }
  }

  throw new Error('PrismaClient export not found');
}

async function loadPrismaConstructor(): Promise<PrismaClientCtor> {
  if (PrismaClientConstructor) {
    return PrismaClientConstructor;
  }

  try {
    // Try custom output location first (from schema.prisma)
    const customModule = await import('../../node_modules/.prisma/collab-client');
    PrismaClientConstructor = extractPrismaClientCtor(customModule);
    return PrismaClientConstructor;
  } catch {
    // Fallback to standard location
    const standardModule = await import('@prisma/client');
    PrismaClientConstructor = extractPrismaClientCtor(standardModule);
    return PrismaClientConstructor;
  }
}

export async function getPrismaClient(): Promise<PrismaClient> {
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
