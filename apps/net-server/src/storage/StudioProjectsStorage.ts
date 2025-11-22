/**
 * Studio Projects Storage - stores user projects for their game studio
 * Supports both PostgreSQL (preferred) and JSON file storage (fallback)
 */

import { PrismaClient } from '@engine/database';
import { promises as fs } from 'fs';
import path from 'path';
import type { ProjectData } from '../types.js';

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
  constructor(private readonly prisma: PrismaClient) {}

  async initialize(): Promise<void> {
    // Schema is managed by ensureSchema() in db.ts
  }

  async createProject(userId: string, data: CreateStudioProjectRequest): Promise<StudioProject> {
    const id = `studio_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const jsonData = JSON.stringify(data.projectData);
    const buffer = Buffer.from(jsonData, 'utf-8');

    await this.prisma.project.create({
      data: {
        id,
        ownerId: userId,
        name: data.name,
        description: data.description ?? null,
        projectData: buffer,
        thumbnailUrl: data.thumbnailUrl ?? null,
        isPublished: false,
        version: 1,
        tags: data.tags ?? [],
      },
    });

    const project = await this.getProject(userId, id);
    if (!project) {
      throw new Error('Failed to retrieve created project');
    }
    return project;
  }

  async getProject(userId: string, projectId: string): Promise<StudioProject | null> {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId,
        ownerId: userId,
      },
    });

    if (!project) {
      return null;
    }

    try {
      const jsonData = project.projectData ? project.projectData.toString('utf-8') : '{}';
      const projectData = JSON.parse(jsonData) as ProjectData;
      const result: StudioProject = {
        id: project.id,
        userId: project.ownerId,
        name: project.name,
        projectData,
        isPublished: project.isPublished,
        createdAt: project.createdAt.getTime(),
        updatedAt: project.updatedAt.getTime(),
        version: project.version,
      };

      if (project.description !== null) {
        result.description = project.description;
      }
      if (project.thumbnailUrl !== null) {
        result.thumbnailUrl = project.thumbnailUrl;
      }
      if (project.tags.length > 0) {
        result.tags = project.tags;
      }

      return result;
    } catch (error) {
      console.error(`Failed to deserialize project data for ${projectId}:`, error);
      throw new Error(`Invalid project data format for ${projectId}`);
    }
  }

  async listProjects(
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<StudioProject[]> {
    const projects = await this.prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
      ...(options?.limit && { take: options.limit }),
      ...(options?.offset && { skip: options.offset }),
    });

    return projects.map(
      (project: {
        id: string;
        ownerId: string;
        name: string;
        description: string | null;
        thumbnailUrl: string | null;
        projectData: Buffer | null;
        isPublished: boolean;
        createdAt: Date;
        updatedAt: Date;
        version: number;
      }) => {
        try {
          const jsonData = project.projectData ? project.projectData.toString('utf-8') : '{}';
          const projectData = JSON.parse(jsonData) as ProjectData;
          const result: StudioProject = {
            id: project.id,
            userId: project.ownerId,
            name: project.name,
            projectData,
            isPublished: project.isPublished,
            createdAt: project.createdAt.getTime(),
            updatedAt: project.updatedAt.getTime(),
            version: project.version,
          };

          if (project.description !== null) {
            result.description = project.description;
          }
          if (project.thumbnailUrl !== null) {
            result.thumbnailUrl = project.thumbnailUrl;
          }

          return result;
        } catch (error) {
          console.error(`Failed to deserialize project ${project.id}:`, error);
          throw new Error(`Invalid project data format for ${project.id}`);
        }
      }
    );
  }

  async listPublishedProjectsGlobal(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    tags?: string[];
  }): Promise<StudioProject[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isPublished: true,
    };

    if (options?.tags && options.tags.length > 0) {
      where.tags = {
        hasSome: options.tags,
      };
    }

    if (options?.search && options.search.trim()) {
      const searchTerm = options.search.trim().toLowerCase();
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const take = options?.limit;
    const skip = options?.offset ?? 0;

    const projects = await this.prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      ...(take !== undefined ? { take } : {}),
      ...(skip ? { skip } : {}),
    });

    return projects.map((project) => {
      try {
        const jsonData = project.projectData ? project.projectData.toString('utf-8') : '{}';
        const projectData = JSON.parse(jsonData) as ProjectData;
        const result: StudioProject = {
          id: project.id,
          userId: project.ownerId,
          name: project.name,
          projectData,
          isPublished: project.isPublished,
          createdAt: project.createdAt.getTime(),
          updatedAt: project.updatedAt.getTime(),
          version: project.version,
        };

        if (project.description !== null) {
          result.description = project.description;
        }
        if (project.thumbnailUrl !== null) {
          result.thumbnailUrl = project.thumbnailUrl;
        }
        if (project.tags.length > 0) {
          result.tags = project.tags;
        }

        return result;
      } catch (error) {
        console.error(`Failed to deserialize project data for ${project.id}:`, error);
        throw new Error(`Invalid project data format for ${project.id}`);
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

    const updateData: {
      name?: string;
      description?: string | null;
      projectData?: Buffer;
      thumbnailUrl?: string | null;
      isPublished?: boolean;
      tags?: string[];
      version?: { increment: number };
    } = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description ?? null;
    }
    if (updates.projectData !== undefined) {
      const jsonData = JSON.stringify(updates.projectData);
      updateData.projectData = Buffer.from(jsonData, 'utf-8');
      updateData.version = { increment: 1 };
    }
    if (updates.thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = updates.thumbnailUrl ?? null;
    }
    if (updates.isPublished !== undefined) {
      updateData.isPublished = updates.isPublished;
    }
    if (updates.tags !== undefined) {
      updateData.tags = updates.tags;
    }

    if (Object.keys(updateData).length === 0) {
      return existing;
    }

    await this.prisma.project.update({
      where: {
        id: projectId,
        ownerId: userId,
      },
      data: updateData,
    });

    const updated = await this.getProject(userId, projectId);
    if (!updated) {
      throw new Error('Failed to retrieve updated project');
    }
    return updated;
  }

  async deleteProject(userId: string, projectId: string): Promise<boolean> {
    try {
      await this.prisma.project.delete({
        where: {
          id: projectId,
          ownerId: userId,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async countProjects(userId: string): Promise<{ total: number; published: number }> {
    const [total, published] = await Promise.all([
      this.prisma.project.count({
        where: { ownerId: userId },
      }),
      this.prisma.project.count({
        where: {
          ownerId: userId,
          isPublished: true,
        },
      }),
    ]);

    return { total, published };
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

  private async writeProjects(
    projects: Record<string, Record<string, StudioProject>>
  ): Promise<void> {
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

    projects[userId][id] = project;
    await this.writeProjects(projects);

    return project;
  }

  async getProject(userId: string, projectId: string): Promise<StudioProject | null> {
    const projects = await this.readProjects();
    return projects[userId]?.[projectId] ?? null;
  }

  async listProjects(
    userId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<StudioProject[]> {
    const projects = await this.readProjects();
    const userProjects = Object.values(projects[userId] || {}).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );

    if (options?.offset) {
      return userProjects.slice(
        options.offset,
        options.limit ? options.offset + options.limit : undefined
      );
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
      ...(updates.projectData !== undefined && {
        projectData: updates.projectData,
        version: project.version + 1,
      }),
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
      delete projects[userId][projectId];
      if (Object.keys(projects[userId]).length === 0) {
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

  async listPublishedProjectsGlobal(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    tags?: string[];
  }): Promise<StudioProject[]> {
    const projects = await this.readProjects();
    let allProjects = Object.values(projects).flatMap((userProjects) =>
      Object.values(userProjects)
    );

    allProjects = allProjects.filter((project) => project.isPublished);

    if (options?.tags && options.tags.length > 0) {
      const tagSet = new Set(options.tags.map((tag) => tag.toLowerCase()));
      allProjects = allProjects.filter((project) =>
        (project.tags || []).some((tag) => tagSet.has(tag.toLowerCase()))
      );
    }

    if (options?.search && options.search.trim()) {
      const searchTerm = options.search.trim().toLowerCase();
      allProjects = allProjects.filter((project) => {
        const nameMatch = project.name.toLowerCase().includes(searchTerm);
        const descriptionMatch = project.description
          ? project.description.toLowerCase().includes(searchTerm)
          : false;
        return nameMatch || descriptionMatch;
      });
    }

    allProjects.sort((a, b) => b.updatedAt - a.updatedAt);

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? allProjects.length;

    return allProjects.slice(offset, offset + limit);
  }
}


