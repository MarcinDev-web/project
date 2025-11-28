//! High-performance Spatial Indexing for WebGPU 3D Engine
//!
//! Provides BVH and Loose Octree implementations optimized for:
//! - Dynamic scenes with many moving objects
//! - Incremental updates (no full rebuild needed)
//! - Zero-copy memory access from JavaScript
//! - SIMD-optimized AABB operations
//!
//! # Performance Characteristics
//!
//! - BVH insert: O(log N) amortized
//! - BVH update (within fat AABB): O(1)
//! - BVH update (outside fat AABB): O(log N)
//! - BVH query: O(log N + K) where K = results
//! - Frustum cull: O(log N) with early termination

use wasm_bindgen::prelude::*;
use std::collections::HashMap;

mod aabb;
mod bvh;
mod loose_octree;

pub use aabb::*;
pub use bvh::*;
pub use loose_octree::*;

/// Initialize panic hook for better error messages in browser console
#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// AABB represented as 6 floats: [min_x, min_y, min_z, max_x, max_y, max_z]
#[wasm_bindgen]
#[derive(Clone, Copy, Debug)]
pub struct AABB {
    pub min_x: f32,
    pub min_y: f32,
    pub min_z: f32,
    pub max_x: f32,
    pub max_y: f32,
    pub max_z: f32,
}

#[wasm_bindgen]
impl AABB {
    #[wasm_bindgen(constructor)]
    pub fn new(min_x: f32, min_y: f32, min_z: f32, max_x: f32, max_y: f32, max_z: f32) -> Self {
        Self { min_x, min_y, min_z, max_x, max_y, max_z }
    }
    
    /// Computes surface area (for SAH heuristic)
    pub fn surface_area(&self) -> f32 {
        let dx = self.max_x - self.min_x;
        let dy = self.max_y - self.min_y;
        let dz = self.max_z - self.min_z;
        2.0 * (dx * dy + dy * dz + dz * dx)
    }
    
    /// Gets center point as Vec (wasm_bindgen compatible)
    pub fn center_vec(&self) -> Vec<f32> {
        vec![
            (self.min_x + self.max_x) * 0.5,
            (self.min_y + self.max_y) * 0.5,
            (self.min_z + self.max_z) * 0.5,
        ]
    }
}

// Internal methods not exported to WASM
impl AABB {
    /// Creates AABB from flat array [min_x, min_y, min_z, max_x, max_y, max_z]
    pub fn from_array(arr: &[f32]) -> Option<Self> {
        if arr.len() < 6 {
            return None;
        }
        Some(Self {
            min_x: arr[0],
            min_y: arr[1],
            min_z: arr[2],
            max_x: arr[3],
            max_y: arr[4],
            max_z: arr[5],
        })
    }
    
    /// Checks if this AABB intersects another
    #[inline]
    pub fn intersects(&self, other: &AABB) -> bool {
        self.max_x >= other.min_x && self.min_x <= other.max_x &&
        self.max_y >= other.min_y && self.min_y <= other.max_y &&
        self.max_z >= other.min_z && self.min_z <= other.max_z
    }
    
    /// Checks if this AABB contains another completely
    #[inline]
    pub fn contains(&self, other: &AABB) -> bool {
        self.min_x <= other.min_x && self.max_x >= other.max_x &&
        self.min_y <= other.min_y && self.max_y >= other.max_y &&
        self.min_z <= other.min_z && self.max_z >= other.max_z
    }
    
    /// Merges two AABBs into one that contains both
    #[inline]
    pub fn merge(&self, other: &AABB) -> AABB {
        AABB {
            min_x: self.min_x.min(other.min_x),
            min_y: self.min_y.min(other.min_y),
            min_z: self.min_z.min(other.min_z),
            max_x: self.max_x.max(other.max_x),
            max_y: self.max_y.max(other.max_y),
            max_z: self.max_z.max(other.max_z),
        }
    }
    
    /// Expands AABB by a margin on all sides
    #[inline]
    pub fn expand(&self, margin: f32) -> AABB {
        AABB {
            min_x: self.min_x - margin,
            min_y: self.min_y - margin,
            min_z: self.min_z - margin,
            max_x: self.max_x + margin,
            max_y: self.max_y + margin,
            max_z: self.max_z + margin,
        }
    }
    
