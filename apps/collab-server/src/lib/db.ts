// Dynamic import to avoid TypeScript compilation issues with custom Prisma output path
let PrismaClientConstructor: (new (args?: any) => any) | null = null;
let prisma: any | null = null;

async function loadPrismaConstructor(): Promise<new (args?: any) => any> {
  if (PrismaClientConstructor) {
    return PrismaClientConstructor as new (args?: any) => any;
  }

  try {
    // Try custom output location first (from schema.prisma)
    const customModule = await import('../../node_modules/.prisma/collab-client');
    PrismaClientConstructor = customModule.PrismaClient as any;
    return PrismaClientConstructor as new (args?: any) => any;
  } catch {
    // Fallback to standard location
    const standardModule = await import('@prisma/client');
    // Handle both ESM and CJS formats
    const PrismaClientClass =
      (standardModule as any).PrismaClient || (standardModule as any).default?.PrismaClient;
    PrismaClientConstructor = PrismaClientClass;
    return PrismaClientConstructor as new (args?: any) => any;
  }
}

export async function getPrismaClient(): Promise<any> {
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
