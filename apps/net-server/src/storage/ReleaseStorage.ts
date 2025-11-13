/**
 * Release Storage - manages release records
 */

import { promises as fs } from 'fs';
import path from 'path';

export interface Release {
  id: string;
  tag: string;
  version: string;
  type: 'major' | 'minor' | 'patch';
  status: 'pending' | 'running' | 'success' | 'failed';
  createdAt: number;
  createdBy?: string;
  changelog?: string;
  githubReleaseUrl?: string;
  workflowRunId?: string;
}

export class ReleaseStorage {
  private readonly dataDir: string;
  private readonly releasesFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.releasesFile = path.join(dataDir, 'releases.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });

    try {
      await fs.access(this.releasesFile);
    } catch {
      await fs.writeFile(this.releasesFile, JSON.stringify([], null, 2));
    }
  }

  private async readReleases(): Promise<Release[]> {
    try {
      const data = await fs.readFile(this.releasesFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeReleases(releases: Release[]): Promise<void> {
    await fs.writeFile(this.releasesFile, JSON.stringify(releases, null, 2));
  }

  /**
   * Get all releases
   */
  async getReleases(): Promise<Release[]> {
    const releases = await this.readReleases();
    // Sort by date (newest first)
    return releases.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get release by ID
   */
  async getRelease(id: string): Promise<Release | null> {
    const releases = await this.readReleases();
    return releases.find((r) => r.id === id) ?? null;
  }

  /**
   * Get release by tag
   */
  async getReleaseByTag(tag: string): Promise<Release | null> {
    const releases = await this.readReleases();
    return releases.find((r) => r.tag === tag) ?? null;
  }

  /**
   * Get release by workflow run ID
   */
  async getReleaseByWorkflowRunId(workflowRunId: string): Promise<Release | null> {
    const releases = await this.readReleases();
    return releases.find((r) => r.workflowRunId === workflowRunId) ?? null;
  }

  /**
   * Create a new release
   */
  async createRelease(release: Omit<Release, 'id'>): Promise<Release> {
    const releases = await this.readReleases();
    const newRelease: Release = {
      ...release,
      id: `release-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };
    releases.push(newRelease);
    await this.writeReleases(releases);
    return newRelease;
  }

  /**
   * Update release
   */
  async updateRelease(id: string, updates: Partial<Release>): Promise<Release | null> {
    const releases = await this.readReleases();
    const index = releases.findIndex((r) => r.id === id);
    if (index === -1) {
      return null;
    }
    releases[index] = { ...releases[index], ...updates };
    await this.writeReleases(releases);
    return releases[index];
  }

  /**
   * Update release by workflow run ID
   */
  async updateReleaseByWorkflowRunId(workflowRunId: string, updates: Partial<Release>): Promise<Release | null> {
    const releases = await this.readReleases();
    const index = releases.findIndex((r) => r.workflowRunId === workflowRunId);
    if (index === -1) {
      return null;
    }
    releases[index] = { ...releases[index], ...updates };
    await this.writeReleases(releases);
    return releases[index];
  }

  /**
   * Get release statistics
   */
  async getReleaseStats(): Promise<{
    total: number;
    byType: {
      major: number;
      minor: number;
      patch: number;
    };
    lastRelease?: {
      tag: string;
      version: string;
      createdAt: number;
    };
    currentVersion: string;
  }> {
    const releases = await this.readReleases();
    const successfulReleases = releases.filter((r) => r.status === 'success').sort((a, b) => b.createdAt - a.createdAt);

    const byType = {
      major: releases.filter((r) => r.type === 'major').length,
      minor: releases.filter((r) => r.type === 'minor').length,
      patch: releases.filter((r) => r.type === 'patch').length,
    };

    const lastRelease = successfulReleases.length > 0
      ? {
          tag: successfulReleases[0].tag,
          version: successfulReleases[0].version,
          createdAt: successfulReleases[0].createdAt,
        }
      : undefined;

    // Get current version from last successful release or default
    const currentVersion = lastRelease?.version ?? '0.1.0';

    return {
      total: releases.length,
      byType,
      lastRelease,
      currentVersion,
    };
  }
}