    /// Gets center point as array (internal use)
    #[inline]
    pub fn center(&self) -> [f32; 3] {
        [
            (self.min_x + self.max_x) * 0.5,
            (self.min_y + self.max_y) * 0.5,
            (self.min_z + self.max_z) * 0.5,
        ]
    }
}

/// Frustum plane: ax + by + cz + d = 0
#[derive(Clone, Copy, Debug)]
pub struct FrustumPlane {
    pub nx: f32,
    pub ny: f32,
    pub nz: f32,
    pub d: f32,
}

impl FrustumPlane {
    /// Tests if AABB is completely outside this plane
    #[inline]
    pub fn aabb_outside(&self, aabb: &AABB) -> bool {
        // Get positive vertex (p-vertex)
        let px = if self.nx >= 0.0 { aabb.max_x } else { aabb.min_x };
        let py = if self.ny >= 0.0 { aabb.max_y } else { aabb.min_y };
        let pz = if self.nz >= 0.0 { aabb.max_z } else { aabb.min_z };
        
        self.nx * px + self.ny * py + self.nz * pz + self.d < 0.0
    }
}

/// Tests if AABB is visible (not outside) any frustum plane
#[inline]
pub fn aabb_in_frustum(aabb: &AABB, planes: &[FrustumPlane; 6]) -> bool {
    for plane in planes {
        if plane.aabb_outside(aabb) {
            return false;
        }
    }
    true
}

/// Dynamic BVH with incremental updates
/// 
/// Uses fat AABBs to reduce re-insertions for moving objects.
/// Implements AVL-style balancing for O(log N) operations.
#[wasm_bindgen]
pub struct SpatialBVH {
    nodes: Vec<BVHNode>,
    root: i32,
    free_list: Vec<i32>,
    entity_to_node: HashMap<u32, i32>,
    fat_margin: f32,
    
    // Stats
    insert_count: u32,
    update_count: u32,
    refit_count: u32,
}

/// BVH node
#[derive(Clone)]
struct BVHNode {
    /// Tight AABB
    aabb: AABB,
    /// Fat AABB (with margin for movement tolerance)
    fat_aabb: AABB,
    /// Parent node index (-1 for root)
    parent: i32,
    /// Left child index (-1 for leaf)
    left: i32,
    /// Right child index (-1 for leaf)
    right: i32,
    /// Entity ID (only for leaves, u32::MAX for internal nodes)
    entity_id: u32,
    /// Subtree height (0 for leaf)
    height: i32,
}

impl BVHNode {
    fn is_leaf(&self) -> bool {
        self.left == -1
    }
}

#[wasm_bindgen]
impl SpatialBVH {
    /// Creates a new BVH
    #[wasm_bindgen(constructor)]
    pub fn new(fat_margin: f32) -> Self {
        Self {
            nodes: Vec::with_capacity(1024),
            root: -1,
            free_list: Vec::new(),
            entity_to_node: HashMap::new(),
            fat_margin,
            insert_count: 0,
            update_count: 0,
            refit_count: 0,
        }
    }
    
    /// Clears all entities
    pub fn clear(&mut self) {
        self.nodes.clear();
        self.root = -1;
        self.free_list.clear();
        self.entity_to_node.clear();
        self.insert_count = 0;
        self.update_count = 0;
        self.refit_count = 0;
    }
    
    /// Inserts an entity with AABB
    /// aabb_data: [min_x, min_y, min_z, max_x, max_y, max_z]
    pub fn insert(&mut self, entity_id: u32, aabb_data: &[f32]) {
        if aabb_data.len() < 6 {
            return;
        }
        
        let aabb = AABB::from_array(aabb_data).unwrap();
        
        // Check if already exists
        if let Some(&leaf_idx) = self.entity_to_node.get(&entity_id) {
            self.update_internal(leaf_idx, aabb);
            return;
        }
        
        self.insert_count += 1;
        
        let fat_aabb = aabb.expand(self.fat_margin);
        let leaf_idx = self.allocate_node();
        
        {
            let leaf = &mut self.nodes[leaf_idx as usize];
            leaf.aabb = aabb;
            leaf.fat_aabb = fat_aabb;
            leaf.entity_id = entity_id;
            leaf.height = 0;
            leaf.left = -1;
            leaf.right = -1;
        }
        
        self.entity_to_node.insert(entity_id, leaf_idx);
        self.insert_leaf(leaf_idx);
    }
    
