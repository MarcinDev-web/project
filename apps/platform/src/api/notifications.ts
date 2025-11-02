/**
 * Notifications API calls
 */

import { apiClient } from './client';

export type NotificationType = 
  | 'message'
  | 'friend_request'
  | 'friend_accepted'
  | 'group_invite'
  | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
  link?: string;
  metadata?: Record<string, unknown>;
}

export const notificationsApi = {
  async getNotifications(limit = 50): Promise<Notification[]> {
    const params = new URLSearchParams();
    if (limit) {
      params.append('limit', String(limit));
    }
    const query = params.toString();
    return apiClient.get<Notification[]>(`/notifications${query ? `?${query}` : ''}`);
  },

  async getUnreadCount(): Promise<number> {
    const result = await apiClient.get<{ count: number }>('/notifications/unread-count');
    return result.count;
  },

  async markAsRead(notificationId: string): Promise<void> {
    return apiClient.put(`/notifications/${notificationId}/read`);
  },

  async markAllAsRead(): Promise<void> {
    return apiClient.put('/notifications/read-all');
  },

  async deleteNotification(notificationId: string): Promise<void> {
    return apiClient.delete(`/notifications/${notificationId}`);
  },
};

