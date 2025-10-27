/**
 * Octree - Spatial partitioning data structure for efficient broad-phase collision detection
 * Divides 3D space into octants recursively for fast spatial queries
 */
import type { Entity } from '../core/Entity';
import { type AABB } from './BoundingVolume';
/**
 * Entry stored in octree
 */
export interface OctreeEntry {
    entity: Entity;
    aabb: AABB;
}
/**
 * Octree configuration
 */
export interface OctreeConfig {
    /** Maximum number of entities per node before splitting */
    maxEntitiesPerNode: number;
    /** Maximum depth of the tree */
    maxDepth: number;
    /** Minimum node size (prevents infinite subdivision) */
    minNodeSize: number;
}
/**
 * Default octree configuration
 */
export declare const DEFAULT_OCTREE_CONFIG: OctreeConfig;
/**
 * Octree for spatial partitioning
 */
export declare class Octree {
    private root;
    private config;
    private entityMap;
    private nodeCount;
    private entityCount;
    constructor(bounds: AABB, config?: Partial<OctreeConfig>);
    /**
     * Clears all entities from the octree
     */
    clear(): void;
    /**
     * Inserts an entity into the octree
     */
    insert(entity: Entity, aabb: AABB): void;
    /**
     * Removes an entity from the octree
     */
    remove(entity: Entity): boolean;
    /**
     * Updates an entity's position in the octree
     */
    update(entity: Entity, newAABB: AABB): void;
    /**
     * Queries entities that intersect with the given AABB
     */
    query(aabb: AABB): Entity[];
    /**
     * Queries all entity pairs that might collide
     */
    queryPairs(): Array<[Entity, Entity]>;
    /**
     * Gets statistics about the octree
     */
    getStats(): {
        nodeCount: number;
        entityCount: number;
        maxDepth: number;
        avgEntitiesPerLeaf: number;
    };
    /**
     * Rebuilds the entire octree (useful after many updates)
     */
    rebuild(): void;
    /**
     * Internal: Inserts entry into a specific node
     */
    private insertIntoNode;
    /**
     * Internal: Removes entity from a specific node
     */
    private removeFromNode;
    /**
     * Internal: Queries entities in a node
     */
    private queryNode;
    /**
     * Internal: Collects potential collision pairs from a node
     */
    private collectPairsFromNode;
    /**
     * Internal: Checks if a node can be split
     */
    private canSplitNode;
    /**
     * Internal: Gets a unique key for an entity pair
     */
    private getPairKey;
}
//# sourceMappingURL=Octree.d.ts.map