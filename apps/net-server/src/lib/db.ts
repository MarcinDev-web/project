import { PrismaClient } from '@engine/database';

let prisma: PrismaClient | null = null;

export async function getPrismaClient(): Promise<PrismaClient> {
  if (!prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    const isProduction = process.env.NODE_ENV === 'production';

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: connectionString,
        },
      },
      log: isProduction ? ['error', 'warn'] : ['query', 'error', 'warn'],
    });

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

export async function createDbPool(): Promise<PrismaClient> {
  return getPrismaClient();
}

export async function ensureSchema(): Promise<void> {
  const client = await getPrismaClient();
  try {
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
