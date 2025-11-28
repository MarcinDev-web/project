/**
 * Loose Octree - Spatial partitioning with expanded node bounds
 * 
 * Unlike standard octree, Loose Octree expands node boundaries by a "looseness" factor.
 * This allows objects to move slightly without requiring re-insertion, drastically
 * reducing update costs for dynamic scenes.
 * 
 * Key benefits:
 * - Objects can move within expanded bounds without restructuring
 * - Incremental updates: only re-insert when object leaves loose bounds
 * - O(1) amortized update cost for small movements
 * - Better cache locality due to fewer structural changes
 * 
 * Trade-off: Slightly more overlap between nodes = more false positives in queries
 * (mitigated by fine-phase AABB tests)
 * 
 * References:
 * - "Loose Octrees" by Thatcher Ulrich (Game Programming Gems)
 * - https://anteru.net/blog/2008/loose-octrees/
 */

import type { Entity } from '../core/Entity.js';
import { BoundingVolume, type AABB } from './BoundingVolume.js';

/**
 * Entry stored in loose octree with both tight and loose bounds
 */
export interface LooseOctreeEntry {
  entity: Entity;
  /** Tight AABB - actual object bounds */
  aabb: AABB;
  /** Node this entity belongs to (for O(1) removal) */
  nodeRef: LooseOctreeNode | null;
}

/**
 * Loose Octree node
 */
class LooseOctreeNode {
  /** Tight bounds (actual octant region) */
  tightBounds: AABB;
  /** Loose bounds (expanded for object overlap tolerance) */
  looseBounds: AABB;
  /** Entities in this node */
  entities: LooseOctreeEntry[] = [];
  /** Child nodes (8 octants) */
  children: LooseOctreeNode[] | null = null;
  /** Current depth */
  depth: number;
  /** Parent node */
  parent: LooseOctreeNode | null;
  /** Looseness factor (how much bounds are expanded) */
  looseness: number;

  constructor(
    tightBounds: AABB,
    depth: number,
    looseness: number,
    parent: LooseOctreeNode | null = null
  ) {
    this.tightBounds = tightBounds;
    this.looseness = looseness;
    this.depth = depth;
    this.parent = parent;
    this.looseBounds = this.computeLooseBounds(tightBounds, looseness);
  }

  /**
   * Computes loose bounds by expanding tight bounds by looseness factor
   */
  private computeLooseBounds(tight: AABB, looseness: number): AABB {
    const sizeX = tight.max[0] - tight.min[0];
    const sizeY = tight.max[1] - tight.min[1];
    const sizeZ = tight.max[2] - tight.min[2];
    
    // Expand by (looseness - 1) * size / 2 on each side
    const expandX = (sizeX * (looseness - 1)) / 2;
    const expandY = (sizeY * (looseness - 1)) / 2;
    const expandZ = (sizeZ * (looseness - 1)) / 2;
    
    return {
      min: [tight.min[0] - expandX, tight.min[1] - expandY, tight.min[2] - expandZ],
      max: [tight.max[0] + expandX, tight.max[1] + expandY, tight.max[2] + expandZ],
    };
  }

  isLeaf(): boolean {
    return this.children === null;
  }

  /**
   * Gets the octant index (0-7) for a point or center of AABB
   */
  getOctantIndex(point: [number, number, number]): number {
    const center = BoundingVolume.getCenter(this.tightBounds);
    let index = 0;
    if (point[0] >= center[0]) index |= 1;
    if (point[1] >= center[1]) index |= 2;
    if (point[2] >= center[2]) index |= 4;
    return index;
  }

  /**
   * Splits this node into 8 children
   */
  split(): void {
    if (!this.isLeaf()) return;

    const center = BoundingVolume.getCenter(this.tightBounds);
    const min = this.tightBounds.min;
    const max = this.tightBounds.max;

    const childBounds: AABB[] = [
      { min: [min[0], min[1], min[2]], max: [center[0], center[1], center[2]] }, // 0: ---
      { min: [center[0], min[1], min[2]], max: [max[0], center[1], center[2]] }, // 1: +--
      { min: [min[0], center[1], min[2]], max: [center[0], max[1], center[2]] }, // 2: -+-
      { min: [center[0], center[1], min[2]], max: [max[0], max[1], center[2]] }, // 3: ++-
      { min: [min[0], min[1], center[2]], max: [center[0], center[1], max[2]] }, // 4: --+
      { min: [center[0], min[1], center[2]], max: [max[0], center[1], max[2]] }, // 5: +--
      { min: [min[0], center[1], center[2]], max: [center[0], max[1], max[2]] }, // 6: -++
      { min: [center[0], center[1], center[2]], max: [max[0], max[1], max[2]] }, // 7: +++
    ];

    this.children = childBounds.map(
      (bounds) => new LooseOctreeNode(bounds, this.depth + 1, this.looseness, this)
    );

    // Re-insert entities into appropriate children
    for (const entry of this.entities) {
      this.insertIntoChildren(entry);
    }
    this.entities = [];
  }

