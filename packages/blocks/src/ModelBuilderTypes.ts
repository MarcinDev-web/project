/**
 * Model Builder Types
 * 
 * Type definitions for the Model Builder system
 */

import type { Vec3 } from '@engine/core/math';
import type { LocalPos, RotationAxis, MicroBlockStoreData } from '@engine/microblocks';
import type { BlockDefinition } from './BlockLibrary';

/**
 * Build bounds configuration
 */
export interface BuildBounds {
  /** Minimum position (inclusive) */
  min: LocalPos;
  /** Maximum position (inclusive) */
  max: LocalPos;
}

/**
 * Tool mode for Model Builder
 */
export type ToolMode = 'place' | 'remove' | 'paint' | 'select';

/**
 * Configuration for ModelBuilder
 */
export interface ModelBuilderConfig {
  /** Build bounds (limits where blocks can be placed) */
  bounds: BuildBounds;
  /** Chunk size for MicroBlockStore (default: 16) */
  chunkSize?: number;
  /** Logger for debugging */
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (msg: string, error?: Error) => void;
  };
}

/**
 * Serialized model data
 */
export interface ModelData {
  /** Micro block store data */
  storeData: MicroBlockStoreData;
  /** Chunk size */
  chunkSize: number;
  /** Build bounds */
  bounds: BuildBounds;
  /** Metadata */
  metadata?: {
    name?: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

/**
 * Configuration for BlockDefinitionGenerator
 */
export interface BlockDefinitionConfig {
  /** Block ID (must be unique) */
  id: string;
  /** Block name */
  name: string;
  /** Block category */
  category: 'basic' | 'natural' | 'gameplay';
  /** Material type */
  material: 'solid' | 'glass' | 'metal' | 'wood' | 'stone' | 'plastic' | 'emissive';
  /** Override properties (optional) */
  properties?: Partial<BlockDefinition['properties']>;
}

/**
 * AABB representation (Axis-Aligned Bounding Box)
 */
export interface AABB {
  /** Minimum corner */
  min: Vec3;
  /** Maximum corner */
  max: Vec3;
}

