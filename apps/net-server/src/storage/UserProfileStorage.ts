/**
 * User Profile Storage - extends user data with profile information
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { PublicUser } from '@shared/types/auth';
import type { UserProfile, UpdateProfileRequest } from '@shared/types/profiles';

export class UserProfileStorage {
  private readonly dataDir: string;
  private readonly profilesFile: string;
  private cache: Record<string, UserProfile> | null = null;
  private cacheDirty = false;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.profilesFile = path.join(dataDir, 'profiles.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });

    // Create empty profiles file if it doesn't exist
    try {
      await fs.access(this.profilesFile);
    } catch {
      await fs.writeFile(this.profilesFile, JSON.stringify({}, null, 2));
    }

    // Preload cache
    await this.readProfiles();
  }

  /**
   * Invalidate cache (call after external file modifications)
   */
  invalidateCache(): void {
    this.cacheDirty = true;
  }

  /**
   * Get multiple profiles efficiently (batch read)
   */
  async getProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
    const profiles = await this.readProfiles();
    const result = new Map<string, UserProfile>();

    for (const userId of userIds) {
      const profile = profiles[userId];
      if (profile) {
        result.set(userId, profile);
      }
    }

    return result;
  }

  private async readProfiles(): Promise<Record<string, UserProfile>> {
    // Return cached data if available and not dirty
    if (this.cache !== null && !this.cacheDirty) {
      return this.cache;
    }

    // Read from disk
    try {
      const data = await fs.readFile(this.profilesFile, 'utf-8');
      const profiles = JSON.parse(data);
      this.cache = profiles;
      this.cacheDirty = false;
      return profiles;
    } catch {
      const empty = {};
      this.cache = empty;
      this.cacheDirty = false;
      return empty;
    }
  }

  private async writeProfiles(profiles: Record<string, UserProfile>): Promise<void> {
    // Atomic write: write to temp file first, then rename
    const tmpFile = `${this.profilesFile}.tmp`;
    const content = JSON.stringify(profiles, null, 2);

    await fs.writeFile(tmpFile, content, 'utf-8');
    await fs.rename(tmpFile, this.profilesFile);

    // Update cache
    this.cache = { ...profiles };
    this.cacheDirty = false;
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const profiles = await this.readProfiles();
    return profiles[userId] ?? null;
  }

  async updateProfile(userId: string, updates: UpdateProfileRequest): Promise<UserProfile> {
    const profiles = await this.readProfiles();

    const existing = profiles[userId];

    // Get base user data if profile doesn't exist (fallback to creating new profile)
    if (!existing) {
      throw new Error(`Profile not found for user ${userId}. Create profile first.`);
    }

    // Merge updates: if field is present in updates (even if empty string), use it
    // Otherwise, keep existing value
    const profile: UserProfile = {
      id: userId,
      email: existing.email,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };

    // Copy existing optional properties
    if (existing.bio !== undefined) {
      profile.bio = existing.bio;
    }
    if (existing.avatarUrl !== undefined) {
      profile.avatarUrl = existing.avatarUrl;
    }
    if (existing.displayName !== undefined) {
      profile.displayName = existing.displayName;
    }
    if (existing.avatarLoadout !== undefined) {
      profile.avatarLoadout = existing.avatarLoadout;
    }

    // Apply updates
    if ('bio' in updates) {
      if (updates.bio !== undefined && updates.bio !== null) {
        profile.bio = updates.bio;
      } else {
        delete profile.bio;
      }
    }
    if ('avatarUrl' in updates) {
      if (updates.avatarUrl !== undefined && updates.avatarUrl !== null) {
        profile.avatarUrl = updates.avatarUrl;
      } else {
        delete profile.avatarUrl;
      }
    }
    if ('displayName' in updates) {
      if (updates.displayName !== undefined && updates.displayName !== null) {
        profile.displayName = updates.displayName;
      } else {
        delete profile.displayName;
      }
    }
    if ('avatarLoadout' in updates) {
      if (updates.avatarLoadout !== undefined && updates.avatarLoadout !== null) {
        profile.avatarLoadout = updates.avatarLoadout;
      } else {
        delete profile.avatarLoadout;
      }
    }

    profiles[userId] = profile;
    await this.writeProfiles(profiles);

    return profile;
  }

  async createProfile(user: PublicUser): Promise<UserProfile> {
    const profiles = await this.readProfiles();

    const existing = profiles[user.id];
    if (existing) {
      return existing;
    }

    const profile: UserProfile = {
      ...user,
      updatedAt: Date.now(),
    };

    profiles[user.id] = profile;
    await this.writeProfiles(profiles);

    return profile;
  }
}
