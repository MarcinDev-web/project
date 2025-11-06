/**
 * Bounding Volume Hierarchy (BVH)
 *
 * Spatial acceleration structure for efficient broad-phase culling.
 * Uses AABB hierarchy with per-frame refit for dynamic scenes.
 */
import type { AABB } from '../physics/BoundingVolume';
/**
 * BVH entry
 */
export interface BVHEntry {
    /** Entity identifier */
    id: number | string;
    /** Entity AABB */
    bounds: AABB;
}
/**
 * Bounding Volume Hierarchy for spatial queries.
 *
 * Uses a binary tree structure with AABBs. Supports per-frame refit
 * for dynamic scenes without full rebuild.
 */
export declare class BVH {
    private nodes;
    private entries;
    private rootIndex;
    private nextNodeIndex;
    private maxDepth;
    /**
     * Builds the BVH from a list of entries.
     */
    build(entries: BVHEntry[]): void;
    /**
     * Refits the BVH for dynamic scenes (assumes tree structure unchanged).
     */
    refit(): void;
    /**
     * Queries the BVH for entries intersecting an AABB.
     */
    query(bounds: AABB, out: BVHEntry[]): BVHEntry[];
    /**
     * Recursively builds the BVH tree.
     */
    private buildRecursive;
    /**
     * Recursively refits the BVH.
     */
    private refitRecursive;
    /**
     * Recursively queries the BVH.
     */
    private queryRecursive;
    /**
     * Calculates bounding box for a range of entries.
     */
    private calculateBounds;
    /**
     * Sorts entries by a specific axis.
     */
    private sortEntries;
    /**
     * Allocates a new node.
     */
    private allocateNode;
    /**
     * Clears the BVH.
     */
    clear(): void;
    /**
     * Gets statistics about the BVH.
     */
    getStats(): {
        nodeCount: number;
        entryCount: number;
        depth: number;
    };
    /**
     * Calculates tree depth.
     */
    private calculateDepth;
}
//# sourceMappingURL=BVH.d.ts.map