/**
 * Notifications Storage - manages user notifications
 */

import { promises as fs } from 'fs';
import path from 'path';

export type NotificationType = 
  | 'message'
  | 'friend_request'
  | 'friend_accepted'
  | 'group_invite'
  | 'team_invitation'
  | 'team_invitation_accepted'
  | 'project_shared'
  | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
  link?: string; // Optional link to navigate to (e.g., /messages/:conversationId)
  metadata?: Record<string, unknown>; // Additional data (userId, conversationId, etc.)
}

export class NotificationsStorage {
  private readonly dataDir: string;
  private readonly notificationsFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.notificationsFile = path.join(dataDir, 'notifications.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    
    try {
      await fs.access(this.notificationsFile);
    } catch {
      await fs.writeFile(this.notificationsFile, JSON.stringify([], null, 2));
    }
  }

  private async readNotifications(): Promise<Notification[]> {
    try {
      const data = await fs.readFile(this.notificationsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeNotifications(notifications: Notification[]): Promise<void> {
    await fs.writeFile(this.notificationsFile, JSON.stringify(notifications, null, 2));
  }

  async createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<Notification> {
    const notifications = await this.readNotifications();
    
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      read: false,
      createdAt: Date.now(),
    };

    notifications.push(newNotification);
    await this.writeNotifications(notifications);
    
    return newNotification;
  }

  async getNotifications(userId: string, limit = 50): Promise<Notification[]> {
    const notifications = await this.readNotifications();
    return notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const notifications = await this.readNotifications();
    return notifications.filter(n => n.userId === userId && !n.read).length;
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const notifications = await this.readNotifications();
    const notification = notifications.find(n => n.id === notificationId && n.userId === userId);
    
    if (!notification || notification.read) {
      return false;
    }

    notification.read = true;
    await this.writeNotifications(notifications);
    
    return true;
  }

  async markAllAsRead(userId: string): Promise<void> {
    const notifications = await this.readNotifications();
    const userNotifications = notifications.filter(n => n.userId === userId && !n.read);
    
    for (const notification of userNotifications) {
      notification.read = true;
    }
    
    if (userNotifications.length > 0) {
      await this.writeNotifications(notifications);
    }
  }

  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const notifications = await this.readNotifications();
    const index = notifications.findIndex(n => n.id === notificationId && n.userId === userId);
    
    if (index === -1) {
      return false;
    }

    notifications.splice(index, 1);
    await this.writeNotifications(notifications);
    
    return true;
  }
}

