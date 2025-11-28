//! Loose Octree implementation
//!
//! Loose octrees expand node bounds by a "looseness" factor, allowing objects
//! to move slightly without requiring re-insertion. This drastically reduces
//! update costs for dynamic scenes.

use crate::AABB;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

/// Loose Octree node
struct LooseOctreeNode {
    /// Tight bounds (actual octant)
    tight_bounds: AABB,
    /// Loose bounds (expanded)
    loose_bounds: AABB,
    /// Entity IDs in this node
    entities: Vec<u32>,
    /// Child node indices (8 octants), -1 if no child
    children: [i32; 8],
    /// Depth in tree
    depth: u32,
    /// Is this a leaf node?
    is_leaf: bool,
}

impl LooseOctreeNode {
    fn new(tight_bounds: AABB, looseness: f32, depth: u32) -> Self {
        let size_x = tight_bounds.max_x - tight_bounds.min_x;
        let size_y = tight_bounds.max_y - tight_bounds.min_y;
        let size_z = tight_bounds.max_z - tight_bounds.min_z;
        
        let expand_x = (size_x * (looseness - 1.0)) / 2.0;
        let expand_y = (size_y * (looseness - 1.0)) / 2.0;
        let expand_z = (size_z * (looseness - 1.0)) / 2.0;
        
        let loose_bounds = AABB {
            min_x: tight_bounds.min_x - expand_x,
            min_y: tight_bounds.min_y - expand_y,
            min_z: tight_bounds.min_z - expand_z,
            max_x: tight_bounds.max_x + expand_x,
            max_y: tight_bounds.max_y + expand_y,
            max_z: tight_bounds.max_z + expand_z,
        };
        
        Self {
            tight_bounds,
            loose_bounds,
            entities: Vec::new(),
            children: [-1; 8],
            depth,
            is_leaf: true,
        }
    }
    
    /// Gets octant index for a point (0-7)
    fn get_octant(&self, x: f32, y: f32, z: f32) -> usize {
        let center_x = (self.tight_bounds.min_x + self.tight_bounds.max_x) * 0.5;
        let center_y = (self.tight_bounds.min_y + self.tight_bounds.max_y) * 0.5;
        let center_z = (self.tight_bounds.min_z + self.tight_bounds.max_z) * 0.5;
        
        let mut index = 0;
        if x >= center_x { index |= 1; }
        if y >= center_y { index |= 2; }
        if z >= center_z { index |= 4; }
        index
    }
    
    /// Gets child bounds for an octant
    fn get_child_bounds(&self, octant: usize) -> AABB {
        let center_x = (self.tight_bounds.min_x + self.tight_bounds.max_x) * 0.5;
        let center_y = (self.tight_bounds.min_y + self.tight_bounds.max_y) * 0.5;
        let center_z = (self.tight_bounds.min_z + self.tight_bounds.max_z) * 0.5;
        
        let (min_x, max_x) = if octant & 1 != 0 { (center_x, self.tight_bounds.max_x) } else { (self.tight_bounds.min_x, center_x) };
        let (min_y, max_y) = if octant & 2 != 0 { (center_y, self.tight_bounds.max_y) } else { (self.tight_bounds.min_y, center_y) };
        let (min_z, max_z) = if octant & 4 != 0 { (center_z, self.tight_bounds.max_z) } else { (self.tight_bounds.min_z, center_z) };
        
        AABB { min_x, min_y, min_z, max_x, max_y, max_z }
    }
}

/// WASM-exposed Loose Octree
#[wasm_bindgen]
pub struct SpatialLooseOctree {
    nodes: Vec<LooseOctreeNode>,
    root: i32,
    entity_to_node: HashMap<u32, i32>,
    entity_aabbs: HashMap<u32, AABB>,
    looseness: f32,
    max_depth: u32,
    max_entities_per_node: usize,
    min_node_size: f32,
    
