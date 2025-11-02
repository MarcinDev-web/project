/**
 * Tests for friends API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { friendsApi } from '../friends';
import { apiClient } from '../client';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('friendsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets friends list', async () => {
    const mockFriends = [
      { id: 'user2', email: 'user2@test.com', isOnline: true },
    ];
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockFriends);

    const result = await friendsApi.getFriends();
    expect(result).toEqual(mockFriends);
    expect(apiClient.get).toHaveBeenCalledWith('/friends');
  });

  it('gets presence status', async () => {
    const mockPresence = { user1: true, user2: false };
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockPresence);

    const result = await friendsApi.getPresence();
    expect(result).toEqual(mockPresence);
    expect(apiClient.get).toHaveBeenCalledWith('/friends/presence');
  });

  it('gets friend suggestions', async () => {
    const mockSuggestions = [
      { id: 'user3', email: 'user3@test.com', mutualFriends: 2 },
    ];
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockSuggestions);

    const result = await friendsApi.getSuggestions();
    expect(result).toEqual(mockSuggestions);
    expect(apiClient.get).toHaveBeenCalledWith('/friends/suggestions');
  });

  it('sends friend request', async () => {
    const mockRequest = {
      id: 'req1',
      fromUserId: 'user1',
      toUserId: 'user2',
      status: 'pending',
      createdAt: Date.now(),
    };
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockRequest);

    const result = await friendsApi.sendRequest('user2');
    expect(result).toEqual(mockRequest);
    expect(apiClient.post).toHaveBeenCalledWith('/friends/request', { toUserId: 'user2' });
  });

  it('accepts friend request', async () => {
    (apiClient.put as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

    await friendsApi.acceptRequest('req1');
    expect(apiClient.put).toHaveBeenCalledWith('/friends/request/req1', { action: 'accept' });
  });
});

