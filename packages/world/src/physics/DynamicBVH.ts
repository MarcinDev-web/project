/**
 * Dynamic BVH (Bounding Volume Hierarchy) with incremental updates
 * 
 * A tree structure where:
 * - Leaf nodes contain entities
 * - Internal nodes have AABBs that enclose their children
 * - Supports incremental refitting for moving objects
 * - Uses Surface Area Heuristic (SAH) for insertion
 * 
 * Advantages over Octree:
 * - Better adapts to non-uniform object distributions
 * - Incremental refitting is O(log N) vs O(N) rebuild
 * - More cache-friendly traversal
 * - Better for frustum culling (tighter bounds)
 * 
 * Used by: Box2D, Bullet Physics, Rapier, many game engines
 * 
 * References:
 * - "Dynamic Bounding Volume Hierarchies" - Erin Catto (GDC 2019)
 * - "Fast, Effective BVH Updates" - Daniel Kopta (HPG 2012)
 */

import type { Entity } from '../core/Entity.js';
import { BoundingVolume, type AABB } from './BoundingVolume.js';

/**
 * BVH Node - can be leaf (entity) or internal (two children)
 */
interface BVHNode {
  /** Bounding box enclosing this subtree */
  aabb: AABB;
  /** Parent node index (-1 for root) */
  parent: number;
  /** Left child index (-1 for leaf) */
  left: number;
  /** Right child index (-1 for leaf) */
  right: number;
  /** Entity (only for leaf nodes) */
  entity: Entity | null;
  /** Height of subtree (0 for leaf) */
  height: number;
  /** Is this node a leaf? */
  isLeaf: boolean;
  /** Fat AABB margin for movement tolerance */
  fatAABB: AABB;
}

/**
 * BVH Configuration
 */
export interface DynamicBVHConfig {
  /** Fat AABB margin - how much to expand bounds for movement tolerance */
  fatMargin: number;
  /** Velocity prediction multiplier for fat AABB */
  velocityMultiplier: number;
  /** Minimum displacement before update triggers refit */
  minDisplacement: number;
}

const DEFAULT_CONFIG: DynamicBVHConfig = {
  fatMargin: 0.1, // 10cm margin
  velocityMultiplier: 2.0, // Predict 2x velocity
  minDisplacement: 0.01, // 1cm minimum movement
};

/**
 * Dynamic BVH with incremental updates
 */
export class DynamicBVH {
  private nodes: BVHNode[] = [];
  private root: number = -1;
  private freeList: number[] = [];
  private entityToNode = new Map<Entity, number>();
  private config: DynamicBVHConfig;
  
  /** Performance stats */
  private stats = {
    insertCount: 0,
    removeCount: 0,
    updateCount: 0,
    refitCount: 0,
    rotationCount: 0,
    queryCount: 0,
    nodesVisited: 0,
  };

