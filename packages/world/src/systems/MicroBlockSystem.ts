/**
 * MicroBlockSystem - ECS system that updates mesh geometry for micro block structures
 *
 * Monitors dirty chunks and regenerates meshes incrementally.
 */

import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { MicroBlockComponent } from '../components/MicroBlockComponent.js';
import { MeshComponent } from '../components/MeshComponent.js';
import { MicroBlockMesher } from '../utils/MicroBlockMesher.js';
import { MICRO_BLOCK_SIZE, DEFAULT_CHUNK_SIZE } from '@engine/microblocks';

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
      chunk.mesh = meshData as unknown as import('@engine/microblocks').MicroBlockMeshData;
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
    const { mesh, bounds } = this.combineChunkMeshes(allChunks);

    // Update mesh component
    meshComponent.meshType = 'custom';
    meshComponent.meshData = mesh;
    meshComponent.localAABB = bounds;
  }

  /**
   * Combines multiple chunk meshes into a single mesh
   */
  private combineChunkMeshes(
    chunks: Array<import('@engine/microblocks').MicroBlockChunk>
  ): { mesh: import('../components/MeshComponent.js').CustomMeshData; bounds: { min: [number, number, number]; max: [number, number, number] } } {
    const allVertices: number[] = [];
    const allIndices: number[] = [];
    let vertexOffset = 0;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    const chunkSize = DEFAULT_CHUNK_SIZE;
    const blockSize = MICRO_BLOCK_SIZE;
    const chunkWorldSize = chunkSize * blockSize;

    for (const chunk of chunks) {
      if (!chunk.mesh) continue;

      const vertices = chunk.mesh.vertices;
      const indices = chunk.mesh.indices;

      if (!vertices || !indices) continue;

      // Convert TypedArray to regular array for combination
      const vertexArray = Array.from(vertices);
      const indexArray = Array.from(indices);

      // Calculate chunk offset
      const offsetX = chunk.coord[0] * chunkWorldSize;
      const offsetY = chunk.coord[1] * chunkWorldSize;
      const offsetZ = chunk.coord[2] * chunkWorldSize;

      // Update bounds and apply offset to vertices
      for (let i = 0; i < vertexArray.length; i += 6) {
        // Apply chunk offset to position
        vertexArray[i] = (vertexArray[i] ?? 0) + offsetX;
        vertexArray[i + 1] = (vertexArray[i + 1] ?? 0) + offsetY;
        vertexArray[i + 2] = (vertexArray[i + 2] ?? 0) + offsetZ;

        const x = vertexArray[i];
        const y = vertexArray[i + 1];
        const z = vertexArray[i + 2];
        
        if (x === undefined || y === undefined || z === undefined) continue;
        
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }

      // Add vertices
      allVertices.push(...vertexArray);

      // Add indices with offset
      for (const index of indexArray) {
        allIndices.push(index + vertexOffset);
      }

      // Update offset
      vertexOffset += vertexArray.length / 6; // Each vertex has 6 components (x, y, z, nx, ny, nz)
    }

    // Default bounds if mesh is empty
    if (minX === Infinity) {
      minX = -0.5; minY = -0.5; minZ = -0.5;
      maxX = 0.5; maxY = 0.5; maxZ = 0.5;
    }

    return {
      mesh: {
        vertices: new Float32Array(allVertices),
        indices: new Uint16Array(allIndices),
      },
      bounds: {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ],
      },
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
