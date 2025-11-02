/**
 * User Settings API calls
 */

import { apiClient } from './client';

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

export const settingsApi = {
  async getSettings(): Promise<UserSettings> {
    return apiClient.get<UserSettings>('/settings');
  },

  async updateSettings(updates: { notificationPreferences?: Partial<NotificationPreferences> }): Promise<UserSettings> {
    return apiClient.put<UserSettings>('/settings', updates);
  },
};