    /// Removes an entity
    pub fn remove(&mut self, entity_id: u32) -> bool {
        if let Some(leaf_idx) = self.entity_to_node.remove(&entity_id) {
            self.remove_leaf(leaf_idx);
            self.free_node(leaf_idx);
            true
        } else {
            false
        }
    }
    
    /// Updates entity AABB - only re-inserts if outside fat AABB
    /// Returns true if re-insertion was needed
    pub fn update(&mut self, entity_id: u32, aabb_data: &[f32]) -> bool {
        if aabb_data.len() < 6 {
            return false;
        }
        
        let aabb = AABB::from_array(aabb_data).unwrap();
        
        if let Some(&leaf_idx) = self.entity_to_node.get(&entity_id) {
            self.update_internal(leaf_idx, aabb)
        } else {
            self.insert(entity_id, aabb_data);
            true
        }
    }
    
    fn update_internal(&mut self, leaf_idx: i32, aabb: AABB) -> bool {
        self.update_count += 1;
        
        let fat_aabb = self.nodes[leaf_idx as usize].fat_aabb;
        
        // Fast path: still within fat AABB
        if fat_aabb.contains(&aabb) {
            self.nodes[leaf_idx as usize].aabb = aabb;
            return false;
        }
        
        // Slow path: need to re-insert
        self.refit_count += 1;
        self.remove_leaf(leaf_idx);
        
        let new_fat = aabb.expand(self.fat_margin);
        {
            let leaf = &mut self.nodes[leaf_idx as usize];
            leaf.aabb = aabb;
            leaf.fat_aabb = new_fat;
        }
        
        self.insert_leaf(leaf_idx);
        true
    }
    
    /// Batch update - more efficient for many updates
    /// aabb_data: flat array of [entity_id, min_x, min_y, min_z, max_x, max_y, max_z, ...]
    /// Returns number of re-insertions
    pub fn batch_update(&mut self, data: &[f32]) -> u32 {
        let stride = 7; // entity_id + 6 AABB floats
        let count = data.len() / stride;
        let mut reinserts = 0;
        
        for i in 0..count {
            let base = i * stride;
            let entity_id = data[base] as u32;
            let aabb_slice = &data[base + 1..base + 7];
            
            if self.update(entity_id, aabb_slice) {
                reinserts += 1;
            }
        }
        
        reinserts
    }
    
    /// Queries entities intersecting AABB
    /// Returns entity IDs as Uint32Array
    pub fn query_aabb(&self, aabb_data: &[f32]) -> Vec<u32> {
        let mut results = Vec::new();
        
        if self.root == -1 || aabb_data.len() < 6 {
            return results;
        }
        
        let query_aabb = AABB::from_array(aabb_data).unwrap();
        let mut stack = vec![self.root];
        
        while let Some(idx) = stack.pop() {
            let node = &self.nodes[idx as usize];
            
            if !query_aabb.intersects(&node.aabb) {
                continue;
            }
            
            if node.is_leaf() {
                results.push(node.entity_id);
            } else {
                if node.left != -1 {
                    stack.push(node.left);
                }
                if node.right != -1 {
                    stack.push(node.right);
                }
            }
        }
        
        results
    }
    
    /// Frustum culling - returns visible entity IDs
    /// planes_data: flat array of 6 planes × 4 floats = 24 floats
    pub fn query_frustum(&self, planes_data: &[f32]) -> Vec<u32> {
        let mut results = Vec::new();
        
        if self.root == -1 || planes_data.len() < 24 {
            return results;
        }
        
        // Parse frustum planes
        let planes: [FrustumPlane; 6] = [
            FrustumPlane { nx: planes_data[0], ny: planes_data[1], nz: planes_data[2], d: planes_data[3] },
            FrustumPlane { nx: planes_data[4], ny: planes_data[5], nz: planes_data[6], d: planes_data[7] },
            FrustumPlane { nx: planes_data[8], ny: planes_data[9], nz: planes_data[10], d: planes_data[11] },
            FrustumPlane { nx: planes_data[12], ny: planes_data[13], nz: planes_data[14], d: planes_data[15] },
            FrustumPlane { nx: planes_data[16], ny: planes_data[17], nz: planes_data[18], d: planes_data[19] },
            FrustumPlane { nx: planes_data[20], ny: planes_data[21], nz: planes_data[22], d: planes_data[23] },
        ];
        
        let mut stack = vec![self.root];
        
        while let Some(idx) = stack.pop() {
            let node = &self.nodes[idx as usize];
            
            if !aabb_in_frustum(&node.aabb, &planes) {
                continue;
            }
            
            if node.is_leaf() {
                results.push(node.entity_id);
            } else {
                if node.left != -1 {
                    stack.push(node.left);
                }
                if node.right != -1 {
                    stack.push(node.right);
                }
            }
        }
        
        results
    }
    