  constructor(config: Partial<DynamicBVHConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Clears all entities
   */
  clear(): void {
    this.nodes = [];
    this.root = -1;
    this.freeList = [];
    this.entityToNode.clear();
    this.resetStats();
  }

  /**
   * Inserts entity with AABB
   */
  insert(entity: Entity, aabb: AABB): void {
    if (this.entityToNode.has(entity)) {
      this.update(entity, aabb);
      return;
    }

    this.stats.insertCount++;

    const fatAABB = this.computeFatAABB(aabb);
    const leafIndex = this.allocateNode();
    const leaf = this.nodes[leafIndex]!;
    
    leaf.aabb = { ...aabb, min: [...aabb.min], max: [...aabb.max] };
    leaf.fatAABB = fatAABB;
    leaf.entity = entity;
    leaf.isLeaf = true;
    leaf.height = 0;
    leaf.left = -1;
    leaf.right = -1;

    this.entityToNode.set(entity, leafIndex);
    this.insertLeaf(leafIndex);
  }

  /**
   * Removes entity
   */
  remove(entity: Entity): boolean {
    const leafIndex = this.entityToNode.get(entity);
    if (leafIndex === undefined) return false;

    this.stats.removeCount++;
    this.entityToNode.delete(entity);
    this.removeLeaf(leafIndex);
    this.freeNode(leafIndex);
    return true;
  }

  /**
   * Updates entity AABB - KEY OPTIMIZATION
   * Only refits if object moved outside fat AABB
   */
  update(entity: Entity, aabb: AABB, velocity?: [number, number, number]): boolean {
    const leafIndex = this.entityToNode.get(entity);
    if (leafIndex === undefined) {
      this.insert(entity, aabb);
      return true;
    }

    this.stats.updateCount++;
    const leaf = this.nodes[leafIndex]!;

    // Check if still within fat AABB (fast path)
    if (BoundingVolume.contains(leaf.fatAABB, aabb)) {
      // Update tight AABB but don't refit tree
      leaf.aabb = { ...aabb, min: [...aabb.min], max: [...aabb.max] };
      return false;
    }

    // Need to refit (slow path)
    this.stats.refitCount++;
    
    // Remove and re-insert with new fat AABB
    this.removeLeaf(leafIndex);
    
    // Compute new fat AABB with optional velocity prediction
    leaf.fatAABB = this.computeFatAABB(aabb, velocity);
    leaf.aabb = { ...aabb, min: [...aabb.min], max: [...aabb.max] };
    
    this.insertLeaf(leafIndex);
    return true;
  }

  /**
   * Batch update - efficient for many updates
   */
  batchUpdate(updates: Array<{ entity: Entity; aabb: AABB; velocity?: [number, number, number] }>): number {
    let refitCount = 0;
    
    for (const { entity, aabb, velocity } of updates) {
      if (this.update(entity, aabb, velocity)) {
        refitCount++;
      }
    }
    
    return refitCount;
  }

  /**
   * Queries entities intersecting AABB
   */
  query(aabb: AABB): Entity[] {
    this.stats.queryCount++;
    const results: Entity[] = [];
    
    if (this.root === -1) return results;
    
    const stack: number[] = [this.root];
    
    while (stack.length > 0) {
      const nodeIndex = stack.pop()!;
      const node = this.nodes[nodeIndex]!;
      this.stats.nodesVisited++;
      
      if (!BoundingVolume.intersects(node.aabb, aabb)) {
        continue;
      }
      
      if (node.isLeaf) {
        if (node.entity) {
          results.push(node.entity);
        }
      } else {
        if (node.left !== -1) stack.push(node.left);
        if (node.right !== -1) stack.push(node.right);
      }
    }
    
    return results;
  }

  /**
   * Queries to array (avoids allocation)
   */
  queryToArray(aabb: AABB, out: Entity[]): Entity[] {
    this.stats.queryCount++;
    out.length = 0;
    
    if (this.root === -1) return out;
    
    // Use iterative traversal with pre-allocated stack
    const stack: number[] = [this.root];
    
    while (stack.length > 0) {
      const nodeIndex = stack.pop()!;
      const node = this.nodes[nodeIndex]!;
      this.stats.nodesVisited++;
      
      if (!BoundingVolume.intersects(node.aabb, aabb)) {
        continue;
      }
      
      if (node.isLeaf) {
        if (node.entity) {
          out.push(node.entity);
        }
      } else {
        if (node.left !== -1) stack.push(node.left);
        if (node.right !== -1) stack.push(node.right);
      }
    }
    
    return out;
  }

  /**
   * Frustum query - returns entities potentially visible
   */
  queryFrustum(planes: Array<{ nx: number; ny: number; nz: number; d: number }>): Entity[] {
    this.stats.queryCount++;
    const results: Entity[] = [];
    
    if (this.root === -1) return results;
    
    const stack: number[] = [this.root];
    
    while (stack.length > 0) {
      const nodeIndex = stack.pop()!;
      const node = this.nodes[nodeIndex]!;
      this.stats.nodesVisited++;
      
      // Test AABB against all frustum planes
      if (!this.aabbIntersectsFrustum(node.aabb, planes)) {
        continue;
      }
      
      if (node.isLeaf) {
        if (node.entity) {
          results.push(node.entity);
        }
      } else {
        if (node.left !== -1) stack.push(node.left);
        if (node.right !== -1) stack.push(node.right);
      }
    }
    
    return results;
  }

  /**
   * Gets entity count
   */
  get entityCount(): number {
    return this.entityToNode.size;
  }

  /**
   * Gets node count
   */
  get nodeCount(): number {
    return this.nodes.length - this.freeList.length;
  }

  /**
   * Gets tree height
   */
  get height(): number {
    if (this.root === -1) return 0;
    return this.nodes[this.root]!.height;
  }

  /**
   * Gets stats
   */
  getStats() {
    return {
      ...this.stats,
      entityCount: this.entityCount,
      nodeCount: this.nodeCount,
      treeHeight: this.height,
      avgNodesPerQuery: this.stats.queryCount > 0 
        ? this.stats.nodesVisited / this.stats.queryCount 
        : 0,
    };
  }

  /**
   * Resets stats
   */
  resetStats(): void {
    this.stats = {
      insertCount: 0,
      removeCount: 0,
      updateCount: 0,
      refitCount: 0,
      rotationCount: 0,
      queryCount: 0,
      nodesVisited: 0,
    };
  }

  // ==================== Internal Methods ====================

  private computeFatAABB(
    aabb: AABB,
    velocity?: [number, number, number]
  ): AABB {
    const margin = this.config.fatMargin;
    
    const fatAABB: AABB = {
      min: [aabb.min[0] - margin, aabb.min[1] - margin, aabb.min[2] - margin],
      max: [aabb.max[0] + margin, aabb.max[1] + margin, aabb.max[2] + margin],
    };
    
    // Extend in velocity direction if provided
    if (velocity) {
      const mult = this.config.velocityMultiplier;
      for (let i = 0; i < 3; i++) {
        const v = velocity[i] * mult;
        if (v < 0) {
          fatAABB.min[i] += v;
        } else {
          fatAABB.max[i] += v;
        }
      }
    }
    
    return fatAABB;
  }

  private allocateNode(): number {
    if (this.freeList.length > 0) {
      return this.freeList.pop()!;
    }
    
    const index = this.nodes.length;
    this.nodes.push({
      aabb: { min: [0, 0, 0], max: [0, 0, 0] },
      fatAABB: { min: [0, 0, 0], max: [0, 0, 0] },
      parent: -1,
      left: -1,
      right: -1,
      entity: null,
      height: 0,
      isLeaf: false,
    });
    return index;
  }

  private freeNode(index: number): void {
    const node = this.nodes[index]!;
    node.entity = null;
    node.parent = -1;
    node.left = -1;
    node.right = -1;
    node.height = -1;
    this.freeList.push(index);
  }

  private insertLeaf(leafIndex: number): void {
    if (this.root === -1) {
      this.root = leafIndex;
      this.nodes[leafIndex]!.parent = -1;
      return;
    }

    // Find best sibling using Surface Area Heuristic
    const leafAABB = this.nodes[leafIndex]!.aabb;
    let bestSibling = this.root;
    let bestCost = this.computeCost(leafAABB, this.nodes[this.root]!.aabb);

    // Simple traversal - could be optimized with priority queue
    const stack: number[] = [this.root];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const node = this.nodes[current]!;
      
      if (node.isLeaf) continue;
      
      const combinedAABB = BoundingVolume.merge(leafAABB, node.aabb);
      const cost = this.surfaceArea(combinedAABB);
      
      if (cost < bestCost) {
        bestCost = cost;
        bestSibling = current;
      }
      
      // Compute lower bound for child costs
      const inheritedCost = this.surfaceArea(combinedAABB) - this.surfaceArea(node.aabb);
      
      if (node.left !== -1) {
        const childAABB = this.nodes[node.left]!.aabb;
        const lowerBound = this.surfaceArea(BoundingVolume.merge(leafAABB, childAABB)) + inheritedCost;
        if (lowerBound < bestCost) {
          stack.push(node.left);
        }
      }
      
      if (node.right !== -1) {
        const childAABB = this.nodes[node.right]!.aabb;
        const lowerBound = this.surfaceArea(BoundingVolume.merge(leafAABB, childAABB)) + inheritedCost;
        if (lowerBound < bestCost) {
          stack.push(node.right);
        }
      }
    }

    // Create new parent
    const sibling = this.nodes[bestSibling]!;
    const oldParent = sibling.parent;
    const newParentIndex = this.allocateNode();
    const newParent = this.nodes[newParentIndex]!;
    
    newParent.parent = oldParent;
    newParent.aabb = BoundingVolume.merge(leafAABB, sibling.aabb);
    newParent.height = sibling.height + 1;
    newParent.isLeaf = false;
    
    if (oldParent !== -1) {
      // Sibling was not root
      const parent = this.nodes[oldParent]!;
      if (parent.left === bestSibling) {
        parent.left = newParentIndex;
      } else {
        parent.right = newParentIndex;
      }
    } else {
      // Sibling was root
      this.root = newParentIndex;
    }
    
    newParent.left = bestSibling;
    newParent.right = leafIndex;
    sibling.parent = newParentIndex;
    this.nodes[leafIndex]!.parent = newParentIndex;

    // Walk back up fixing heights and AABBs
    this.refitAncestors(newParentIndex);
  }

