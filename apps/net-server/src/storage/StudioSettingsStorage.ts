/**
 * Studio Settings Storage - manages studio owner settings and preferences
 * Supports PostgreSQL (preferred) and JSON file fallback
 */

import type { PrismaClient } from '../../node_modules/.prisma/net-client/index.js';
import { promises as fs } from 'fs';
import path from 'path';

export type StudioFocus = 'games' | 'assets' | 'balanced';

export interface StudioGoals {
  monthlyRevenueTarget?: number; // in smallest currency unit or float depending on pricing model
  monthlyReleasesTarget?: number; // number of releases per month
  monthlyUpdatesTarget?: number; // number of updates per month
}

export interface StudioSettings {
  userId: string;
  focus: StudioFocus;
  goals: StudioGoals;
  cadenceTarget: number; // target updates per month
  showRevenue: boolean;
  featureFlags?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface UpdateStudioSettingsRequest {
  focus?: StudioFocus;
  goals?: StudioGoals;
  cadenceTarget?: number;
  showRevenue?: boolean;
  featureFlags?: Record<string, unknown>;
}

export class StudioSettingsStorageDB {
  constructor(private readonly prisma: PrismaClient) {}

  async initialize(): Promise<void> {
    // Schema ensured in ensureSchema()
  }

  async get(userId: string): Promise<StudioSettings | null> {
    const settings = await this.prisma.studioSetting.findUnique({
      where: { userId },
    });

    if (!settings) return null;

    return {
      userId: settings.userId,
      focus: (settings.focus as StudioFocus) ?? 'balanced',
      goals: (settings.goals as StudioGoals) ?? {},
      cadenceTarget: settings.cadenceTarget ?? 2,
      showRevenue: settings.showRevenue,
      featureFlags: (settings.featureFlags as Record<string, unknown>) ?? {},
      createdAt: settings.createdAt.getTime(),
      updatedAt: settings.updatedAt.getTime(),
    };
  }

  async upsert(userId: string, updates: UpdateStudioSettingsRequest): Promise<StudioSettings> {
    const existing = await this.get(userId);

    const merged = {
      focus: updates.focus ?? existing?.focus ?? 'balanced',
      goals: updates.goals ?? existing?.goals ?? {},
      cadenceTarget: updates.cadenceTarget ?? existing?.cadenceTarget ?? 2,
      showRevenue: updates.showRevenue ?? existing?.showRevenue ?? true,
      featureFlags: updates.featureFlags ?? existing?.featureFlags ?? {},
    };

    const settings = await this.prisma.studioSetting.upsert({
      where: { userId },
      create: {
        userId,
        focus: merged.focus,
        goals: merged.goals as any,
        cadenceTarget: merged.cadenceTarget,
        showRevenue: merged.showRevenue,
        featureFlags: merged.featureFlags as any,
      },
      update: {
        focus: merged.focus,
        goals: merged.goals as any,
        cadenceTarget: merged.cadenceTarget,
        showRevenue: merged.showRevenue,
        featureFlags: merged.featureFlags as any,
      },
    });

    return {
      userId: settings.userId,
      focus: (settings.focus as StudioFocus) ?? 'balanced',
      goals: (settings.goals as StudioGoals) ?? {},
      cadenceTarget: settings.cadenceTarget ?? 2,
      showRevenue: settings.showRevenue,
      featureFlags: (settings.featureFlags as Record<string, unknown>) ?? {},
      createdAt: settings.createdAt.getTime(),
      updatedAt: settings.updatedAt.getTime(),
    };
  }
}

export class StudioSettingsStorage {
  private readonly settingsFile: string;

  constructor(private readonly dataDir: string) {
    this.settingsFile = path.join(dataDir, 'studio-settings.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      await fs.access(this.settingsFile);
    } catch {
      await fs.writeFile(this.settingsFile, JSON.stringify({}, null, 2));
    }
  }

  private async readAll(): Promise<Record<string, StudioSettings>> {
    try {
      const txt = await fs.readFile(this.settingsFile, 'utf-8');
      return JSON.parse(txt);
    } catch {
      return {};
    }
  }

  private async writeAll(all: Record<string, StudioSettings>): Promise<void> {
    await fs.writeFile(this.settingsFile, JSON.stringify(all, null, 2));
  }

  async get(userId: string): Promise<StudioSettings | null> {
    const all = await this.readAll();
    return all[userId] || null;
  }

  async upsert(userId: string, updates: UpdateStudioSettingsRequest): Promise<StudioSettings> {
    const all = await this.readAll();
    const now = Date.now();
    const existing = all[userId];
    const next: StudioSettings = existing
      ? {
          ...existing,
          ...updates,
          goals: updates.goals ?? existing.goals ?? {},
          featureFlags: updates.featureFlags ?? existing.featureFlags ?? {},
          updatedAt: now,
        }
      : {
          userId,
          focus: updates.focus ?? 'balanced',
          goals: updates.goals ?? {},
          cadenceTarget: updates.cadenceTarget ?? 2,
          showRevenue: updates.showRevenue ?? true,
          featureFlags: updates.featureFlags ?? {},
          createdAt: now,
          updatedAt: now,
        };
    all[userId] = next;
    await this.writeAll(all);
    return next;
  }
}


