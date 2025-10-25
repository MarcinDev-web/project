/**
 * Octree - Spatial partitioning data structure for efficient broad-phase collision detection
 * Divides 3D space into octants recursively for fast spatial queries
 */

import type { Entity } from '@engine/world';
import { BoundingVolume, type AABB } from './BoundingVolume';

/**
 * Entry stored in octree
 */
export interface OctreeEntry {
  entity: Entity;
  aabb: AABB;
}

/**
 * Octree node for spatial partitioning
 */
class OctreeNode {
  /** Bounding box of this node */
  bounds: AABB;
  /** Entities stored in this node (only leaf nodes store entities) */
  entities: OctreeEntry[] = [];
  /** Child nodes (8 octants) - null if leaf node */
  children: OctreeNode[] | null = null;
  /** Current depth in tree */
  depth: number;
  /** Parent node */
  parent: OctreeNode | null;

  constructor(bounds: AABB, depth: number, parent: OctreeNode | null = null) {
    this.bounds = bounds;
    this.depth = depth;
    this.parent = parent;
  }

  /**
   * Checks if this is a leaf node (no children)
   */
  isLeaf(): boolean {
    return this.children === null;
  }

  /**
   * Splits this node into 8 children (octants)
   */
  split(): void {
    if (!this.isLeaf()) return;

    const center = BoundingVolume.getCenter(this.bounds);
    const min = this.bounds.min;
    const max = this.bounds.max;

    this.children = [
      // Bottom octants (y = min to center)
      new OctreeNode(
        { min: [min[0], min[1], min[2]], max: [center[0], center[1], center[2]] },
        this.depth + 1,
        this
      ), // 0: ---
      new OctreeNode(
        { min: [center[0], min[1], min[2]], max: [max[0], center[1], center[2]] },
        this.depth + 1,
        this
      ), // 1: +--
      new OctreeNode(
        { min: [min[0], min[1], center[2]], max: [center[0], center[1], max[2]] },
        this.depth + 1,
        this
      ), // 2: --+
      new OctreeNode(
        { min: [center[0], min[1], center[2]], max: [max[0], center[1], max[2]] },
        this.depth + 1,
        this
      ), // 3: +-+

      // Top octants (y = center to max)
      new OctreeNode(
        { min: [min[0], center[1], min[2]], max: [center[0], max[1], center[2]] },
        this.depth + 1,
        this
      ), // 4: -+-
      new OctreeNode(
        { min: [center[0], center[1], min[2]], max: [max[0], max[1], center[2]] },
        this.depth + 1,
        this
      ), // 5: ++-
      new OctreeNode(
        { min: [min[0], center[1], center[2]], max: [center[0], max[1], max[2]] },
        this.depth + 1,
        this
      ), // 6: -++
      new OctreeNode(
        { min: [center[0], center[1], center[2]], max: [max[0], max[1], max[2]] },
        this.depth + 1,
        this
      ), // 7: +++
    ];

    // Redistribute entities to children
    for (const entry of this.entities) {
      for (const child of this.children) {
        if (BoundingVolume.intersects(entry.aabb, child.bounds)) {
          child.entities.push(entry);
        }
      }
    }

    // Clear entities from parent (they're now in children)
    this.entities = [];
  }

  /**
   * Merges children back into this node if appropriate
   */
  merge(): void {
    if (this.isLeaf() || !this.children) return;

    // Collect all entities from children
    const allEntities: OctreeEntry[] = [];
    for (const child of this.children) {
      allEntities.push(...child.entities);
    }

    // Remove duplicates (entities that span multiple children)
    const uniqueEntities = new Map<Entity, OctreeEntry>();
    for (const entry of allEntities) {
      uniqueEntities.set(entry.entity, entry);
    }

    this.entities = Array.from(uniqueEntities.values());
    this.children = null;
  }
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
export const DEFAULT_OCTREE_CONFIG: OctreeConfig = {
  maxEntitiesPerNode: 8,
  maxDepth: 6,
  minNodeSize: 1.0,
};

/**
 * Octree for spatial partitioning
 */
export class Octree {
  private root: OctreeNode;
  private config: OctreeConfig;
  private entityMap = new Map<Entity, AABB>();
  private nodeCount = 1;
  private entityCount = 0;

  constructor(bounds: AABB, config: Partial<OctreeConfig> = {}) {
    this.config = { ...DEFAULT_OCTREE_CONFIG, ...config };
    this.root = new OctreeNode(bounds, 0);
  }

  /**
   * Clears all entities from the octree
   */
  clear(): void {
    this.root = new OctreeNode(this.root.bounds, 0);
    this.entityMap.clear();
    this.nodeCount = 1;
    this.entityCount = 0;
  }

  /**
   * Inserts an entity into the octree
   */
  insert(entity: Entity, aabb: AABB): void {
    this.entityMap.set(entity, aabb);
    this.entityCount++;
    this.insertIntoNode(this.root, { entity, aabb });
  }

  /**
   * Removes an entity from the octree
   */
  remove(entity: Entity): boolean {
    const aabb = this.entityMap.get(entity);
    if (!aabb) return false;

    this.entityMap.delete(entity);
    this.entityCount--;
    return this.removeFromNode(this.root, entity);
  }

  /**
   * Updates an entity's position in the octree
   */
  update(entity: Entity, newAABB: AABB): void {
    this.remove(entity);
    this.insert(entity, newAABB);
  }