    /// Gets statistics
    pub fn get_stats(&self) -> Vec<u32> {
        vec![
            self.entity_to_node.len() as u32,
            self.nodes.len() as u32,
            if self.root != -1 { self.nodes[self.root as usize].height as u32 } else { 0 },
            self.insert_count,
            self.update_count,
            self.refit_count,
        ]
    }
    
    /// Resets stats
    pub fn reset_stats(&mut self) {
        self.insert_count = 0;
        self.update_count = 0;
        self.refit_count = 0;
    }
    
    // ==================== Internal Methods ====================
    
    fn allocate_node(&mut self) -> i32 {
        if let Some(idx) = self.free_list.pop() {
            idx
        } else {
            let idx = self.nodes.len() as i32;
            self.nodes.push(BVHNode {
                aabb: AABB::new(0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
                fat_aabb: AABB::new(0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
                parent: -1,
                left: -1,
                right: -1,
                entity_id: u32::MAX,
                height: 0,
            });
            idx
        }
    }
    
    fn free_node(&mut self, idx: i32) {
        self.nodes[idx as usize].height = -1;
        self.free_list.push(idx);
    }
    
    fn insert_leaf(&mut self, leaf_idx: i32) {
        if self.root == -1 {
            self.root = leaf_idx;
            self.nodes[leaf_idx as usize].parent = -1;
            return;
        }
        
        let leaf_aabb = self.nodes[leaf_idx as usize].aabb;
        
        // Find best sibling using SAH
        let mut best_sibling = self.root;
        let mut best_cost = self.nodes[self.root as usize].aabb.merge(&leaf_aabb).surface_area();
        
        let mut stack = vec![self.root];
        while let Some(current) = stack.pop() {
            let node = &self.nodes[current as usize];
            
            if node.is_leaf() {
                continue;
            }
            
            let combined = node.aabb.merge(&leaf_aabb);
            let cost = combined.surface_area();
            
            if cost < best_cost {
                best_cost = cost;
                best_sibling = current;
            }
            
            // Lower bound pruning
            let inherited_cost = combined.surface_area() - node.aabb.surface_area();
            
            if node.left != -1 {
                let child_aabb = &self.nodes[node.left as usize].aabb;
                let lower_bound = child_aabb.merge(&leaf_aabb).surface_area() + inherited_cost;
                if lower_bound < best_cost {
                    stack.push(node.left);
                }
            }
            
            if node.right != -1 {
                let child_aabb = &self.nodes[node.right as usize].aabb;
                let lower_bound = child_aabb.merge(&leaf_aabb).surface_area() + inherited_cost;
                if lower_bound < best_cost {
                    stack.push(node.right);
                }
            }
        }
        
        // Create new parent
        let sibling_parent = self.nodes[best_sibling as usize].parent;
        let new_parent_idx = self.allocate_node();
        
        let sibling_aabb = self.nodes[best_sibling as usize].aabb;
        let sibling_height = self.nodes[best_sibling as usize].height;
        
        {
            let new_parent = &mut self.nodes[new_parent_idx as usize];
            new_parent.parent = sibling_parent;
            new_parent.aabb = sibling_aabb.merge(&leaf_aabb);
            new_parent.height = sibling_height + 1;
            new_parent.left = best_sibling;
            new_parent.right = leaf_idx;
            new_parent.entity_id = u32::MAX;
        }
        
        self.nodes[best_sibling as usize].parent = new_parent_idx;
        self.nodes[leaf_idx as usize].parent = new_parent_idx;
        
        if sibling_parent != -1 {
            let parent = &mut self.nodes[sibling_parent as usize];
            if parent.left == best_sibling {
                parent.left = new_parent_idx;
            } else {
                parent.right = new_parent_idx;
            }
        } else {
            self.root = new_parent_idx;
        }
        
        // Refit ancestors
        self.refit_ancestors(new_parent_idx);
    }
    
    fn remove_leaf(&mut self, leaf_idx: i32) {
        if leaf_idx == self.root {
            self.root = -1;
            return;
        }
        
        let parent_idx = self.nodes[leaf_idx as usize].parent;
        let parent = &self.nodes[parent_idx as usize];
        let grandparent_idx = parent.parent;
        let sibling_idx = if parent.left == leaf_idx { parent.right } else { parent.left };
        
        if grandparent_idx != -1 {
            let grandparent = &mut self.nodes[grandparent_idx as usize];
            if grandparent.left == parent_idx {
                grandparent.left = sibling_idx;
            } else {
                grandparent.right = sibling_idx;
            }
            self.nodes[sibling_idx as usize].parent = grandparent_idx;
            self.free_node(parent_idx);
            self.refit_ancestors(grandparent_idx);
        } else {
            self.root = sibling_idx;
            self.nodes[sibling_idx as usize].parent = -1;
            self.free_node(parent_idx);
        }
        
        self.nodes[leaf_idx as usize].parent = -1;
    }
    
    fn refit_ancestors(&mut self, start_idx: i32) {
        let mut idx = start_idx;
        
        while idx != -1 {
            idx = self.balance(idx);
            
            let node = &self.nodes[idx as usize];
            if !node.is_leaf() {
                let left_idx = node.left;
                let right_idx = node.right;
                
                let left = &self.nodes[left_idx as usize];
                let right = &self.nodes[right_idx as usize];
                
                let merged = left.aabb.merge(&right.aabb);
                let height = 1 + left.height.max(right.height);
                
                let node = &mut self.nodes[idx as usize];
                node.aabb = merged;
                node.height = height;
            }
            
            idx = self.nodes[idx as usize].parent;
        }
    }
    
    /// AVL-style balancing
    fn balance(&mut self, idx: i32) -> i32 {
        let node = &self.nodes[idx as usize];
        
        if node.is_leaf() || node.height < 2 {
            return idx;
        }
        
        let left_idx = node.left;
        let right_idx = node.right;
        let left_height = self.nodes[left_idx as usize].height;
        let right_height = self.nodes[right_idx as usize].height;
        
        let balance = right_height - left_height;
        
        // Rotate right
        if balance > 1 {
            return self.rotate_left(idx);
        }
        
        // Rotate left
        if balance < -1 {
            return self.rotate_right(idx);
        }
        
        idx
    }
    
    fn rotate_left(&mut self, idx: i32) -> i32 {
        let right_idx = self.nodes[idx as usize].right;
        let right_left = self.nodes[right_idx as usize].left;
        let right_right = self.nodes[right_idx as usize].right;
        
        // Swap
        let parent = self.nodes[idx as usize].parent;
        self.nodes[right_idx as usize].left = idx;
        self.nodes[right_idx as usize].parent = parent;
        self.nodes[idx as usize].parent = right_idx;
        
        if parent != -1 {
            let p = &mut self.nodes[parent as usize];
            if p.left == idx {
                p.left = right_idx;
            } else {
                p.right = right_idx;
            }
        } else {
            self.root = right_idx;
        }
        
        // Determine which grandchild to promote
        let rl_height = if right_left != -1 { self.nodes[right_left as usize].height } else { -1 };
        let rr_height = if right_right != -1 { self.nodes[right_right as usize].height } else { -1 };
        
        if rl_height > rr_height {
            self.nodes[right_idx as usize].right = right_left;
            self.nodes[idx as usize].right = right_right;
            if right_right != -1 {
                self.nodes[right_right as usize].parent = idx;
            }
            
            let left_aabb = self.nodes[self.nodes[idx as usize].left as usize].aabb;
            let rr_aabb = if right_right != -1 { self.nodes[right_right as usize].aabb } else { left_aabb };
            self.nodes[idx as usize].aabb = left_aabb.merge(&rr_aabb);
            
            let idx_aabb = self.nodes[idx as usize].aabb;
            let rl_aabb = self.nodes[right_left as usize].aabb;
            self.nodes[right_idx as usize].aabb = idx_aabb.merge(&rl_aabb);
            
            let left_height = self.nodes[self.nodes[idx as usize].left as usize].height;
            let rr_h = if right_right != -1 { self.nodes[right_right as usize].height } else { -1 };
            self.nodes[idx as usize].height = 1 + left_height.max(rr_h);
            
            self.nodes[right_idx as usize].height = 1 + self.nodes[idx as usize].height.max(rl_height);
        } else {
            self.nodes[right_idx as usize].right = right_right;
            self.nodes[idx as usize].right = right_left;
            if right_left != -1 {
                self.nodes[right_left as usize].parent = idx;
            }
            
            let left_aabb = self.nodes[self.nodes[idx as usize].left as usize].aabb;
            let rl_aabb = if right_left != -1 { self.nodes[right_left as usize].aabb } else { left_aabb };
            self.nodes[idx as usize].aabb = left_aabb.merge(&rl_aabb);
            
            let idx_aabb = self.nodes[idx as usize].aabb;
            let rr_aabb = self.nodes[right_right as usize].aabb;
            self.nodes[right_idx as usize].aabb = idx_aabb.merge(&rr_aabb);
            
            let left_height = self.nodes[self.nodes[idx as usize].left as usize].height;
            let rl_h = if right_left != -1 { self.nodes[right_left as usize].height } else { -1 };
            self.nodes[idx as usize].height = 1 + left_height.max(rl_h);
            
            self.nodes[right_idx as usize].height = 1 + self.nodes[idx as usize].height.max(rr_height);
        }
        
        right_idx
    }
    
    fn rotate_right(&mut self, idx: i32) -> i32 {
        let left_idx = self.nodes[idx as usize].left;
        let left_left = self.nodes[left_idx as usize].left;
        let left_right = self.nodes[left_idx as usize].right;
        
        let parent = self.nodes[idx as usize].parent;
        self.nodes[left_idx as usize].left = idx;
        self.nodes[left_idx as usize].parent = parent;
        self.nodes[idx as usize].parent = left_idx;
        
        if parent != -1 {
            let p = &mut self.nodes[parent as usize];
            if p.left == idx {
                p.left = left_idx;
            } else {
                p.right = left_idx;
            }
        } else {
            self.root = left_idx;
        }
        
        let ll_height = if left_left != -1 { self.nodes[left_left as usize].height } else { -1 };
        let lr_height = if left_right != -1 { self.nodes[left_right as usize].height } else { -1 };
        
        if ll_height > lr_height {
            self.nodes[left_idx as usize].right = left_left;
            self.nodes[idx as usize].left = left_right;
            if left_right != -1 {
                self.nodes[left_right as usize].parent = idx;
            }
            
            let right_aabb = self.nodes[self.nodes[idx as usize].right as usize].aabb;
            let lr_aabb = if left_right != -1 { self.nodes[left_right as usize].aabb } else { right_aabb };
            self.nodes[idx as usize].aabb = right_aabb.merge(&lr_aabb);
            
            let idx_aabb = self.nodes[idx as usize].aabb;
            let ll_aabb = self.nodes[left_left as usize].aabb;
            self.nodes[left_idx as usize].aabb = idx_aabb.merge(&ll_aabb);
            
            let right_height = self.nodes[self.nodes[idx as usize].right as usize].height;
            let lr_h = if left_right != -1 { self.nodes[left_right as usize].height } else { -1 };
            self.nodes[idx as usize].height = 1 + right_height.max(lr_h);
            
            self.nodes[left_idx as usize].height = 1 + self.nodes[idx as usize].height.max(ll_height);
        } else {
            self.nodes[left_idx as usize].right = left_right;
            self.nodes[idx as usize].left = left_left;
            if left_left != -1 {
                self.nodes[left_left as usize].parent = idx;
            }
            
            let right_aabb = self.nodes[self.nodes[idx as usize].right as usize].aabb;
            let ll_aabb = if left_left != -1 { self.nodes[left_left as usize].aabb } else { right_aabb };
            self.nodes[idx as usize].aabb = right_aabb.merge(&ll_aabb);
            
            let idx_aabb = self.nodes[idx as usize].aabb;
            let lr_aabb = self.nodes[left_right as usize].aabb;
            self.nodes[left_idx as usize].aabb = idx_aabb.merge(&lr_aabb);
            
            let right_height = self.nodes[self.nodes[idx as usize].right as usize].height;
            let ll_h = if left_left != -1 { self.nodes[left_left as usize].height } else { -1 };
            self.nodes[idx as usize].height = 1 + right_height.max(ll_h);
            
            self.nodes[left_idx as usize].height = 1 + self.nodes[idx as usize].height.max(lr_height);
        }
        
        left_idx
    }
}

