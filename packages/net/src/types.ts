/**
 * Types for project sharing functionality.
 * Uses type-only imports to avoid runtime dependencies on @engine/world.
 */

import type { SceneData } from '@engine/world';

/**
 * Project metadata without the scene data.
 */
export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string; // data URL of scene preview
}

/**
 * Complete project data including metadata and scene.
 * Matches the structure used in editor ProjectStorage.
 */
export interface ProjectData {
  metadata: ProjectMetadata;
  scene: SceneData;
}

/**
 * Share link response from server.
 */
export interface ShareLink {
  token: string;
  url: string;
  expiresAt?: number; // Optional expiry timestamp
}

/**
 * Shared project metadata (lightweight info).
 */
export interface SharedProjectMetadata {
  token: string;
  projectId: string;
  name: string;
  createdAt: number;
  expiresAt?: number;
}

