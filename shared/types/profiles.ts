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

