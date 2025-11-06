import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient, User } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

interface JwtPayload {
  userId: string;
  email: string;
}

type AuthUser = Pick<User, 'id' | 'email' | 'passwordHash'>;

async function findUserByEmail(prisma: PrismaClient, email: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });
  return user;
}

async function insertUser(
  prisma: PrismaClient,
  email: string,
  passwordHash: string
): Promise<Pick<User, 'id' | 'email'>> {
  const id = randomUUID();
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      id,
      email,
      passwordHash,
    },
  });
  return { id, email };
}

function signToken(userId: string, email: string): { token: string; expiresAt: number } {
  const expiresInSec = 60 * 60 * 24; // 24h
  const token = jwt.sign({ userId, email } as JwtPayload, JWT_SECRET, { expiresIn: expiresInSec });
  const expiresAt = Date.now() + expiresInSec * 1000;
  return { token, expiresAt };
}

export function registerAuthRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  app.post('/auth/login', async (req, reply) => {
    try {
      const body = loginSchema.parse(req.body);
      const existing = await findUserByEmail(prisma, body.email);

      // Auto-register if not exists (optional, controlled by env)
      let userId: string;
      if (!existing) {
        const allowAutoRegistration = (process.env.ALLOW_AUTO_REGISTRATION || 'true') === 'true';
        if (!allowAutoRegistration) {
          return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const hash = await bcrypt.hash(body.password, 10);
        const created = await insertUser(prisma, body.email, hash);
        userId = created.id;
      } else {
        const valid = await bcrypt.compare(body.password, existing.passwordHash);
        if (!valid) {
          return reply.status(401).send({ error: 'Invalid credentials' });
        }
        userId = existing.id;
      }

      const { token, expiresAt } = signToken(userId, body.email);
      return reply.send({
        user: { id: userId, email: body.email, createdAt: Date.now() },
        session: { token, expiresAt },
      });
    } catch {
      return reply.status(400).send({ error: 'Invalid request' });
    }
  });

  app.get('/me', async (req, reply) => {
    try {
      const authHeader = req.headers['authorization'] || '';
      if (!authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
      return reply.send({ id: payload.userId, email: payload.email });
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });
}

export function verifyJwtFromRequest(
  req: FastifyRequest
): { userId: string; email: string } | null {
  try {
    const header = req.headers['authorization'] || '';
    if (!header.startsWith('Bearer ')) return null;
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}
