/**
 * MicroBlockSystem - ECS system that updates mesh geometry for micro block structures
 *
 * Monitors dirty chunks and regenerates meshes incrementally.
 */

import type { Scene } from '@engine/world';
import type { Entity } from '@engine/world';
import { MicroBlockComponent } from './MicroBlockComponent';
import { MeshComponent } from '@engine/world';
import { MicroBlockMesher } from './MicroBlockMesher';
import { MICRO_BLOCK_SIZE, DEFAULT_CHUNK_SIZE } from './MicroBlockStore';

/**
 * Configuration for MicroBlockSystem
 */
export interface MicroBlockSystemConfig {
  /** Enable automatic mesh updates */
  enableAutoUpdate?: boolean;
  /** Max chunks to update per frame (for performance) */
  maxChunksPerFrame?: number;
}

/**
 * ECS system that manages micro block mesh generation
 */
export class MicroBlockSystem {
  private readonly scene: Scene;
  private readonly mesher: MicroBlockMesher;
  private readonly enableAutoUpdate: boolean;
  private readonly maxChunksPerFrame: number;

  constructor(scene: Scene, config?: MicroBlockSystemConfig) {
    this.scene = scene;
    this.mesher = new MicroBlockMesher(MICRO_BLOCK_SIZE, DEFAULT_CHUNK_SIZE);
    this.enableAutoUpdate = config?.enableAutoUpdate ?? true;
    this.maxChunksPerFrame = config?.maxChunksPerFrame ?? 5;
  }

  /**
   * Update system (called each frame)
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!this.enableAutoUpdate) return;
    if (!(deltaTime > 0)) return;

    // Query entities with MicroBlockComponent
    const entities = this.scene.queryEntities(MicroBlockComponent);

    for (const entity of entities) {
      const component = entity.getComponent(MicroBlockComponent);
      if (!component) continue;

      // Update dirty chunks
      this.updateDirtyChunks(entity, component);
    }
  }

  /**
   * Updates dirty chunks for an entity
   */
  private updateDirtyChunks(entity: Entity, component: MicroBlockComponent): void {
    const dirtyChunks = component.store.getDirtyChunks();
    
    if (dirtyChunks.length === 0) return;

    // Limit updates per frame for performance
    const chunksToUpdate = dirtyChunks.slice(0, this.maxChunksPerFrame);

    let hasValidMesh = false;

    for (const chunk of chunksToUpdate) {
      // Generate mesh for chunk
      const meshData = this.mesher.generateMesh(chunk);
      
      // Store mesh in chunk
      chunk.mesh = meshData;
      chunk.dirty = false;

      hasValidMesh = true;
    }

    // Update mesh component if we have valid mesh data
    if (hasValidMesh) {
      this.updateMeshComponent(entity, component);
    }

    // Mark remaining chunks as still dirty (will be processed next frame)
    // Note: chunks beyond maxChunksPerFrame remain dirty and will be processed in subsequent frames
    void dirtyChunks.slice(this.maxChunksPerFrame);
  }

  /**
   * Updates mesh component with combined chunk meshes
   */
  private updateMeshComponent(entity: Entity, component: MicroBlockComponent): void {
    let meshComponent = entity.getComponent(MeshComponent);
    
    if (!meshComponent) {
      meshComponent = new MeshComponent();
      entity.addComponent(meshComponent);
    }

    // Combine all chunk meshes into one
    const allChunks = component.store.getAllChunks();
    const combinedMesh = this.combineChunkMeshes(allChunks);

    // Update mesh component
    meshComponent.meshType = 'custom';
    meshComponent.meshData = combinedMesh;
  }

  /**
   * Combines multiple chunk meshes into a single mesh
   */
  private combineChunkMeshes(
    chunks: Array<import('./types').MicroBlockChunk>
  ): import('@engine/world').CustomMeshData {
    const allVertices: number[] = [];
    const allIndices: number[] = [];
    let vertexOffset = 0;

    for (const chunk of chunks) {
      if (!chunk.mesh) continue;

      const vertices = chunk.mesh.vertices;
      const indices = chunk.mesh.indices;

      if (!vertices || !indices) continue;

      // Convert TypedArray to regular array for combination
      const vertexArray = Array.from(vertices);
      const indexArray = Array.from(indices);

      // Add vertices
      allVertices.push(...vertexArray);

      // Add indices with offset
      for (const index of indexArray) {
        allIndices.push(index + vertexOffset);
      }

      // Update offset
      vertexOffset += vertexArray.length / 6; // Each vertex has 6 components (x, y, z, nx, ny, nz)
    }

    return {
      vertices: new Float32Array(allVertices),
      indices: new Uint16Array(allIndices),
    };
  }

  /**
   * Force update all chunks for an entity
   */
  forceUpdate(entity: Entity): void {
    const component = entity.getComponent(MicroBlockComponent);
    if (!component) return;

    // Mark all chunks as dirty
    const chunks = component.store.getAllChunks();
    for (const chunk of chunks) {
      component.store.markChunkDirty(chunk.coord);
    }

    // Update immediately
    this.updateDirtyChunks(entity, component);
  }

  /**
   * Disposes system resources
   */
  dispose(): void {
    this.mesher.dispose();
  }
}

