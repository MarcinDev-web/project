/**
 * Studio Projects Storage - stores user projects for their game studio
 * Supports both PostgreSQL (preferred) and JSON file storage (fallback)
 */

import type { Pool } from 'pg';
import { promises as fs } from 'fs';
import path from 'path';
import type { ProjectData } from '../types';

export interface StudioProject {
  id: string;
  userId: string;
  name: string;
  description?: string;
  projectData: ProjectData;
  thumbnailUrl?: string;
  isPublished: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
  tags?: string[];
}

export interface StudioStats {
  userId: string;
  totalProjects: number;
  publishedProjects: number;
  totalViews: number;
  totalDownloads: number;
  totalLikes: number;
  studioRank?: number;
  lastUpdated: number;
}

export interface CreateStudioProjectRequest {
  name: string;
  description?: string;
  projectData: ProjectData;
  thumbnailUrl?: string;
  tags?: string[];
}

export interface UpdateStudioProjectRequest {
  name?: string;
  description?: string;
  projectData?: ProjectData;
  thumbnailUrl?: string;
  tags?: string[];
  isPublished?: boolean;
}

/**
 * PostgreSQL-based storage for studio projects
 */
export class StudioProjectsStorageDB {
  constructor(private readonly pool: Pool) {}

  async initialize(): Promise<void> {
    // Schema is managed by ensureSchema() in db.ts
  }

  async createProject(userId: string, data: CreateStudioProjectRequest): Promise<StudioProject> {
    const id = `studio_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const jsonData = JSON.stringify(data.projectData);
    const buffer = Buffer.from(jsonData, 'utf-8');

    await this.pool.query(
      `INSERT INTO user_projects (
        id, user_id, name, description, project_data, thumbnail_url, 
        is_published, version, tags, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [
        id,
        userId,
        data.name,
        data.description || null,
        buffer,
        data.thumbnailUrl || null,
        false,
        1,
        data.tags || [],
      ]
    );

    return this.getProject(userId, id) as Promise<StudioProject>;
  }

  async getProject(userId: string, projectId: string): Promise<StudioProject | null> {
    const result = await this.pool.query<{
      id: string;
      user_id: string;
      name: string;
      description: string | null;
      project_data: Buffer;
      thumbnail_url: string | null;
      is_published: boolean;
      version: number;
      tags: string[];
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM user_projects WHERE id = $1 AND user_id = $2', [projectId, userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0]!;
    try {
      const jsonData = row.project_data.toString('utf-8');
      const projectData = JSON.parse(jsonData) as ProjectData;
      const project: StudioProject = {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        projectData,
        isPublished: row.is_published,
        createdAt: row.created_at.getTime(),
        updatedAt: row.updated_at.getTime(),
        version: row.version,
      };
      
      if (row.description !== null) {
        project.description = row.description;
      }
      if (row.thumbnail_url !== null) {
        project.thumbnailUrl = row.thumbnail_url;
      }
      if (row.tags.length > 0) {
        project.tags = row.tags;
      }
      
      return project;
    } catch (error) {
      console.error(`Failed to deserialize project data for ${projectId}:`, error);
      throw new Error(`Invalid project data format for ${projectId}`);
    }
  }

  async listProjects(userId: string, options?: { limit?: number; offset?: number }): Promise<StudioProject[]> {
    let query = 'SELECT * FROM user_projects WHERE user_id = $1 ORDER BY updated_at DESC';
    const params: unknown[] = [userId];

    if (options?.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(options.limit);
    }
    if (options?.offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(options.offset);
    }

    const result = await this.pool.query<{
      id: string;
      user_id: string;
      name: string;
      description: string | null;
      project_data: Buffer;
      thumbnail_url: string | null;
      is_published: boolean;
      version: number;
      tags: string[];
      created_at: Date;
      updated_at: Date;
    }>(query, params);

    return result.rows.map((row) => {
      try {
        const jsonData = row.project_data.toString('utf-8');
        const projectData = JSON.parse(jsonData) as ProjectData;
        const project: StudioProject = {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          projectData,
          isPublished: row.is_published,
          createdAt: row.created_at.getTime(),
          updatedAt: row.updated_at.getTime(),
          version: row.version,
        };
        
        if (row.description !== null) {
          project.description = row.description;
        }
        if (row.thumbnail_url !== null) {
          project.thumbnailUrl = row.thumbnail_url;
        }
        if (row.tags.length > 0) {
          project.tags = row.tags;
        }
        
        return project;
      } catch (error) {
        console.error(`Failed to deserialize project ${row.id}:`, error);
        throw new Error(`Invalid project data format for ${row.id}`);
      }
    });
  }

  async updateProject(
    userId: string,
    projectId: string,
    updates: UpdateStudioProjectRequest
  ): Promise<StudioProject> {
    const existing = await this.getProject(userId, projectId);
    if (!existing) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updatesList: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updatesList.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      updatesList.push(`description = $${paramIndex++}`);
      params.push(updates.description || null);
    }
    if (updates.projectData !== undefined) {
      const jsonData = JSON.stringify(updates.projectData);
      const buffer = Buffer.from(jsonData, 'utf-8');
      updatesList.push(`project_data = $${paramIndex++}`);
      params.push(buffer);
      updatesList.push(`version = user_projects.version + 1`);
    }
    if (updates.thumbnailUrl !== undefined) {
      updatesList.push(`thumbnail_url = $${paramIndex++}`);
      params.push(updates.thumbnailUrl || null);
    }
    if (updates.isPublished !== undefined) {
      updatesList.push(`is_published = $${paramIndex++}`);
      params.push(updates.isPublished);
    }
    if (updates.tags !== undefined) {
      updatesList.push(`tags = $${paramIndex++}`);
      params.push(updates.tags);
    }

    if (updatesList.length === 0) {
      return existing;
    }

    updatesList.push(`updated_at = NOW()`);
    params.push(userId, projectId);

    await this.pool.query(
      `UPDATE user_projects SET ${updatesList.join(', ')} WHERE user_id = $${paramIndex++} AND id = $${paramIndex}`,
      params
    );

    return this.getProject(userId, projectId) as Promise<StudioProject>;
  }

