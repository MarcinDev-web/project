import { PrismaClient } from '@engine/database';

let prisma: PrismaClient | null = null;

export async function getPrismaClient(): Promise<PrismaClient> {
  if (!prisma) {
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
  await client.$connect();
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
