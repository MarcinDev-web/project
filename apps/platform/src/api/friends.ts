/**
 * Friends API calls
 */

import { apiClient } from './client';
import type { PublicUser } from '@shared/types/auth';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export interface Friend extends PublicUser {
  isOnline?: boolean;
  avatarUrl?: string;
  displayName?: string;
}

export const friendsApi = {
  async getFriends(): Promise<Friend[]> {
    return apiClient.get<Friend[]>('/friends');
  },

  async getPresence(): Promise<Record<string, boolean>> {
    return apiClient.get<Record<string, boolean>>('/friends/presence');
  },

  async getSuggestions(): Promise<Array<Friend & { mutualFriends?: number }>> {
    return apiClient.get<Array<Friend & { mutualFriends?: number }>>('/friends/suggestions');
  },

  async sendRequest(toUserId: string): Promise<FriendRequest> {
    return apiClient.post<FriendRequest>('/friends/request', { toUserId });
  },

  async getRequests(): Promise<FriendRequest[]> {
    return apiClient.get<FriendRequest[]>('/friends/requests');
  },

  async acceptRequest(requestId: string): Promise<void> {
    return apiClient.put(`/friends/request/${requestId}`, { action: 'accept' });
  },

  async declineRequest(requestId: string): Promise<void> {
    return apiClient.put(`/friends/request/${requestId}`, { action: 'decline' });
  },

  async removeFriend(userId: string): Promise<void> {
    return apiClient.delete(`/friends/${userId}`);
  },
};

