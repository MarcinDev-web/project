/**
 * Tests for NotificationsStorage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationsStorage } from '../NotificationsStorage';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('NotificationsStorage', () => {
  let storage: NotificationsStorage;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-test-'));
    storage = new NotificationsStorage(tempDir);
    await storage.initialize();
  });

  it('creates notification', async () => {
    const notification = await storage.createNotification({
      userId: 'user1',
      type: 'message',
      title: 'New Message',
      message: 'You have a new message',
    });

    expect(notification.id).toBeDefined();
    expect(notification.userId).toBe('user1');
    expect(notification.type).toBe('message');
    expect(notification.title).toBe('New Message');
    expect(notification.message).toBe('You have a new message');
    expect(notification.read).toBe(false);
    expect(notification.createdAt).toBeGreaterThan(0);
  });

  it('gets notifications for user', async () => {
    const userId = 'user1';

    await storage.createNotification({
      userId,
      type: 'message',
      title: 'Message 1',
      message: 'First message',
    });
    await storage.createNotification({
      userId,
      type: 'friend_request',
      title: 'Friend Request',
      message: 'You have a friend request',
    });

    const notifications = await storage.getNotifications(userId);
    expect(notifications.length).toBe(2);
    expect(notifications[0]?.title).toBe('Friend Request'); // Should be sorted by createdAt desc
  });

  it('respects limit when getting notifications', async () => {
    const userId = 'user1';

    for (let i = 0; i < 10; i++) {
      await storage.createNotification({
        userId,
        type: 'message',
        title: `Message ${i}`,
        message: `Message content ${i}`,
      });
      await new Promise(resolve => setTimeout(resolve, 1)); // Ensure different timestamps
    }

    const notifications = await storage.getNotifications(userId, 5);
    expect(notifications.length).toBe(5);
  });

  it('gets unread count', async () => {
    const userId = 'user1';

    await storage.createNotification({
      userId,
      type: 'message',
      title: 'Unread 1',
      message: 'Message',
    });
    await storage.createNotification({
      userId,
      type: 'message',
      title: 'Unread 2',
      message: 'Message',
    });

    const count = await storage.getUnreadCount(userId);
    expect(count).toBe(2);
  });

  it('marks notification as read', async () => {
    const userId = 'user1';

    const notification = await storage.createNotification({
      userId,
      type: 'message',
      title: 'Message',
      message: 'Content',
    });

    const marked = await storage.markAsRead(notification.id, userId);
    expect(marked).toBe(true);

    const notifications = await storage.getNotifications(userId);
    expect(notifications[0]?.read).toBe(true);
  });

  it('marks all notifications as read', async () => {
    const userId = 'user1';

    await storage.createNotification({
      userId,
      type: 'message',
      title: 'Message 1',
      message: 'Content',
    });
    await storage.createNotification({
      userId,
      type: 'message',
      title: 'Message 2',
      message: 'Content',
    });

    await storage.markAllAsRead(userId);

    const notifications = await storage.getNotifications(userId);
    expect(notifications.every(n => n.read)).toBe(true);
  });

  it('deletes notification', async () => {
    const userId = 'user1';

    const notification = await storage.createNotification({
      userId,
      type: 'message',
      title: 'Message',
      message: 'Content',
    });

    const deleted = await storage.deleteNotification(notification.id, userId);
    expect(deleted).toBe(true);

    const notifications = await storage.getNotifications(userId);
    expect(notifications.length).toBe(0);
  });

  it('supports notification metadata', async () => {
    const notification = await storage.createNotification({
      userId: 'user1',
      type: 'message',
      title: 'Message',
      message: 'Content',
      link: '/messages/123',
      metadata: {
        conversationId: 'conv_123',
        messageId: 'msg_456',
      },
    });

    expect(notification.link).toBe('/messages/123');
    expect(notification.metadata?.conversationId).toBe('conv_123');
    expect(notification.metadata?.messageId).toBe('msg_456');
  });
});

