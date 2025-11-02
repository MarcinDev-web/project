/**
 * Build Storage - stores actual project/scene data for marketplace builds
 */

import type { Pool, PoolClient } from 'pg';
import type { ProjectData } from '../types';

export class BuildStorage {
  constructor(private readonly pool: Pool) {}

  async initialize(): Promise<void> {
    // Schema is managed by ensureSchema() in db.ts
    // No additional initialization needed
  }

  /**
   * Save build data for a marketplace item
   */
  async saveBuild(marketplaceId: string, projectData: ProjectData, client?: PoolClient): Promise<void> {
    // Serialize ProjectData to JSON
    const jsonData = JSON.stringify(projectData);
    const buffer = Buffer.from(jsonData, 'utf-8');

    const queryClient = client ?? this.pool;

    await queryClient.query(
      `INSERT INTO marketplace_builds (marketplace_id, project_data, version, updated_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (marketplace_id) 
       DO UPDATE SET project_data = $2, version = marketplace_builds.version + 1, updated_at = NOW()`,
      [marketplaceId, buffer]
    );
  }

  /**
   * Get build data for a marketplace item
   */
  async getBuild(marketplaceId: string): Promise<ProjectData | null> {
    const result = await this.pool.query<{
      marketplace_id: string;
      project_data: Buffer;
      version: number;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM marketplace_builds WHERE marketplace_id = $1', [marketplaceId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0]!;
    
    try {
      // Deserialize JSON from BYTEA
      const jsonData = row.project_data.toString('utf-8');
      const projectData = JSON.parse(jsonData) as ProjectData;
      return projectData;
    } catch (error) {
      console.error(`Failed to deserialize build data for ${marketplaceId}:`, error);
      throw new Error(`Invalid build data format for ${marketplaceId}`);
    }
  }

  /**
   * Delete build data for a marketplace item
   */
  async deleteBuild(marketplaceId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM marketplace_builds WHERE marketplace_id = $1',
      [marketplaceId]
    );
  }

  /**
   * Get build version for a marketplace item
   */
  async getBuildVersion(marketplaceId: string): Promise<number | null> {
    const result = await this.pool.query<{ version: number }>(
      'SELECT version FROM marketplace_builds WHERE marketplace_id = $1',
      [marketplaceId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0]!.version;
  }

  /**
   * Check if build exists
   */
  async buildExists(marketplaceId: string): Promise<boolean> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM marketplace_builds WHERE marketplace_id = $1',
      [marketplaceId]
    );

    return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
  }
}