  /**
   * Queries entities that intersect with the given AABB
   */
  query(aabb: AABB): Entity[] {
    const results = new Set<Entity>();
    this.queryNode(this.root, aabb, results);
    return Array.from(results);
  }

  /**
   * Queries all entity pairs that might collide
   */
  queryPairs(): Array<[Entity, Entity]> {
    const pairs: Array<[Entity, Entity]> = [];
    const checked = new Set<string>();

    this.collectPairsFromNode(this.root, pairs, checked);

    return pairs;
  }

  /**
   * Gets statistics about the octree
   */
  getStats(): {
    nodeCount: number;
    entityCount: number;
    maxDepth: number;
    avgEntitiesPerLeaf: number;
  } {
    let leafCount = 0;
    let totalEntitiesInLeaves = 0;
    let maxDepth = 0;

    const traverse = (node: OctreeNode) => {
      maxDepth = Math.max(maxDepth, node.depth);

      if (node.isLeaf()) {
        leafCount++;
        totalEntitiesInLeaves += node.entities.length;
      } else if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(this.root);

    return {
      nodeCount: this.nodeCount,
      entityCount: this.entityCount,
      maxDepth,
      avgEntitiesPerLeaf: leafCount > 0 ? totalEntitiesInLeaves / leafCount : 0,
    };
  }

  /**
   * Rebuilds the entire octree (useful after many updates)
   */
  rebuild(): void {
    const entities = Array.from(this.entityMap.entries());
    this.clear();

    for (const [entity, aabb] of entities) {
      this.insert(entity, aabb);
    }
  }

  /**
   * Internal: Inserts entry into a specific node
   */
  private insertIntoNode(node: OctreeNode, entry: OctreeEntry): void {
    // If node doesn't contain the entity, don't insert
    if (!BoundingVolume.intersects(entry.aabb, node.bounds)) {
      return;
    }

    // If leaf node
    if (node.isLeaf()) {
      node.entities.push(entry);

      // Check if we should split
      const shouldSplit =
        node.entities.length > this.config.maxEntitiesPerNode &&
        node.depth < this.config.maxDepth &&
        this.canSplitNode(node);

      if (shouldSplit) {
        node.split();
        this.nodeCount += 8;
      }
    } else if (node.children) {
      // Insert into appropriate children
      for (const child of node.children) {
        if (BoundingVolume.intersects(entry.aabb, child.bounds)) {
          this.insertIntoNode(child, entry);
        }
      }
    }
  }

  /**
   * Internal: Removes entity from a specific node
   */
  private removeFromNode(node: OctreeNode, entity: Entity): boolean {
    if (node.isLeaf()) {
      const index = node.entities.findIndex((e) => e.entity === entity);
      if (index !== -1) {
        node.entities.splice(index, 1);
        return true;
      }
      return false;
    }

    if (node.children) {
      let removed = false;
      for (const child of node.children) {
        if (this.removeFromNode(child, entity)) {
          removed = true;
        }
      }

      // Check if we should merge children
      const totalEntities = node.children.reduce(
        (sum, child) => sum + (child.isLeaf() ? child.entities.length : 0),
        0
      );

      if (totalEntities <= this.config.maxEntitiesPerNode / 2) {
        node.merge();
        this.nodeCount -= 8;
      }

      return removed;
    }

    return false;
  }

  /**
   * Internal: Queries entities in a node
   */
  private queryNode(node: OctreeNode, aabb: AABB, results: Set<Entity>): void {
    if (!BoundingVolume.intersects(aabb, node.bounds)) {
      return;
    }

    if (node.isLeaf()) {
      for (const entry of node.entities) {
        if (BoundingVolume.intersects(aabb, entry.aabb)) {
          results.add(entry.entity);
        }
      }
    } else if (node.children) {
      for (const child of node.children) {
        this.queryNode(child, aabb, results);
      }
    }
  }

  /**
   * Internal: Collects potential collision pairs from a node
   */
  private collectPairsFromNode(
    node: OctreeNode,
    pairs: Array<[Entity, Entity]>,
    checked: Set<string>
  ): void {
    if (node.isLeaf()) {
      // Check all pairs within this leaf
      for (let i = 0; i < node.entities.length; i++) {
        const entryA = node.entities[i];
        if (!entryA) continue;

        for (let j = i + 1; j < node.entities.length; j++) {
          const entryB = node.entities[j];
          if (!entryB) continue;

          const pairKey = this.getPairKey(entryA.entity, entryB.entity);
          if (!checked.has(pairKey)) {
            if (BoundingVolume.intersects(entryA.aabb, entryB.aabb)) {
              pairs.push([entryA.entity, entryB.entity]);
              checked.add(pairKey);
            }
          }
        }
      }
    } else if (node.children) {
      for (const child of node.children) {
        this.collectPairsFromNode(child, pairs, checked);
      }
    }
  }

  /**
   * Internal: Checks if a node can be split
   */
  private canSplitNode(node: OctreeNode): boolean {
    const size = BoundingVolume.getSize(node.bounds);
    const minSize = Math.min(size[0], size[1], size[2]);
    return minSize > this.config.minNodeSize * 2;
  }

  /**
   * Internal: Gets a unique key for an entity pair
   */
  private getPairKey(a: Entity, b: Entity): string {
    const idA = a.id;
    const idB = b.id;
    return idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
  }
}

