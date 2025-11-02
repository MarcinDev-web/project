/**
 * Studio Settings Storage - manages studio owner settings and preferences
 * Supports PostgreSQL (preferred) and JSON file fallback
 */

import type { Pool } from 'pg';
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
  constructor(private readonly pool: Pool) {}

  async initialize(): Promise<void> {
    // Schema ensured in ensureSchema()
  }

  private mapRow(row: {
    user_id: string;
    focus: string;
    goals: any;
    cadence_target: number | null;
    show_revenue: boolean;
    feature_flags: any;
    created_at: Date;
    updated_at: Date;
  }): StudioSettings {
    return {
      userId: row.user_id,
      focus: (row.focus as StudioFocus) ?? 'balanced',
      goals: (row.goals as StudioGoals) ?? {},
      cadenceTarget: row.cadence_target ?? 2,
      showRevenue: row.show_revenue,
      featureFlags: row.feature_flags ?? {},
      createdAt: row.created_at.getTime(),
      updatedAt: row.updated_at.getTime(),
    };
  }

  async get(userId: string): Promise<StudioSettings | null> {
    const result = await this.pool.query(
      'SELECT * FROM studio_settings WHERE user_id = $1',
      [userId]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]!);
  }

  async upsert(userId: string, updates: UpdateStudioSettingsRequest): Promise<StudioSettings> {
    const existing = await this.get(userId);
    if (!existing) {
      const result = await this.pool.query(
        `INSERT INTO studio_settings (user_id, focus, goals, cadence_target, show_revenue, feature_flags, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [
          userId,
          updates.focus ?? 'balanced',
          updates.goals ?? {},
          updates.cadenceTarget ?? 2,
          updates.showRevenue ?? true,
          updates.featureFlags ?? {},
        ]
      );
      return this.mapRow(result.rows[0]!);
    }

    const merged = {
      focus: updates.focus ?? existing.focus,
      goals: updates.goals ?? existing.goals,
      cadenceTarget: updates.cadenceTarget ?? existing.cadenceTarget,
      showRevenue: updates.showRevenue ?? existing.showRevenue,
      featureFlags: updates.featureFlags ?? existing.featureFlags ?? {},
    };

    const result = await this.pool.query(
      `UPDATE studio_settings
       SET focus = $1, goals = $2, cadence_target = $3, show_revenue = $4, feature_flags = $5, updated_at = NOW()
       WHERE user_id = $6
       RETURNING *`,
      [
        merged.focus,
        merged.goals,
        merged.cadenceTarget,
        merged.showRevenue,
        merged.featureFlags,
        userId,
      ]
    );
    return this.mapRow(result.rows[0]!);
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