  async deleteProject(userId: string, projectId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM user_projects WHERE id = $1 AND user_id = $2',
      [projectId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async countProjects(userId: string): Promise<{ total: number; published: number }> {
    const result = await this.pool.query<{ total: string; published: string }>(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_published = true) as published
      FROM user_projects WHERE user_id = $1`,
      [userId]
    );

    return {
      total: parseInt(result.rows[0]?.total ?? '0', 10),
      published: parseInt(result.rows[0]?.published ?? '0', 10),
    };
  }
}

/**
 * JSON file-based storage for studio projects (fallback)
 */
export class StudioProjectsStorage {
  private readonly dataDir: string;
  private readonly projectsFile: string;
  private cache: Record<string, Record<string, StudioProject>> | null = null;
  private cacheDirty = false;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.projectsFile = path.join(dataDir, 'studio-projects.json');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    try {
      await fs.access(this.projectsFile);
    } catch {
      await fs.writeFile(this.projectsFile, JSON.stringify({}, null, 2));
    }
    await this.readProjects();
  }

  private async readProjects(): Promise<Record<string, Record<string, StudioProject>>> {
    if (this.cache !== null && !this.cacheDirty) {
      return this.cache;
    }

    try {
      const data = await fs.readFile(this.projectsFile, 'utf-8');
      const projects = JSON.parse(data);
      this.cache = projects;
      this.cacheDirty = false;
      return projects;
    } catch {
      const empty = {};
      this.cache = empty;
      this.cacheDirty = false;
      return empty;
    }
  }

  private async writeProjects(projects: Record<string, Record<string, StudioProject>>): Promise<void> {
    const tmpFile = `${this.projectsFile}.tmp`;
    const content = JSON.stringify(projects, null, 2);
    await fs.writeFile(tmpFile, content, 'utf-8');
    await fs.rename(tmpFile, this.projectsFile);
    this.cache = { ...projects };
    this.cacheDirty = false;
  }

  async createProject(userId: string, data: CreateStudioProjectRequest): Promise<StudioProject> {
    const projects = await this.readProjects();
    if (!projects[userId]) {
      projects[userId] = {};
    }

    const id = `studio_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    const project: StudioProject = {
      id,
      userId,
      name: data.name,
      ...(data.description !== undefined && { description: data.description }),
      projectData: data.projectData,
      ...(data.thumbnailUrl !== undefined && { thumbnailUrl: data.thumbnailUrl }),
      isPublished: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
      ...(data.tags !== undefined && { tags: data.tags }),
    };

    projects[userId]![id] = project;
    await this.writeProjects(projects);

    return project;
  }

  async getProject(userId: string, projectId: string): Promise<StudioProject | null> {
    const projects = await this.readProjects();
    return projects[userId]?.[projectId] ?? null;
  }

  async listProjects(userId: string, options?: { limit?: number; offset?: number }): Promise<StudioProject[]> {
    const projects = await this.readProjects();
    const userProjects = Object.values(projects[userId] || {}).sort((a, b) => b.updatedAt - a.updatedAt);

    if (options?.offset) {
      return userProjects.slice(options.offset, options.limit ? options.offset + options.limit : undefined);
    }
    if (options?.limit) {
      return userProjects.slice(0, options.limit);
    }

    return userProjects;
  }

  async updateProject(
    userId: string,
    projectId: string,
    updates: UpdateStudioProjectRequest
  ): Promise<StudioProject> {
    const projects = await this.readProjects();
    const project = projects[userId]?.[projectId];
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updated: StudioProject = {
      ...project,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.projectData !== undefined && { projectData: updates.projectData, version: project.version + 1 }),
      ...(updates.thumbnailUrl !== undefined && { thumbnailUrl: updates.thumbnailUrl }),
      ...(updates.isPublished !== undefined && { isPublished: updates.isPublished }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
      updatedAt: Date.now(),
    };

    projects[userId]![projectId] = updated;
    await this.writeProjects(projects);

    return updated;
  }

  async deleteProject(userId: string, projectId: string): Promise<boolean> {
    const projects = await this.readProjects();
    if (projects[userId]?.[projectId]) {
      delete projects[userId]![projectId];
      if (Object.keys(projects[userId]!).length === 0) {
        delete projects[userId];
      }
      await this.writeProjects(projects);
      return true;
    }
    return false;
  }

  async countProjects(userId: string): Promise<{ total: number; published: number }> {
    const projects = await this.readProjects();
    const userProjects = Object.values(projects[userId] || {});
    return {
      total: userProjects.length,
      published: userProjects.filter((p) => p.isPublished).length,
    };
  }
}

