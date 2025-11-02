/**
 * Users API calls (blocking, etc.)
 */

import { apiClient } from './client';
import type { PublicUser } from '@shared/types/auth';

export interface BlockedStatus {
  isBlocked: boolean;
  isBlockedBy: boolean;
}

export const usersApi = {
  async blockUser(userId: string): Promise<void> {
    return apiClient.post(`/users/${userId}/block`);
  },

  async unblockUser(userId: string): Promise<void> {
    return apiClient.delete(`/users/${userId}/block`);
  },

  async getBlockedStatus(userId: string): Promise<BlockedStatus> {
    return apiClient.get<BlockedStatus>(`/users/${userId}/blocked-status`);
  },

  async getBlockedUsers(): Promise<PublicUser[]> {
    return apiClient.get<PublicUser[]>('/users/blocked');
  },
};