  private removeLeaf(leafIndex: number): void {
    if (leafIndex === this.root) {
      this.root = -1;
      return;
    }

    const leaf = this.nodes[leafIndex]!;
    const parentIndex = leaf.parent;
    const parent = this.nodes[parentIndex]!;
    const grandparentIndex = parent.parent;
    
    const siblingIndex = parent.left === leafIndex ? parent.right : parent.left;
    const sibling = this.nodes[siblingIndex]!;
    
    if (grandparentIndex !== -1) {
      // Destroy parent and connect sibling to grandparent
      const grandparent = this.nodes[grandparentIndex]!;
      if (grandparent.left === parentIndex) {
        grandparent.left = siblingIndex;
      } else {
        grandparent.right = siblingIndex;
      }
      sibling.parent = grandparentIndex;
      this.freeNode(parentIndex);

      this.refitAncestors(grandparentIndex);
    } else {
      // Parent was root
      this.root = siblingIndex;
      sibling.parent = -1;
      this.freeNode(parentIndex);
    }

    leaf.parent = -1;
  }

  private refitAncestors(index: number): void {
    let current = index;
    while (current !== -1) {
      current = this.balance(current);
      
      const node = this.nodes[current]!;
      if (!node.isLeaf && node.left !== -1 && node.right !== -1) {
        const left = this.nodes[node.left]!;
        const right = this.nodes[node.right]!;
        node.aabb = BoundingVolume.merge(left.aabb, right.aabb);
        node.height = 1 + Math.max(left.height, right.height);
      }
      
      current = node.parent;
    }
  }

