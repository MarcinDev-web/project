/**
 * Bounding Volume Hierarchy (BVH)
 * 
 * Spatial acceleration structure for efficient broad-phase culling.
 * Uses AABB hierarchy with per-frame refit for dynamic scenes.
 */

import type { AABB } from '../physics/BoundingVolume';
import { BoundingVolume } from '../physics/BoundingVolume';

/**
 * BVH node
 */
interface BVHNode {
  /** Node AABB */
  bounds: AABB;
  /** Left child index (-1 for leaf) */
  left: number;
  /** Right child index (-1 for leaf) */
  right: number;
  /** Entity index (-1 for internal node) */
  entityIndex: number;
  /** Parent node index (-1 for root) */
  parent: number;
}

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
export class BVH {
  private nodes: BVHNode[] = [];
  private entries: BVHEntry[] = [];
  private rootIndex = -1;
  private nextNodeIndex = 0;
  private maxDepth = 16;

  /**
   * Builds the BVH from a list of entries.
   */
  build(entries: BVHEntry[]): void {
    this.entries = entries;
    this.nodes = [];
    this.nextNodeIndex = 0;

    if (entries.length === 0) {
      this.rootIndex = -1;
      return;
    }

    this.rootIndex = this.buildRecursive(0, entries.length, 0);
  }

  /**
   * Refits the BVH for dynamic scenes (assumes tree structure unchanged).
   */
  refit(): void {
    if (this.rootIndex === -1) return;
    this.refitRecursive(this.rootIndex);
  }

  /**
   * Queries the BVH for entries intersecting an AABB.
   */
  query(bounds: AABB, out: BVHEntry[]): BVHEntry[] {
    out.length = 0;
    if (this.rootIndex === -1) return out;
    this.queryRecursive(this.rootIndex, bounds, out);
    return out;
  }

  /**
   * Recursively builds the BVH tree.
   */
  private buildRecursive(start: number, end: number, depth: number): number {
    const count = end - start;
    if (count === 0) return -1;

    const nodeIndex = this.allocateNode();
    const node = this.nodes[nodeIndex]!;

    if (count === 1 || depth >= this.maxDepth) {
      // Leaf node
      const entry = this.entries[start]!;
      node.bounds = { ...entry.bounds };
      node.left = -1;
      node.right = -1;
      node.entityIndex = start;
      node.parent = -1;
      return nodeIndex;
    }

    // Calculate bounding box for all entries
    node.bounds = this.calculateBounds(start, end);

    // Find split axis (longest axis)
    const size = BoundingVolume.getSize(node.bounds);
    const splitAxis = size[0] >= size[1] && size[0] >= size[2] ? 0 : size[1] >= size[2] ? 1 : 2;

    // Sort entries by split axis
    this.sortEntries(start, end, splitAxis);

    // Split at median
    const mid = Math.floor((start + end) / 2);

    // Build children
    node.left = this.buildRecursive(start, mid, depth + 1);
    node.right = this.buildRecursive(mid, end, depth + 1);

    // Set parent for children
    if (node.left !== -1) this.nodes[node.left]!.parent = nodeIndex;
    if (node.right !== -1) this.nodes[node.right]!.parent = nodeIndex;

    node.entityIndex = -1;
    return nodeIndex;
  }

  /**
   * Recursively refits the BVH.
   */
  private refitRecursive(nodeIndex: number): void {
    const node = this.nodes[nodeIndex]!;
    if (node.left === -1 && node.right === -1) {
      // Leaf node: refit from entry
      if (node.entityIndex >= 0 && node.entityIndex < this.entries.length) {
        const entry = this.entries[node.entityIndex]!;
        node.bounds = { ...entry.bounds };
      }
      return;
    }

    // Internal node: refit children first
    if (node.left !== -1) this.refitRecursive(node.left);
    if (node.right !== -1) this.refitRecursive(node.right);

    // Merge children bounds
    const leftBounds = node.left !== -1 ? this.nodes[node.left]!.bounds : null;
    const rightBounds = node.right !== -1 ? this.nodes[node.right]!.bounds : null;

    if (leftBounds && rightBounds) {
      node.bounds = BoundingVolume.merge(leftBounds, rightBounds);
    } else if (leftBounds) {
      node.bounds = { ...leftBounds };
    } else if (rightBounds) {
      node.bounds = { ...rightBounds };
    }
  }

  /**
   * Recursively queries the BVH.
   */
  private queryRecursive(nodeIndex: number, bounds: AABB, out: BVHEntry[]): void {
    const node = this.nodes[nodeIndex]!;
    
    // Test intersection with node bounds
    if (!BoundingVolume.intersects(node.bounds, bounds)) {
      return;
    }

    // If leaf, add to results
    if (node.left === -1 && node.right === -1) {
      if (node.entityIndex >= 0 && node.entityIndex < this.entries.length) {
        out.push(this.entries[node.entityIndex]!);
      }
      return;
    }

    // Recurse into children
    if (node.left !== -1) this.queryRecursive(node.left, bounds, out);
    if (node.right !== -1) this.queryRecursive(node.right, bounds, out);
  }

  /**
   * Calculates bounding box for a range of entries.
   */
  private calculateBounds(start: number, end: number): AABB {
    if (start >= end) {
      return { min: [0, 0, 0], max: [0, 0, 0] };
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = start; i < end; i++) {
      const entry = this.entries[i]!;
      minX = Math.min(minX, entry.bounds.min[0]);
      minY = Math.min(minY, entry.bounds.min[1]);
      minZ = Math.min(minZ, entry.bounds.min[2]);
      maxX = Math.max(maxX, entry.bounds.max[0]);
      maxY = Math.max(maxY, entry.bounds.max[1]);
      maxZ = Math.max(maxZ, entry.bounds.max[2]);
    }

    return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
  }

  /**
   * Sorts entries by a specific axis.
   */
  private sortEntries(start: number, end: number, axis: number): void {
    // Simple insertion sort (acceptable for small ranges)
    for (let i = start + 1; i < end; i++) {
      const current = this.entries[i]!;
      const currentCenter = BoundingVolume.getCenter(current.bounds);
      let j = i - 1;

      while (j > start) {
        const prev = this.entries[j]!;
        const prevCenter = BoundingVolume.getCenter(prev.bounds);
        if (prevCenter[axis]! <= currentCenter[axis]!) break;
        this.entries[j + 1] = prev;
        j--;
      }
      this.entries[j + 1] = current;
    }
  }

  /**
   * Allocates a new node.
   */
  private allocateNode(): number {
    const index = this.nextNodeIndex++;
    if (index >= this.nodes.length) {
      this.nodes.push({
        bounds: { min: [0, 0, 0], max: [0, 0, 0] },
        left: -1,
        right: -1,
        entityIndex: -1,
        parent: -1,
      });
    }
    return index;
  }

  /**
   * Clears the BVH.
   */
  clear(): void {
    this.nodes = [];
    this.entries = [];
    this.rootIndex = -1;
    this.nextNodeIndex = 0;
  }

  /**
   * Gets statistics about the BVH.
   */
  getStats(): { nodeCount: number; entryCount: number; depth: number } {
    return {
      nodeCount: this.nodes.length,
      entryCount: this.entries.length,
      depth: this.calculateDepth(this.rootIndex),
    };
  }

  /**
   * Calculates tree depth.
   */
  private calculateDepth(nodeIndex: number): number {
    if (nodeIndex === -1) return 0;
    const node = this.nodes[nodeIndex]!;
    if (node.left === -1 && node.right === -1) return 1;
    return 1 + Math.max(this.calculateDepth(node.left), this.calculateDepth(node.right));
  }
}