  /**
   * Inserts entry into appropriate child based on AABB center
   */
  private insertIntoChildren(entry: LooseOctreeEntry): void {
    if (!this.children) return;
    
    const center = BoundingVolume.getCenter(entry.aabb);
    const octant = this.getOctantIndex(center);
    const child = this.children[octant]!;
    
    child.entities.push(entry);
    entry.nodeRef = child;
  }
}

/**
 * Loose Octree configuration
 */
export interface LooseOctreeConfig {
  /** Maximum entities per node before splitting */
  maxEntitiesPerNode: number;
  /** Maximum tree depth */
  maxDepth: number;
  /** Minimum node size (prevents infinite subdivision) */
  minNodeSize: number;
  /** Looseness factor (2.0 = double size bounds) */
  looseness: number;
}

const DEFAULT_CONFIG: LooseOctreeConfig = {
  maxEntitiesPerNode: 8,
  maxDepth: 6,
  minNodeSize: 1.0,
  looseness: 2.0, // Standard loose octree factor
};

/**
 * Loose Octree for efficient spatial queries with dynamic objects
 */
export class LooseOctree {
  private root: LooseOctreeNode;
  private config: LooseOctreeConfig;
  private entityMap = new Map<Entity, LooseOctreeEntry>();
  private nodeCount = 1;
  private entityCount = 0;
  
  /** Stats for monitoring */
  private stats = {
    insertCount: 0,
    updateCount: 0,
    reinsertCount: 0, // Updates that required actual re-insertion
    queryCount: 0,
  };

  constructor(bounds: AABB, config: Partial<LooseOctreeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.root = new LooseOctreeNode(bounds, 0, this.config.looseness);
  }

  /**
   * Clears all entities
   */
  clear(): void {
    this.root = new LooseOctreeNode(this.root.tightBounds, 0, this.config.looseness);
    this.entityMap.clear();
    this.nodeCount = 1;
    this.entityCount = 0;
    this.stats = { insertCount: 0, updateCount: 0, reinsertCount: 0, queryCount: 0 };
  }

  /**
   * Inserts an entity
   */
  insert(entity: Entity, aabb: AABB): void {
    const existing = this.entityMap.get(entity);
    if (existing) {
      this.update(entity, aabb);
      return;
    }

    const entry: LooseOctreeEntry = { entity, aabb, nodeRef: null };
    this.entityMap.set(entity, entry);
    this.entityCount++;
    this.stats.insertCount++;
    
    this.insertIntoNode(this.root, entry);
  }

  /**
   * Removes an entity
   */
  remove(entity: Entity): boolean {
    const entry = this.entityMap.get(entity);
    if (!entry) return false;

    // O(1) removal using node reference
    if (entry.nodeRef) {
      const idx = entry.nodeRef.entities.indexOf(entry);
      if (idx !== -1) {
        // Swap with last element for O(1) removal
        const last = entry.nodeRef.entities.pop()!;
        if (idx < entry.nodeRef.entities.length) {
          entry.nodeRef.entities[idx] = last;
        }
      }
    }

    this.entityMap.delete(entity);
    this.entityCount--;
    return true;
  }

  /**
   * Updates entity position - KEY OPTIMIZATION
   * Only re-inserts if object left its node's loose bounds
   */
  update(entity: Entity, newAABB: AABB): void {
    const entry = this.entityMap.get(entity);
    if (!entry) {
      this.insert(entity, newAABB);
      return;
    }

    this.stats.updateCount++;

    // Check if still within current node's loose bounds
    if (entry.nodeRef && BoundingVolume.contains(entry.nodeRef.looseBounds, newAABB)) {
      // Fast path: just update AABB, no structural change
      entry.aabb = newAABB;
      return;
    }

    // Slow path: need to re-insert
    this.stats.reinsertCount++;
    this.remove(entity);
    this.insert(entity, newAABB);
  }