  /**
   * AVL-style tree balancing
   */
  private balance(index: number): number {
    const node = this.nodes[index]!;
    
    if (node.isLeaf || node.height < 2) {
      return index;
    }

    const leftIndex = node.left;
    const rightIndex = node.right;
    const left = this.nodes[leftIndex]!;
    const right = this.nodes[rightIndex]!;
    
    const balance = right.height - left.height;
    
    // Rotate right
    if (balance > 1 && !right.isLeaf) {
      this.stats.rotationCount++;
      const rightLeft = right.left;
      const rightRight = right.right;
      
      // Swap node and right
      right.left = index;
      right.parent = node.parent;
      node.parent = rightIndex;
      
      if (right.parent !== -1) {
        const parent = this.nodes[right.parent]!;
        if (parent.left === index) {
          parent.left = rightIndex;
        } else {
          parent.right = rightIndex;
        }
      } else {
        this.root = rightIndex;
      }
      
      // Rotate
      const rightLeftNode = this.nodes[rightLeft]!;
      const rightRightNode = this.nodes[rightRight]!;
      
      if (rightLeftNode.height > rightRightNode.height) {
        right.right = rightLeft;
        node.right = rightRight;
        rightRightNode.parent = index;
        node.aabb = BoundingVolume.merge(left.aabb, rightRightNode.aabb);
        right.aabb = BoundingVolume.merge(node.aabb, rightLeftNode.aabb);
        node.height = 1 + Math.max(left.height, rightRightNode.height);
        right.height = 1 + Math.max(node.height, rightLeftNode.height);
      } else {
        right.right = rightRight;
        node.right = rightLeft;
        rightLeftNode.parent = index;
        node.aabb = BoundingVolume.merge(left.aabb, rightLeftNode.aabb);
        right.aabb = BoundingVolume.merge(node.aabb, rightRightNode.aabb);
        node.height = 1 + Math.max(left.height, rightLeftNode.height);
        right.height = 1 + Math.max(node.height, rightRightNode.height);
      }
      
      return rightIndex;
    }
    
    // Rotate left
    if (balance < -1 && !left.isLeaf) {
      this.stats.rotationCount++;
      const leftLeft = left.left;
      const leftRight = left.right;
      
      left.left = index;
      left.parent = node.parent;
      node.parent = leftIndex;
      
      if (left.parent !== -1) {
        const parent = this.nodes[left.parent]!;
        if (parent.left === index) {
          parent.left = leftIndex;
        } else {
          parent.right = leftIndex;
        }
      } else {
        this.root = leftIndex;
      }
      
      const leftLeftNode = this.nodes[leftLeft]!;
      const leftRightNode = this.nodes[leftRight]!;
      
      if (leftLeftNode.height > leftRightNode.height) {
        left.right = leftLeft;
        node.left = leftRight;
        leftRightNode.parent = index;
        node.aabb = BoundingVolume.merge(right.aabb, leftRightNode.aabb);
        left.aabb = BoundingVolume.merge(node.aabb, leftLeftNode.aabb);
        node.height = 1 + Math.max(right.height, leftRightNode.height);
        left.height = 1 + Math.max(node.height, leftLeftNode.height);
      } else {
        left.right = leftRight;
        node.left = leftLeft;
        leftLeftNode.parent = index;
        node.aabb = BoundingVolume.merge(right.aabb, leftLeftNode.aabb);
        left.aabb = BoundingVolume.merge(node.aabb, leftRightNode.aabb);
        node.height = 1 + Math.max(right.height, leftLeftNode.height);
        left.height = 1 + Math.max(node.height, leftRightNode.height);
      }
      
      return leftIndex;
    }
    
    return index;
  }

  private computeCost(a: AABB, b: AABB): number {
    return this.surfaceArea(BoundingVolume.merge(a, b));
  }

  private surfaceArea(aabb: AABB): number {
    const dx = aabb.max[0] - aabb.min[0];
    const dy = aabb.max[1] - aabb.min[1];
    const dz = aabb.max[2] - aabb.min[2];
    return 2 * (dx * dy + dy * dz + dz * dx);
  }

  private aabbIntersectsFrustum(
    aabb: AABB,
    planes: Array<{ nx: number; ny: number; nz: number; d: number }>
  ): boolean {
    for (const p of planes) {
      // Get positive vertex (p-vertex)
      const px = p.nx >= 0 ? aabb.max[0] : aabb.min[0];
      const py = p.ny >= 0 ? aabb.max[1] : aabb.min[1];
      const pz = p.nz >= 0 ? aabb.max[2] : aabb.min[2];
      
      const dist = p.nx * px + p.ny * py + p.nz * pz + p.d;
      if (dist < 0) return false;
    }
    return true;
  }
}

