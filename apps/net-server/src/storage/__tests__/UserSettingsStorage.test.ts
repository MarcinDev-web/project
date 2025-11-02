/**
 * Tests for UserSettingsStorage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UserSettingsStorage } from '../UserSettingsStorage';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('UserSettingsStorage', () => {
  let storage: UserSettingsStorage;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-test-'));
    storage = new UserSettingsStorage(tempDir);
    await storage.initialize();
  });

  it('creates default settings for new user', async () => {
    const userId = 'user1';

    const settings = await storage.getSettings(userId);

    expect(settings.userId).toBe(userId);
    expect(settings.notificationPreferences.messages).toBe(true);
    expect(settings.notificationPreferences.friendRequests).toBe(true);
    expect(settings.notificationPreferences.friendAccepted).toBe(true);
    expect(settings.notificationPreferences.groupInvites).toBe(true);
    expect(settings.notificationPreferences.system).toBe(true);
  });

  it('returns same settings on subsequent calls', async () => {
    const userId = 'user1';

    const settings1 = await storage.getSettings(userId);
    const settings2 = await storage.getSettings(userId);

    expect(settings1.userId).toBe(settings2.userId);
    expect(settings1.updatedAt).toBe(settings2.updatedAt);
  });

  it('updates notification preferences', async () => {
    const userId = 'user1';

    const updated = await storage.updateSettings(userId, {
      notificationPreferences: {
        messages: false,
        friendRequests: true,
        friendAccepted: true,
        groupInvites: true,
        system: true,
      },
    });

    expect(updated.notificationPreferences.messages).toBe(false);
    expect(updated.notificationPreferences.friendRequests).toBe(true);
    expect(updated.notificationPreferences.system).toBe(true); // Should keep default
  });

  it('updates timestamp on settings change', async () => {
    const userId = 'user1';

    const settings1 = await storage.getSettings(userId);
    await new Promise(resolve => setTimeout(resolve, 10));

    const settings2 = await storage.updateSettings(userId, {
      notificationPreferences: {
        messages: false,
        friendRequests: true,
        friendAccepted: true,
        groupInvites: true,
        system: true,
      },
    });

    expect(settings2.updatedAt).toBeGreaterThan(settings1.updatedAt);
  });

  it('gets individual notification preference', async () => {
    const userId = 'user1';

    await storage.updateSettings(userId, {
      notificationPreferences: {
        messages: false,
        friendRequests: true,
        friendAccepted: true,
        groupInvites: true,
        system: true,
      },
    });

    const wantsMessages = await storage.getNotificationPreference(userId, 'messages');
    expect(wantsMessages).toBe(false);

    const wantsFriendRequests = await storage.getNotificationPreference(userId, 'friendRequests');
    expect(wantsFriendRequests).toBe(true); // Default
  });
});

