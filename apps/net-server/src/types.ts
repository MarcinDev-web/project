/**
 * Server-side types for project sharing.
 */

import type { SceneData } from '@engine/world';
import type { GameProjectConfig } from '@shared/types/project';

/**
 * Project metadata without the scene data.
 */
export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  marketplaceItemId?: string;
  description?: string;
}

/**
 * Complete project data including metadata and scene.
 */
export interface ProjectData {
  metadata: ProjectMetadata;
  scene: SceneData;
  config?: GameProjectConfig;
}

/**
 * Stored share entry in storage.
 */
export interface StoredShare {
  projectData: ProjectData;
  token: string;
  createdAt: number;
  expiresAt?: number;
}

/**
 * Request body for POST /api/share
 */
export interface ShareProjectRequest {
  projectId: string;
  projectData: ProjectData;
}

/**
 * Response for POST /api/share
 */
export interface ShareProjectResponse {
  token: string;
  url: string;
  expiresAt?: number;
}

/**
 * Response for GET /api/share/:token/metadata
 */
export interface ShareMetadataResponse {
  token: string;
  projectId: string;
  name: string;
  createdAt: number;
  expiresAt?: number;
}

