/**
 * Shared user profile types used by platform and net-server
 */

import type { PublicUser } from './auth';
// Note: AvatarLoadout is defined in @engine/avatar package
// We use a JSON-compatible structure for storage
export interface AvatarLoadoutData {
  version: number;
  parts: Record<string, {
    mesh: string;
    mat?: string;
    material?: string;
    colors?: Record<string, [number, number, number, number]>;
  }>;
}

export interface UserProfile extends PublicUser {
  bio?: string;
  avatarUrl?: string;
  displayName?: string;
  avatarLoadout?: AvatarLoadoutData;
  updatedAt: number;
}

export interface UpdateProfileRequest {
  bio?: string;
  avatarUrl?: string;
  displayName?: string;
  avatarLoadout?: AvatarLoadoutData;
}

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
  // Extended stats (only for own profile)
  blocksStats?: {
    saved: number;
    published: number;
    totalUses: number;
  };
  avatarsStats?: {
    savedPresets: number;
    published: number;
    totalDownloads: number;
    totalLikes: number;
  };
  marketplaceStats?: {
    buildsCount: number;
    avatarsCount: number;
    buildsLikes: number;
    buildsDownloads: number;
    avatarsLikes: number;
    avatarsDownloads: number;
  };
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