    // Stats
    insert_count: u32,
    update_count: u32,
    reinsert_count: u32,
}

#[wasm_bindgen]
impl SpatialLooseOctree {
    /// Creates a new Loose Octree
    /// bounds: [min_x, min_y, min_z, max_x, max_y, max_z]
    #[wasm_bindgen(constructor)]
    pub fn new(
        bounds: &[f32],
        looseness: f32,
        max_depth: u32,
        max_entities_per_node: usize,
        min_node_size: f32,
    ) -> Self {
        let root_bounds = if bounds.len() >= 6 {
            AABB::from_array(bounds).unwrap()
        } else {
            AABB::new(-100.0, -100.0, -100.0, 100.0, 100.0, 100.0)
        };
        
        let root_node = LooseOctreeNode::new(root_bounds, looseness, 0);
        
        Self {
            nodes: vec![root_node],
            root: 0,
            entity_to_node: HashMap::new(),
            entity_aabbs: HashMap::new(),
            looseness,
            max_depth,
            max_entities_per_node,
            min_node_size,
            insert_count: 0,
            update_count: 0,
            reinsert_count: 0,
        }
    }
    
    /// Clears all entities
    pub fn clear(&mut self) {
        let root_bounds = self.nodes[0].tight_bounds;
        self.nodes.clear();
        self.nodes.push(LooseOctreeNode::new(root_bounds, self.looseness, 0));
        self.root = 0;
        self.entity_to_node.clear();
        self.entity_aabbs.clear();
        self.insert_count = 0;
        self.update_count = 0;
        self.reinsert_count = 0;
    }
    
    /// Inserts an entity
    /// aabb: [min_x, min_y, min_z, max_x, max_y, max_z]
    pub fn insert(&mut self, entity_id: u32, aabb: &[f32]) {
        if aabb.len() < 6 {
            return;
        }
        
        let entity_aabb = AABB::from_array(aabb).unwrap();
        
        // Update if exists
        if self.entity_to_node.contains_key(&entity_id) {
            self.update(entity_id, aabb);
            return;
        }
        
        self.insert_count += 1;
        self.entity_aabbs.insert(entity_id, entity_aabb);
        
        self.insert_into_node(self.root, entity_id, entity_aabb);
    }
    
    /// Updates an entity - only re-inserts if outside loose bounds
    pub fn update(&mut self, entity_id: u32, aabb: &[f32]) -> bool {
        if aabb.len() < 6 {
            return false;
        }
        
        let new_aabb = AABB::from_array(aabb).unwrap();
        
        if let Some(&node_idx) = self.entity_to_node.get(&entity_id) {
            self.update_count += 1;
            
            let node = &self.nodes[node_idx as usize];
            
            // Fast path: still within loose bounds
            if node.loose_bounds.contains(&new_aabb) {
                self.entity_aabbs.insert(entity_id, new_aabb);
                return false;
            }
            
            // Slow path: need to re-insert
            self.reinsert_count += 1;
            self.remove(entity_id);
            self.insert(entity_id, aabb);
            return true;
        }
        
        // New entity
        self.insert(entity_id, aabb);
        true
    }
    
    /// Removes an entity
    pub fn remove(&mut self, entity_id: u32) -> bool {
        if let Some(node_idx) = self.entity_to_node.remove(&entity_id) {
            self.entity_aabbs.remove(&entity_id);
            
            let node = &mut self.nodes[node_idx as usize];
            if let Some(pos) = node.entities.iter().position(|&e| e == entity_id) {
                node.entities.swap_remove(pos);
            }
            true
        } else {
            false
        }
    }
    
