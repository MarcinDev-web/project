/**
 * Blocked Users Storage - manages user blocking
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface BlockedUser {
  userId: string; // User who blocked
  blockedUserId: string; // User who was blocked
  createdAt: number;
}

export class BlockedUsersStorage {
  private readonly dataDir: string;
  private readonly blockedFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.blockedFile = path.join(dataDir, 'blocked_users.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });

    try {
      await fs.access(this.blockedFile);
    } catch {
      await fs.writeFile(this.blockedFile, JSON.stringify([], null, 2));
    }
  }

  private async readBlocked(): Promise<BlockedUser[]> {
    try {
      const data = await fs.readFile(this.blockedFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeBlocked(blocked: BlockedUser[]): Promise<void> {
    await fs.writeFile(this.blockedFile, JSON.stringify(blocked, null, 2));
  }

  async blockUser(userId: string, blockedUserId: string): Promise<BlockedUser> {
    if (userId === blockedUserId) {
      throw new Error('Cannot block yourself');
    }

    const blocked = await this.readBlocked();

    // Check if already blocked
    const existing = blocked.find((b) => b.userId === userId && b.blockedUserId === blockedUserId);

    if (existing) {
      return existing;
    }

    const block: BlockedUser = {
      userId,
      blockedUserId,
      createdAt: Date.now(),
    };

    blocked.push(block);
    await this.writeBlocked(blocked);

    return block;
  }

  async unblockUser(userId: string, blockedUserId: string): Promise<boolean> {
    const blocked = await this.readBlocked();
    const index = blocked.findIndex(
      (b) => b.userId === userId && b.blockedUserId === blockedUserId
    );

    if (index === -1) {
      return false;
    }

    blocked.splice(index, 1);
    await this.writeBlocked(blocked);

    return true;
  }

  async isBlocked(userId: string, blockedUserId: string): Promise<boolean> {
    const blocked = await this.readBlocked();
    return blocked.some((b) => b.userId === userId && b.blockedUserId === blockedUserId);
  }

  async isBlockedBy(userId: string, blockerUserId: string): Promise<boolean> {
    // Check if userId is blocked by blockerUserId
    return this.isBlocked(blockerUserId, userId);
  }

  async getBlockedUsers(userId: string): Promise<string[]> {
    const blocked = await this.readBlocked();
    return blocked.filter((b) => b.userId === userId).map((b) => b.blockedUserId);
  }

  async getBlockedByUsers(userId: string): Promise<string[]> {
    const blocked = await this.readBlocked();
    return blocked.filter((b) => b.blockedUserId === userId).map((b) => b.userId);
  }
}

