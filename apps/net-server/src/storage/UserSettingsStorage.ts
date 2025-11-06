/**
 * User Settings Storage - manages user preferences
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface NotificationPreferences {
  messages: boolean;
  friendRequests: boolean;
  friendAccepted: boolean;
  groupInvites: boolean;
  system: boolean;
}

export interface UserSettings {
  userId: string;
  notificationPreferences: NotificationPreferences;
  updatedAt: number;
}

export class UserSettingsStorage {
  private readonly dataDir: string;
  private readonly settingsFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.settingsFile = path.join(dataDir, 'user_settings.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });

    try {
      await fs.access(this.settingsFile);
    } catch {
      await fs.writeFile(this.settingsFile, JSON.stringify([], null, 2));
    }
  }

  private async readSettings(): Promise<UserSettings[]> {
    try {
      const data = await fs.readFile(this.settingsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeSettings(settings: UserSettings[]): Promise<void> {
    await fs.writeFile(this.settingsFile, JSON.stringify(settings, null, 2));
  }

  async getSettings(userId: string): Promise<UserSettings> {
    const settings = await this.readSettings();
    let userSettings = settings.find((s) => s.userId === userId);

    if (!userSettings) {
      // Create default settings
      userSettings = {
        userId,
        notificationPreferences: {
          messages: true,
          friendRequests: true,
          friendAccepted: true,
          groupInvites: true,
          system: true,
        },
        updatedAt: Date.now(),
      };
      settings.push(userSettings);
      await this.writeSettings(settings);
    }

    return userSettings;
  }

  async updateSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
    const settings = await this.readSettings();
    let userSettings = settings.find((s) => s.userId === userId);

    if (!userSettings) {
      // Create with defaults
      userSettings = {
        userId,
        notificationPreferences: {
          messages: true,
          friendRequests: true,
          friendAccepted: true,
          groupInvites: true,
          system: true,
        },
        updatedAt: Date.now(),
      };
      settings.push(userSettings);
    }

    // Update
    if (updates.notificationPreferences) {
      userSettings.notificationPreferences = {
        ...userSettings.notificationPreferences,
        ...updates.notificationPreferences,
      };
    }

    userSettings.updatedAt = Date.now();

    await this.writeSettings(settings);
    return userSettings;
  }

  async getNotificationPreference(
    userId: string,
    type: keyof NotificationPreferences
  ): Promise<boolean> {
    const settings = await this.getSettings(userId);
    return settings.notificationPreferences[type];
  }
}

