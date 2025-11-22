/**
 * User Storage DB - PostgreSQL implementation using Prisma
 */

import { randomBytes } from 'node:crypto';
import { PrismaClient as PrismaClientType } from '@engine/database';
import type { User } from '../types/auth.js';

export class UserStorageDB {
  constructor(private readonly prisma: PrismaClientType) {}

  async initialize(): Promise<void> {
    // Schema is managed by Prisma migrations
    // No additional initialization needed
  }

  /**
   * Generate a unique user ID.
   */
  private generateUserId(): string {
    const bytes = randomBytes(16);
    return bytes.toString('hex');
  }

  /**
   * Save a new user account.
   */
  async saveUser(email: string, username: string, passwordHash: string): Promise<User> {
    // Check if email already exists
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingEmail) {
      throw new Error('User with this email already exists');
    }

    // Check if username already exists
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: username },
    });

    if (existingUsername) {
      throw new Error('Username is already taken');
    }

    const user = await this.prisma.user.create({
      data: {
        id: this.generateUserId(),
        email: email.toLowerCase(),
        username,
        passwordHash,
        active: true,
        role: 'user',
      },
    });

    return this.mapPrismaToUser(user);
  }

  /**
   * Find user by email.
   */
  async findUserByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    return user ? this.mapPrismaToUser(user) : null;
  }

  /**
   * Find user by ID.
   */
  async findUserById(userId: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    return user ? this.mapPrismaToUser(user) : null;
  }

  /**
   * Update user data by email.
   */
  async updateUser(
    email: string,
    updates: Partial<Omit<User, 'id' | 'email' | 'createdAt'>>
  ): Promise<void> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updates.passwordHash !== undefined) updateData.passwordHash = updates.passwordHash;
    if (updates.active !== undefined) updateData.active = updates.active;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.updatedAt !== undefined) updateData.updatedAt = new Date(updates.updatedAt);

    await this.prisma.user.update({
      where: { email: email.toLowerCase() },
      data: updateData,
    });
  }

  /**
   * Update user data by ID.
   */
  async updateUserById(
    userId: string,
    updates: Partial<Omit<User, 'id' | 'email' | 'createdAt'>>
  ): Promise<User> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updates.passwordHash !== undefined) updateData.passwordHash = updates.passwordHash;
    if (updates.active !== undefined) updateData.active = updates.active;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.updatedAt !== undefined) updateData.updatedAt = new Date(updates.updatedAt);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return this.mapPrismaToUser(user);
  }

  /**
   * Get all users.
   */
  async getAllUsers(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return users.map(this.mapPrismaToUser);
  }

  /**
   * Check if email is already registered.
   */
  async emailExists(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { email: email.toLowerCase() },
    });

    return count > 0;
  }

  /**
   * Check if username is already taken.
   */
  async usernameExists(username: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { username: username },
    });

    return count > 0;
  }

  /**
   * Map Prisma User model to our User interface
   */
  private mapPrismaToUser(prismaUser: any): User {
    return {
      id: prismaUser.id,
      email: prismaUser.email,
      username: prismaUser.username ?? undefined,
      passwordHash: prismaUser.passwordHash,
      createdAt: prismaUser.createdAt.getTime(),
      updatedAt: prismaUser.updatedAt.getTime(),
      active: prismaUser.active,
      role: prismaUser.role as 'user' | 'moderator' | 'admin' | 'root',
    };
  }
}
