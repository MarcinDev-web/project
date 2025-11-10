/**
 * Avatar Presets Storage - stores user avatar presets for studio
 * PostgreSQL-based storage
 */

import type { PrismaClient } from '../../node_modules/.prisma/net-client/index.js';

export interface AvatarPreset {
  id: string;
  userId: string;
  name: string;
  description?: string;
  avatarData: Record<string, unknown>; // AvatarLoadout serialized as JSON
  thumbnailUrl?: string;
  tags: string[];
  isPublished: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAvatarPresetRequest {
  name: string;
  description?: string;
  avatarData: Record<string, unknown>; // AvatarLoadout
  thumbnailUrl?: string;
  tags?: string[];
}

export interface UpdateAvatarPresetRequest {
  name?: string;
  description?: string;
  avatarData?: Record<string, unknown>; // AvatarLoadout
  thumbnailUrl?: string;
  tags?: string[];
  isPublished?: boolean;
}

/**
 * PostgreSQL-based storage for avatar presets
 */
export class AvatarStorage {
  constructor(private readonly prisma: PrismaClient) {}

  async initialize(): Promise<void> {
    // Schema is managed by ensureSchema() in db.ts
  }

  async createPreset(userId: string, data: CreateAvatarPresetRequest): Promise<AvatarPreset> {
    const id = `avatar_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const jsonData = JSON.stringify(data.avatarData);
    const buffer = Buffer.from(jsonData, 'utf-8');

    await this.prisma.userAvatarPreset.create({
      data: {
        id,
        userId,
        name: data.name,
        description: data.description ?? null,
        avatarData: buffer,
        thumbnailUrl: data.thumbnailUrl ?? null,
        tags: data.tags ?? [],
        isPublished: false,
      },
    });

    const preset = await this.getPreset(userId, id);
    if (!preset) {
      throw new Error('Failed to retrieve created preset');
    }
    return preset;
  }

  async getPreset(userId: string, presetId: string): Promise<AvatarPreset | null> {
    const preset = await this.prisma.userAvatarPreset.findUnique({
      where: {
        id: presetId,
        userId,
      },
    });

    if (!preset) {
      return null;
    }

    return this.mapToPreset(preset);
  }

  async getPresets(userId: string, includePublished = false): Promise<AvatarPreset[]> {
    const presets = await this.prisma.userAvatarPreset.findMany({
      where: {
        userId,
        ...(includePublished ? {} : { isPublished: false }),
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return presets.map((p) => this.mapToPreset(p));
  }

  async updatePreset(
    userId: string,
    presetId: string,
    updates: UpdateAvatarPresetRequest
  ): Promise<AvatarPreset> {
    const updateData: {
      name?: string;
      description?: string | null;
      avatarData?: Buffer;
      thumbnailUrl?: string | null;
      tags?: string[];
      isPublished?: boolean;
      updatedAt?: Date;
    } = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description ?? null;
    }
    if (updates.avatarData !== undefined) {
      const jsonData = JSON.stringify(updates.avatarData);
      updateData.avatarData = Buffer.from(jsonData, 'utf-8');
    }
    if (updates.thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = updates.thumbnailUrl ?? null;
    }
    if (updates.tags !== undefined) {
      updateData.tags = updates.tags;
    }
    if (updates.isPublished !== undefined) {
      updateData.isPublished = updates.isPublished;
    }
    updateData.updatedAt = new Date();

    await this.prisma.userAvatarPreset.update({
      where: {
        id: presetId,
        userId,
      },
      data: updateData,
    });

    const preset = await this.getPreset(userId, presetId);
    if (!preset) {
      throw new Error('Failed to retrieve updated preset');
    }
    return preset;
  }

  async deletePreset(userId: string, presetId: string): Promise<void> {
    await this.prisma.userAvatarPreset.delete({
      where: {
        id: presetId,
        userId,
      },
    });
  }

  private mapToPreset(preset: {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    avatarData: Buffer;
    thumbnailUrl: string | null;
    tags: string[];
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AvatarPreset {
    const jsonData = preset.avatarData.toString('utf-8');
    const avatarData = JSON.parse(jsonData) as Record<string, unknown>;

    const result: AvatarPreset = {
      id: preset.id,
      userId: preset.userId,
      name: preset.name,
      avatarData,
      tags: preset.tags,
      isPublished: preset.isPublished,
      createdAt: preset.createdAt.getTime(),
      updatedAt: preset.updatedAt.getTime(),
    };
    if (preset.description !== null) {
      result.description = preset.description;
    }
    if (preset.thumbnailUrl !== null) {
      result.thumbnailUrl = preset.thumbnailUrl;
    }
    return result;
  }
}

