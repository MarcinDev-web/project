/**
 * Tests for BlockedUsersStorage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BlockedUsersStorage } from '../BlockedUsersStorage';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('BlockedUsersStorage', () => {
  let storage: BlockedUsersStorage;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-test-'));
    storage = new BlockedUsersStorage(tempDir);
    await storage.initialize();
  });

  it('blocks a user', async () => {
    const userId = 'user1';
    const blockedUserId = 'user2';

    const block = await storage.blockUser(userId, blockedUserId);

    expect(block.userId).toBe(userId);
    expect(block.blockedUserId).toBe(blockedUserId);
    expect(block.createdAt).toBeGreaterThan(0);
  });

  it('prevents blocking yourself', async () => {
    const userId = 'user1';

    await expect(storage.blockUser(userId, userId)).rejects.toThrow('Cannot block yourself');
  });

  it('returns existing block if already blocked', async () => {
    const userId = 'user1';
    const blockedUserId = 'user2';

    const block1 = await storage.blockUser(userId, blockedUserId);
    const block2 = await storage.blockUser(userId, blockedUserId);

    expect(block1.userId).toBe(block2.userId);
    expect(block1.blockedUserId).toBe(block2.blockedUserId);
  });

  it('checks if user is blocked', async () => {
    const userId = 'user1';
    const blockedUserId = 'user2';

    await storage.blockUser(userId, blockedUserId);

    const isBlocked = await storage.isBlocked(userId, blockedUserId);
    expect(isBlocked).toBe(true);

    const isNotBlocked = await storage.isBlocked(userId, 'user3');
    expect(isNotBlocked).toBe(false);
  });

  it('checks if user is blocked by another user', async () => {
    const userId = 'user1';
    const blockerId = 'user2';

    await storage.blockUser(blockerId, userId);

    const isBlockedBy = await storage.isBlockedBy(userId, blockerId);
    expect(isBlockedBy).toBe(true);

    const isNotBlockedBy = await storage.isBlockedBy(userId, 'user3');
    expect(isNotBlockedBy).toBe(false);
  });

  it('unblocks a user', async () => {
    const userId = 'user1';
    const blockedUserId = 'user2';

    await storage.blockUser(userId, blockedUserId);
    const unblocked = await storage.unblockUser(userId, blockedUserId);

    expect(unblocked).toBe(true);

    const isBlocked = await storage.isBlocked(userId, blockedUserId);
    expect(isBlocked).toBe(false);
  });

  it('returns false when unblocking non-blocked user', async () => {
    const userId = 'user1';
    const blockedUserId = 'user2';

    const unblocked = await storage.unblockUser(userId, blockedUserId);
    expect(unblocked).toBe(false);
  });

  it('gets list of blocked users', async () => {
    const userId = 'user1';

    await storage.blockUser(userId, 'user2');
    await storage.blockUser(userId, 'user3');

    const blocked = await storage.getBlockedUsers(userId);
    expect(blocked).toContain('user2');
    expect(blocked).toContain('user3');
    expect(blocked.length).toBe(2);
  });

  it('gets list of users who blocked this user', async () => {
    const userId = 'user1';

    await storage.blockUser('user2', userId);
    await storage.blockUser('user3', userId);

    const blockedBy = await storage.getBlockedByUsers(userId);
    expect(blockedBy).toContain('user2');
    expect(blockedBy).toContain('user3');
    expect(blockedBy.length).toBe(2);
  });
});

