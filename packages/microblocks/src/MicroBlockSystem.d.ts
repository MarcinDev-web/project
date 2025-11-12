/**
 * MicroBlockSystem - ECS system that updates mesh geometry for micro block structures
 *
 * Monitors dirty chunks and regenerates meshes incrementally.
 */
import type { Scene } from '@engine/world';
import type { Entity } from '@engine/world';
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
export declare class MicroBlockSystem {
    private readonly scene;
    private readonly mesher;
    private readonly enableAutoUpdate;
    private readonly maxChunksPerFrame;
    constructor(scene: Scene, config?: MicroBlockSystemConfig);
    /**
     * Update system (called each frame)
     * @param deltaTime - Time since last frame in seconds
     */
    update(deltaTime: number): void;
    /**
     * Updates dirty chunks for an entity
     */
    private updateDirtyChunks;
    /**
     * Updates mesh component with combined chunk meshes
     */
    private updateMeshComponent;
    /**
     * Combines multiple chunk meshes into a single mesh
     */
    private combineChunkMeshes;
    /**
     * Force update all chunks for an entity
     */
    forceUpdate(entity: Entity): void;
    /**
     * Disposes system resources
     */
    dispose(): void;
}
//# sourceMappingURL=MicroBlockSystem.d.ts.map