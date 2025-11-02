/**
 * User Profiles API calls
 */

import { apiClient } from './client';
import type { UserProfile, UpdateProfileRequest, AvatarLoadoutData } from '@shared/types/profiles';
import {
  validateProfileUpdate,
  hasValidationErrors,
  type ProfileValidationErrors,
} from '@shared/validation/profile';
import type { AvatarLoadout, AvatarSlot } from '@engine/avatar';

export type { UserProfile, UpdateProfileRequest };

/**
 * Convert AvatarLoadout (engine format) to AvatarLoadoutData (JSON-compatible)
 */
function loadoutToData(loadout: AvatarLoadout): AvatarLoadoutData {
  const parts: Record<string, { mesh: string; mat?: string; material?: string; colors?: Record<string, [number, number, number, number]> }> = {};
  
  for (const [slot, part] of Object.entries(loadout.parts || {})) {
    if (part) {
      parts[slot] = {
        mesh: part.mesh,
        ...(part.mat && { mat: part.mat }),
        ...(part.material && { material: part.material }),
        ...(part.colors && { colors: part.colors }),
      };
    }
  }
  
  return {
    version: loadout.version,
    parts,
  };
}

/**
 * Convert AvatarLoadoutData (JSON format) to AvatarLoadout (engine format)
 */
function dataToLoadout(data: AvatarLoadoutData): AvatarLoadout {
  const parts: Partial<Record<AvatarSlot, { mesh: string; mat?: string; material?: string; colors?: Record<string, [number, number, number, number]> }>> = {};
  
  for (const [slot, part] of Object.entries(data.parts || {})) {
    parts[slot as AvatarSlot] = {
      mesh: part.mesh,
      ...(part.mat && { mat: part.mat }),
      ...(part.material && { material: part.material }),
      ...(part.colors && { colors: part.colors }),
    };
  }
  
  return {
    version: data.version,
    parts,
  };
}

export class ProfileValidationError extends Error {
  constructor(public errors: ProfileValidationErrors) {
    const errorMessages = Object.values(errors).filter(Boolean);
    super(`Validation failed: ${errorMessages.join(', ')}`);
    this.name = 'ProfileValidationError';
  }
}

export const profilesApi = {
  async getProfile(userId: string): Promise<UserProfile> {
    return apiClient.get<UserProfile>(`/users/${userId}`);
  },

  async updateProfile(userId: string, updates: UpdateProfileRequest): Promise<UserProfile> {
    // Client-side validation
    const validationErrors = validateProfileUpdate(updates);
    if (hasValidationErrors(validationErrors)) {
      throw new ProfileValidationError(validationErrors);
    }

    try {
      return await apiClient.put<UserProfile>(`/users/${userId}`, updates);
    } catch (error) {
      // Handle server-side validation errors
      if (error instanceof Error && 'errors' in error) {
        const serverErrors = (error as { errors: ProfileValidationErrors }).errors;
        throw new ProfileValidationError(serverErrors);
      }
      throw error;
    }
  },

  async getUserBuilds(userId: string): Promise<import('./marketplace').MarketplaceItem[]> {
    return apiClient.get(`/users/${userId}/builds`);
  },

  /**
   * Save avatar loadout for a user
   */
  async saveAvatarLoadout(userId: string, loadout: AvatarLoadout): Promise<void> {
    const data = loadoutToData(loadout);
    await apiClient.put(`/users/${userId}/avatar-loadout`, data);
  },

  /**
   * Load avatar loadout for a user
   */
  async loadAvatarLoadout(userId: string): Promise<AvatarLoadout | null> {
    try {
      const data = await apiClient.get<AvatarLoadoutData>(`/users/${userId}/avatar-loadout`);
      return dataToLoadout(data);
    } catch (error) {
      // If loadout doesn't exist, return null instead of throwing
      if (error instanceof Error && 'message' in error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get social statistics for a user profile
   */
  async getSocialStats(userId: string): Promise<ProfileSocialStats> {
    return apiClient.get<ProfileSocialStats>(`/users/${userId}/social-stats`);
  },

  /**
   * Get user's forum activity (recent posts and threads)
   */
  async getUserForumActivity(userId: string, limit = 10): Promise<UserForumActivity> {
    const params = new URLSearchParams();
    if (limit) {
      params.append('limit', String(limit));
    }
    const query = params.toString();
    return apiClient.get<UserForumActivity>(`/users/${userId}/forum-activity${query ? `?${query}` : ''}`);
  },
};

/**
 * Social statistics for a user profile
 */
export interface ProfileSocialStats {
  friendsCount: number;
  forumThreadsCount: number;
  forumPostsCount: number;
  marketplaceBuildsCount: number;
  marketplaceLikesCount: number;
  marketplaceDownloadsCount: number;
  isFriend?: boolean;
  friendshipStatus?: 'none' | 'pending' | 'accepted';
  pendingRequestId?: string;
  isPendingFromCurrentUser?: boolean;
}

/**
 * User forum activity data
 */
export interface UserForumActivity {
  recentThreads: Array<{
    id: string;
    title: string;
    categoryId: string;
    categoryName?: string;
    postCount: number;
    createdAt: number;
    lastPostAt: number;
  }>;
  recentPosts: Array<{
    id: string;
    threadId: string;
    threadTitle: string;
    content: string;
    createdAt: number;
    score?: number;
  }>;
}