    /// Queries entities intersecting AABB
    pub fn query(&self, aabb: &[f32]) -> Vec<u32> {
        let mut results = Vec::new();
        
        if aabb.len() < 6 || self.root < 0 {
            return results;
        }
        
        let query_aabb = AABB::from_array(aabb).unwrap();
        let mut stack = vec![self.root];
        
        while let Some(idx) = stack.pop() {
            let node = &self.nodes[idx as usize];
            
            if !query_aabb.intersects(&node.loose_bounds) {
                continue;
            }
            
            // Check entities in this node
            for &entity_id in &node.entities {
                if let Some(entity_aabb) = self.entity_aabbs.get(&entity_id) {
                    if query_aabb.intersects(entity_aabb) {
                        results.push(entity_id);
                    }
                }
            }
            
            // Recurse to children
            if !node.is_leaf {
                for &child_idx in &node.children {
                    if child_idx >= 0 {
                        stack.push(child_idx);
                    }
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
            self.insert_count,
            self.update_count,
            self.reinsert_count,
        ]
    }
    
    /// Resets stats
    pub fn reset_stats(&mut self) {
        self.insert_count = 0;
        self.update_count = 0;
        self.reinsert_count = 0;
    }
    
    // ==================== Internal Methods ====================
    
    fn insert_into_node(&mut self, node_idx: i32, entity_id: u32, aabb: AABB) {
        let node = &self.nodes[node_idx as usize];
        
        if !aabb.intersects(&node.loose_bounds) {
            return;
        }
        
        if node.is_leaf {
            // Insert into this node
            let should_split = {
                let node = &self.nodes[node_idx as usize];
                node.entities.len() >= self.max_entities_per_node &&
                node.depth < self.max_depth &&
                self.can_split(node_idx)
            };
            
            let node = &mut self.nodes[node_idx as usize];
            node.entities.push(entity_id);
            self.entity_to_node.insert(entity_id, node_idx);
            
            if should_split {
                self.split_node(node_idx);
            }
        } else {
            // Find best child based on AABB center
            let center = aabb.center();
            let node = &self.nodes[node_idx as usize];
            let octant = node.get_octant(center[0], center[1], center[2]);
            let child_idx = node.children[octant];
            
            if child_idx >= 0 {
                self.insert_into_node(child_idx, entity_id, aabb);
            }
        }
    }
    
    fn can_split(&self, node_idx: i32) -> bool {
        let node = &self.nodes[node_idx as usize];
        let size_x = node.tight_bounds.max_x - node.tight_bounds.min_x;
        let size_y = node.tight_bounds.max_y - node.tight_bounds.min_y;
        let size_z = node.tight_bounds.max_z - node.tight_bounds.min_z;
        let min_size = size_x.min(size_y).min(size_z);
        min_size > self.min_node_size * 2.0
    }
    
    fn split_node(&mut self, node_idx: i32) {
        let node = &self.nodes[node_idx as usize];
        let depth = node.depth;
        let entities: Vec<u32> = node.entities.clone();
        
        // Create children
        let mut child_indices = [-1i32; 8];
        for octant in 0..8 {
            let child_bounds = self.nodes[node_idx as usize].get_child_bounds(octant);
            let child_node = LooseOctreeNode::new(child_bounds, self.looseness, depth + 1);
            let child_idx = self.nodes.len() as i32;
            self.nodes.push(child_node);
            child_indices[octant] = child_idx;
        }
        
        {
            let node = &mut self.nodes[node_idx as usize];
            node.children = child_indices;
            node.is_leaf = false;
            node.entities.clear();
        }
        
        // Re-insert entities
        for entity_id in entities {
            if let Some(aabb) = self.entity_aabbs.get(&entity_id).copied() {
                self.entity_to_node.remove(&entity_id);
                
                let center = aabb.center();
                let node = &self.nodes[node_idx as usize];
                let octant = node.get_octant(center[0], center[1], center[2]);
                let child_idx = node.children[octant];
                
                if child_idx >= 0 {
                    let child = &mut self.nodes[child_idx as usize];
                    child.entities.push(entity_id);
                    self.entity_to_node.insert(entity_id, child_idx);
                }
            }
        }
    }
}