  /**
   * Batch update - more efficient for many updates
   */
  batchUpdate(updates: Array<{ entity: Entity; aabb: AABB }>): void {
    // Separate fast and slow path updates
    const reinserts: typeof updates = [];
    
    for (const { entity, aabb } of updates) {
      const entry = this.entityMap.get(entity);
      if (!entry) {
        reinserts.push({ entity, aabb });
        continue;
      }

      this.stats.updateCount++;
      
      if (entry.nodeRef && BoundingVolume.contains(entry.nodeRef.looseBounds, aabb)) {
        // Fast path
        entry.aabb = aabb;
      } else {
        // Mark for re-insertion
        reinserts.push({ entity, aabb });
      }
    }

    // Process re-inserts in batch
    for (const { entity, aabb } of reinserts) {
      this.stats.reinsertCount++;
      this.remove(entity);
      this.insert(entity, aabb);
    }
  }

  /**
   * Queries entities intersecting AABB
   */
  query(aabb: AABB): Entity[] {
    this.stats.queryCount++;
    const results = new Set<Entity>();
    this.queryNode(this.root, aabb, results);
    return Array.from(results);
  }

  /**
   * Queries entities - writes to provided array (avoids allocation)
   */
  queryToArray(aabb: AABB, out: Entity[]): Entity[] {
    this.stats.queryCount++;
    out.length = 0;
    const seen = new Set<Entity>();
    this.queryNodeToArray(this.root, aabb, out, seen);
    return out;
  }

  /**
   * Gets statistics
   */
  getStats() {
    const reinsertRatio = this.stats.updateCount > 0 
      ? this.stats.reinsertCount / this.stats.updateCount 
      : 0;
    
    return {
      ...this.stats,
      nodeCount: this.nodeCount,
      entityCount: this.entityCount,
      reinsertRatio, // Lower is better (indicates looseness is effective)
    };
  }

  /**
   * Resets performance stats
   */
  resetStats(): void {
    this.stats = { insertCount: 0, updateCount: 0, reinsertCount: 0, queryCount: 0 };
  }

  // ==================== Internal Methods ====================

  private insertIntoNode(node: LooseOctreeNode, entry: LooseOctreeEntry): void {
    // Check loose bounds intersection
    if (!BoundingVolume.intersects(entry.aabb, node.looseBounds)) {
      return;
    }

    if (node.isLeaf()) {
      node.entities.push(entry);
      entry.nodeRef = node;

      // Check if should split
      if (
        node.entities.length > this.config.maxEntitiesPerNode &&
        node.depth < this.config.maxDepth &&
        this.canSplit(node)
      ) {
        node.split();
        this.nodeCount += 8;
      }
    } else if (node.children) {
      // Find best child based on center
      const center = BoundingVolume.getCenter(entry.aabb);
      const octant = node.getOctantIndex(center);
      this.insertIntoNode(node.children[octant]!, entry);
    }
  }

  private canSplit(node: LooseOctreeNode): boolean {
    const size = BoundingVolume.getSize(node.tightBounds);
    const minDim = Math.min(size[0], size[1], size[2]);
    return minDim > this.config.minNodeSize * 2;
  }

  private queryNode(node: LooseOctreeNode, aabb: AABB, results: Set<Entity>): void {
    // Check loose bounds first (broad phase)
    if (!BoundingVolume.intersects(aabb, node.looseBounds)) {
      return;
    }

    // Check entities in this node
    for (const entry of node.entities) {
      if (BoundingVolume.intersects(aabb, entry.aabb)) {
        results.add(entry.entity);
      }
    }

    // Recurse to children
    if (node.children) {
      for (const child of node.children) {
        this.queryNode(child, aabb, results);
      }
    }
  }

  private queryNodeToArray(
    node: LooseOctreeNode,
    aabb: AABB,
    out: Entity[],
    seen: Set<Entity>
  ): void {
    if (!BoundingVolume.intersects(aabb, node.looseBounds)) {
      return;
    }

    for (const entry of node.entities) {
      if (!seen.has(entry.entity) && BoundingVolume.intersects(aabb, entry.aabb)) {
        seen.add(entry.entity);
        out.push(entry.entity);
      }
    }

    if (node.children) {
      for (const child of node.children) {
        this.queryNodeToArray(child, aabb, out, seen);
      }
    }
  }
}

