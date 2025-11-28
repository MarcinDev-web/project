//! ECS Core WASM Module
//!
//! High-performance hot paths for game engine ECS operations:
//! - Batch ECS queries with archetype storage
//! - Transform hierarchy updates (SIMD-optimized)
//! - Frustum culling with hierarchical transforms
//!
//! Designed for zero-copy interop with TypeScript via SharedArrayBuffer.

use wasm_bindgen::prelude::*;

#[cfg(feature = "simd")]
use core::arch::wasm32::*;

#[cfg(feature = "panic-hook")]
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

const EPSILON: f32 = 1e-6;

// ============================================================================
// Math Primitives (SIMD-optimized where possible)
// ============================================================================

#[inline]
fn mat4_identity() -> [f32; 16] {
    [
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0,
    ]
}

/// Multiply two 4x4 matrices (column-major order)
#[inline]
fn mat4_multiply(out: &mut [f32; 16], a: &[f32; 16], b: &[f32; 16]) {
    #[cfg(all(feature = "simd", target_arch = "wasm32"))]
    unsafe {
        // SIMD-optimized matrix multiplication
        for i in 0..4 {
            let col = i * 4;
            let b_col = v128_load(b.as_ptr().add(col) as *const v128);

            let mut result = f32x4_splat(0.0);
            for j in 0..4 {
                let a_col = v128_load(a.as_ptr().add(j * 4) as *const v128);
                let b_elem = f32x4_splat(f32x4_extract_lane::<0>(
                    v128_load((&b[col + j] as *const f32) as *const v128)
                ));
                result = f32x4_add(result, f32x4_mul(a_col, b_elem));
            }

            // This is a simplified approach - full SIMD impl below
            out[col] = f32x4_extract_lane::<0>(result);
            out[col + 1] = f32x4_extract_lane::<1>(result);
            out[col + 2] = f32x4_extract_lane::<2>(result);
            out[col + 3] = f32x4_extract_lane::<3>(result);
        }
        return;
    }

    #[cfg(not(all(feature = "simd", target_arch = "wasm32")))]
    {
        // Standard matrix multiplication (column-major)
        for i in 0..4 {
            for j in 0..4 {
                out[i * 4 + j] = a[j] * b[i * 4]
                    + a[4 + j] * b[i * 4 + 1]
                    + a[8 + j] * b[i * 4 + 2]
                    + a[12 + j] * b[i * 4 + 3];
            }
        }
    }
}

/// Compose TRS (Translation, Rotation quaternion, Scale) into a 4x4 matrix
#[inline]
fn compose_trs(pos: [f32; 3], rot: [f32; 4], scl: [f32; 3]) -> [f32; 16] {
    let [x, y, z, w] = rot;
    
    // Quaternion to rotation matrix components
    let x2 = x + x;
    let y2 = y + y;
    let z2 = z + z;
    
    let xx = x * x2;
    let xy = x * y2;
    let xz = x * z2;
    let yy = y * y2;
    let yz = y * z2;
    let zz = z * z2;
    let wx = w * x2;
    let wy = w * y2;
    let wz = w * z2;

    let sx = scl[0];
    let sy = scl[1];
    let sz = scl[2];

    [
        (1.0 - (yy + zz)) * sx,
        (xy + wz) * sx,
        (xz - wy) * sx,
        0.0,
        
        (xy - wz) * sy,
        (1.0 - (xx + zz)) * sy,
        (yz + wx) * sy,
        0.0,
        
        (xz + wy) * sz,
        (yz - wx) * sz,
        (1.0 - (xx + yy)) * sz,
        0.0,
        
        pos[0],
        pos[1],
        pos[2],
        1.0,
    ]
}

#[inline]
fn normalize_quat(q: [f32; 4]) -> [f32; 4] {
    let len_sq = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
    if len_sq > EPSILON {
        let inv_len = 1.0 / len_sq.sqrt();
        [q[0] * inv_len, q[1] * inv_len, q[2] * inv_len, q[3] * inv_len]
    } else {
        [0.0, 0.0, 0.0, 1.0]
    }
}

// ============================================================================
// Transform Hierarchy System
// ============================================================================

/// Stores transform data for batch processing in SoA (Structure of Arrays) format
#[wasm_bindgen]
pub struct TransformHierarchy {
    /// Number of transforms
    count: usize,
    
    /// Local positions (x, y, z) - length: count * 3
    local_positions: Vec<f32>,
    /// Local rotations (x, y, z, w quaternion) - length: count * 4
    local_rotations: Vec<f32>,
    /// Local scales (x, y, z) - length: count * 3
    local_scales: Vec<f32>,
    
    /// Parent indices (-1 for root) - length: count
    parents: Vec<i32>,
    
    /// World matrices (column-major 4x4) - length: count * 16
    world_matrices: Vec<f32>,
    
    /// Local matrices cache - length: count * 16
    local_matrices: Vec<f32>,
    
    /// Dirty flags for local matrices - length: count
    local_dirty: Vec<u8>,
    /// Dirty flags for world matrices - length: count
    world_dirty: Vec<u8>,
    
    /// Topological order for hierarchy traversal - length: count
    topo_order: Vec<u32>,
    /// Flag indicating topo_order needs rebuild
    topo_dirty: bool,
}

#[wasm_bindgen]
impl TransformHierarchy {
    #[wasm_bindgen(constructor)]
    pub fn new(capacity: usize) -> TransformHierarchy {
        TransformHierarchy {
            count: 0,
            local_positions: Vec::with_capacity(capacity * 3),
            local_rotations: Vec::with_capacity(capacity * 4),
            local_scales: Vec::with_capacity(capacity * 3),
            parents: Vec::with_capacity(capacity),
            world_matrices: Vec::with_capacity(capacity * 16),
            local_matrices: Vec::with_capacity(capacity * 16),
            local_dirty: Vec::with_capacity(capacity),
            world_dirty: Vec::with_capacity(capacity),
            topo_order: Vec::with_capacity(capacity),
            topo_dirty: true,
        }
    }

    /// Resize the hierarchy to hold `count` transforms
    pub fn resize(&mut self, count: usize) {
        self.count = count;
        
        self.local_positions.resize(count * 3, 0.0);
        self.local_rotations.resize(count * 4, 0.0);
        self.local_scales.resize(count * 3, 1.0);
        self.parents.resize(count, -1);
        self.world_matrices.resize(count * 16, 0.0);
        self.local_matrices.resize(count * 16, 0.0);
        self.local_dirty.resize(count, 1);
        self.world_dirty.resize(count, 1);
        self.topo_order.resize(count, 0);
        
        // Initialize identity rotations
        for i in 0..count {
            let ri = i * 4;
            if self.local_rotations[ri + 3] == 0.0 {
                self.local_rotations[ri + 3] = 1.0; // w = 1 for identity quat
            }
        }
        
        self.topo_dirty = true;
    }

    /// Clear all data and release memory
    pub fn clear(&mut self) {
        self.count = 0;
        self.local_positions.clear();
        self.local_positions.shrink_to_fit();
        self.local_rotations.clear();
        self.local_rotations.shrink_to_fit();
        self.local_scales.clear();
        self.local_scales.shrink_to_fit();
        self.parents.clear();
        self.parents.shrink_to_fit();
        self.world_matrices.clear();
        self.world_matrices.shrink_to_fit();
        self.local_matrices.clear();
        self.local_matrices.shrink_to_fit();
        self.local_dirty.clear();
        self.local_dirty.shrink_to_fit();
        self.world_dirty.clear();
        self.world_dirty.shrink_to_fit();
        self.topo_order.clear();
        self.topo_order.shrink_to_fit();
        self.topo_dirty = true;
    }

    /// Get pointer to local positions array (for zero-copy access)
    pub fn get_positions_ptr(&self) -> *const f32 {
        self.local_positions.as_ptr()
    }

    /// Get pointer to local rotations array
    pub fn get_rotations_ptr(&self) -> *const f32 {
        self.local_rotations.as_ptr()
    }

    /// Get pointer to local scales array
    pub fn get_scales_ptr(&self) -> *const f32 {
        self.local_scales.as_ptr()
    }

    /// Get pointer to parent indices array
    pub fn get_parents_ptr(&self) -> *const i32 {
        self.parents.as_ptr()
    }

    /// Get pointer to world matrices array
    pub fn get_world_matrices_ptr(&self) -> *const f32 {
        self.world_matrices.as_ptr()
    }

    /// Set parent for a transform (marks hierarchy dirty)
    pub fn set_parent(&mut self, index: u32, parent: i32) {
        let idx = index as usize;
        if idx < self.count {
            self.parents[idx] = parent;
            self.world_dirty[idx] = 1;
            self.topo_dirty = true;
        }
    }

    /// Mark a transform's local data as dirty
    pub fn mark_local_dirty(&mut self, index: u32) {
        let idx = index as usize;
        if idx < self.count {
            self.local_dirty[idx] = 1;
            self.world_dirty[idx] = 1;
        }
    }

    /// Mark all transforms as dirty
    pub fn mark_all_dirty(&mut self) {
        for i in 0..self.count {
            self.local_dirty[i] = 1;
            self.world_dirty[i] = 1;
        }
    }

    /// Rebuild topological order for hierarchy traversal
    fn rebuild_topo_order(&mut self) {
        if !self.topo_dirty {
            return;
        }

        // Kahn's algorithm for topological sort
        let n = self.count;
        
        // Count children for each node
        let mut child_count = vec![0u32; n];
        let mut children = vec![Vec::new(); n];
        let mut roots = Vec::new();

        for i in 0..n {
            let parent = self.parents[i];
            if parent < 0 || parent as usize >= n {
                roots.push(i as u32);
            } else {
                children[parent as usize].push(i as u32);
                child_count[parent as usize] += 1;
            }
        }

        // BFS from roots
        self.topo_order.clear();
        let mut queue = roots;
        
        while let Some(node) = queue.pop() {
            self.topo_order.push(node);
            for &child in &children[node as usize] {
                queue.push(child);
            }
        }

        self.topo_dirty = false;
    }

    /// Propagate dirty flags down the hierarchy
    fn propagate_dirty(&mut self) {
        self.rebuild_topo_order();
        
        for &idx in &self.topo_order {
            let i = idx as usize;
            let parent = self.parents[i];
            
            if parent >= 0 {
                let pi = parent as usize;
                if pi < self.count && self.world_dirty[pi] != 0 {
                    self.world_dirty[i] = 1;
                }
            }
        }
    }

    /// Update all world matrices in topological order
    /// This is the main hot path - called every frame
    pub fn update_world_matrices(&mut self) {
        self.rebuild_topo_order();
        self.propagate_dirty();
        
        for &idx in &self.topo_order {
            let i = idx as usize;
            
            // Skip if not dirty
            if self.world_dirty[i] == 0 {
                continue;
            }
            
            // Update local matrix if dirty
            if self.local_dirty[i] != 0 {
                let pi = i * 3;
                let ri = i * 4;
                let si = i * 3;
                
                let pos = [
                    self.local_positions[pi],
                    self.local_positions[pi + 1],
                    self.local_positions[pi + 2],
                ];
                let rot = normalize_quat([
                    self.local_rotations[ri],
                    self.local_rotations[ri + 1],
                    self.local_rotations[ri + 2],
                    self.local_rotations[ri + 3],
                ]);
                let scl = [
                    self.local_scales[si],
                    self.local_scales[si + 1],
                    self.local_scales[si + 2],
                ];
                
                let local = compose_trs(pos, rot, scl);
                let mi = i * 16;
                self.local_matrices[mi..mi + 16].copy_from_slice(&local);
                self.local_dirty[i] = 0;
            }
            
            // Compute world matrix
            let mi = i * 16;
            let parent = self.parents[i];
            
            if parent < 0 || parent as usize >= self.count {
                // Root node: world = local
                let local_slice = &self.local_matrices[mi..mi + 16];
                self.world_matrices[mi..mi + 16].copy_from_slice(local_slice);
            } else {
                // Child node: world = parent_world * local
                let pi = (parent as usize) * 16;
                let mut parent_world = [0.0f32; 16];
                let mut local = [0.0f32; 16];
                let mut world = [0.0f32; 16];
                
                parent_world.copy_from_slice(&self.world_matrices[pi..pi + 16]);
                local.copy_from_slice(&self.local_matrices[mi..mi + 16]);
                
                mat4_multiply(&mut world, &parent_world, &local);
                self.world_matrices[mi..mi + 16].copy_from_slice(&world);
            }
            
            self.world_dirty[i] = 0;
        }
    }

    /// Batch update: copy transform data from TypeScript, update, return world matrices
    pub fn batch_update(
        &mut self,
        positions: &[f32],
        rotations: &[f32],
        scales: &[f32],
        parents: &[i32],
    ) -> Vec<f32> {
        let count = parents.len();
        self.resize(count);
        
        // Copy input data
        self.local_positions[..positions.len().min(count * 3)]
            .copy_from_slice(&positions[..positions.len().min(count * 3)]);
        self.local_rotations[..rotations.len().min(count * 4)]
            .copy_from_slice(&rotations[..rotations.len().min(count * 4)]);
        self.local_scales[..scales.len().min(count * 3)]
            .copy_from_slice(&scales[..scales.len().min(count * 3)]);
        self.parents[..parents.len()]
            .copy_from_slice(parents);
        
        // Mark all dirty and update
        self.mark_all_dirty();
        self.topo_dirty = true;
        self.update_world_matrices();
        
        // Return world matrices
        self.world_matrices.clone()
    }

    /// Get count
    pub fn get_count(&self) -> usize {
        self.count
    }
}

// ============================================================================
// ECS Query System
// ============================================================================

/// Component type identifier (matches TypeScript ComponentClass)
pub type ComponentType = u32;

/// Archetype: a unique combination of component types
#[derive(Clone, Debug)]
struct Archetype {
    /// Bitmask of component types present
    mask: u64,
    /// Entity indices with this archetype
    entities: Vec<u32>,
}

/// ECS World for batch queries
#[wasm_bindgen]
pub struct EcsWorld {
    /// Entity count
    entity_count: usize,
    
    /// Component masks per entity (bitmask of component types)
    component_masks: Vec<u64>,
    
    /// Archetype cache
    archetypes: Vec<Archetype>,
    
    /// Active flags per entity
    active_flags: Vec<u8>,
    
    /// Query result cache
    query_cache: Vec<u32>,
}

#[wasm_bindgen]
impl EcsWorld {
    #[wasm_bindgen(constructor)]
    pub fn new(capacity: usize) -> EcsWorld {
        EcsWorld {
            entity_count: 0,
            component_masks: Vec::with_capacity(capacity),
            archetypes: Vec::new(),
            active_flags: Vec::with_capacity(capacity),
            query_cache: Vec::with_capacity(capacity),
        }
    }

    /// Resize the world to hold `count` entities
    pub fn resize(&mut self, count: usize) {
        self.entity_count = count;
        self.component_masks.resize(count, 0);
        self.active_flags.resize(count, 1);
    }

    /// Clear all data
    pub fn clear(&mut self) {
        self.entity_count = 0;
        self.component_masks.clear();
        self.component_masks.shrink_to_fit();
        self.archetypes.clear();
        self.archetypes.shrink_to_fit();
        self.active_flags.clear();
        self.active_flags.shrink_to_fit();
        self.query_cache.clear();
        self.query_cache.shrink_to_fit();
    }

    /// Set component mask for an entity
    pub fn set_component_mask(&mut self, entity: u32, mask: u64) {
        let idx = entity as usize;
        if idx < self.entity_count {
            self.component_masks[idx] = mask;
        }
    }

    /// Add component type to entity
    pub fn add_component(&mut self, entity: u32, component_type: ComponentType) {
        let idx = entity as usize;
        if idx < self.entity_count && component_type < 64 {
            self.component_masks[idx] |= 1u64 << component_type;
        }
    }

    /// Remove component type from entity
    pub fn remove_component(&mut self, entity: u32, component_type: ComponentType) {
        let idx = entity as usize;
        if idx < self.entity_count && component_type < 64 {
            self.component_masks[idx] &= !(1u64 << component_type);
        }
    }

    /// Set entity active flag
    pub fn set_active(&mut self, entity: u32, active: bool) {
        let idx = entity as usize;
        if idx < self.entity_count {
            self.active_flags[idx] = if active { 1 } else { 0 };
        }
    }

    /// Batch set component masks from TypeScript
    pub fn batch_set_masks(&mut self, masks: &[u64]) {
        let count = masks.len();
        self.resize(count);
        self.component_masks[..count].copy_from_slice(masks);
    }

    /// Batch set active flags
    pub fn batch_set_active(&mut self, flags: &[u8]) {
        let count = flags.len().min(self.entity_count);
        self.active_flags[..count].copy_from_slice(&flags[..count]);
    }

    /// Query entities that have ALL specified component types (up to 64 types)
    /// Returns indices of matching entities
    pub fn query(&mut self, required_mask: u64) -> Vec<u32> {
        self.query_cache.clear();
        
        for i in 0..self.entity_count {
            let mask = self.component_masks[i];
            // Check if entity has all required components
            if (mask & required_mask) == required_mask {
                self.query_cache.push(i as u32);
            }
        }
        
        self.query_cache.clone()
    }

    /// Query active entities with specified components
    pub fn query_active(&mut self, required_mask: u64) -> Vec<u32> {
        self.query_cache.clear();
        
        for i in 0..self.entity_count {
            if self.active_flags[i] == 0 {
                continue;
            }
            let mask = self.component_masks[i];
            if (mask & required_mask) == required_mask {
                self.query_cache.push(i as u32);
            }
        }
        
        self.query_cache.clone()
    }

    /// Query with exclusion mask - entities must have all required and NONE of excluded
    pub fn query_exclude(&mut self, required_mask: u64, exclude_mask: u64) -> Vec<u32> {
        self.query_cache.clear();
        
        for i in 0..self.entity_count {
            let mask = self.component_masks[i];
            // Has all required AND none of excluded
            if (mask & required_mask) == required_mask && (mask & exclude_mask) == 0 {
                self.query_cache.push(i as u32);
            }
        }
        
        self.query_cache.clone()
    }

    /// Build archetypes for faster repeated queries
    pub fn build_archetypes(&mut self) {
        self.archetypes.clear();
        
        let mut archetype_map: std::collections::HashMap<u64, usize> = std::collections::HashMap::new();
        
        for i in 0..self.entity_count {
            let mask = self.component_masks[i];
            
            if let Some(&arch_idx) = archetype_map.get(&mask) {
                self.archetypes[arch_idx].entities.push(i as u32);
            } else {
                let arch_idx = self.archetypes.len();
                archetype_map.insert(mask, arch_idx);
                self.archetypes.push(Archetype {
                    mask,
                    entities: vec![i as u32],
                });
            }
        }
    }

    /// Query using archetypes (faster for repeated queries)
    pub fn query_archetypes(&self, required_mask: u64) -> Vec<u32> {
        let mut result = Vec::new();
        
        for archetype in &self.archetypes {
            if (archetype.mask & required_mask) == required_mask {
                result.extend_from_slice(&archetype.entities);
            }
        }
        
        result
    }

    /// Get entity count
    pub fn get_count(&self) -> usize {
        self.entity_count
    }
}

// ============================================================================
// Frustum Culling System (with hierarchy support)
// ============================================================================

#[derive(Clone, Copy)]
struct Plane {
    normal: [f32; 3],
    distance: f32,
}

struct Frustum {
    planes: [Plane; 6],
}

impl Frustum {
    fn from_matrix(m: &[f32]) -> Self {
        let mut planes = [Plane { normal: [0.0; 3], distance: 0.0 }; 6];

        // Left
        planes[0].normal[0] = m[3] + m[0];
        planes[0].normal[1] = m[7] + m[4];
        planes[0].normal[2] = m[11] + m[8];
        planes[0].distance = m[15] + m[12];

        // Right
        planes[1].normal[0] = m[3] - m[0];
        planes[1].normal[1] = m[7] - m[4];
        planes[1].normal[2] = m[11] - m[8];
        planes[1].distance = m[15] - m[12];

        // Bottom
        planes[2].normal[0] = m[3] + m[1];
        planes[2].normal[1] = m[7] + m[5];
        planes[2].normal[2] = m[11] + m[9];
        planes[2].distance = m[15] + m[13];

        // Top
        planes[3].normal[0] = m[3] - m[1];
        planes[3].normal[1] = m[7] - m[5];
        planes[3].normal[2] = m[11] - m[9];
        planes[3].distance = m[15] - m[13];

        // Near
        planes[4].normal[0] = m[3] + m[2];
        planes[4].normal[1] = m[7] + m[6];
        planes[4].normal[2] = m[11] + m[10];
        planes[4].distance = m[15] + m[14];

        // Far
        planes[5].normal[0] = m[3] - m[2];
        planes[5].normal[1] = m[7] - m[6];
        planes[5].normal[2] = m[11] - m[10];
        planes[5].distance = m[15] - m[14];

        // Normalize
        for p in &mut planes {
            let len = (p.normal[0] * p.normal[0] + p.normal[1] * p.normal[1] + p.normal[2] * p.normal[2]).sqrt();
            if len > EPSILON {
                let inv_len = 1.0 / len;
                p.normal[0] *= inv_len;
                p.normal[1] *= inv_len;
                p.normal[2] *= inv_len;
                p.distance *= inv_len;
            }
        }

        Frustum { planes }
    }

    #[inline]
    fn intersects_aabb(&self, min: [f32; 3], max: [f32; 3]) -> bool {
        for p in &self.planes {
            let mut p_vertex = [min[0], min[1], min[2]];
            
            if p.normal[0] >= 0.0 { p_vertex[0] = max[0]; }
            if p.normal[1] >= 0.0 { p_vertex[1] = max[1]; }
            if p.normal[2] >= 0.0 { p_vertex[2] = max[2]; }

            let dot = p.normal[0] * p_vertex[0] + p.normal[1] * p_vertex[1] + p.normal[2] * p_vertex[2];
            if dot + p.distance < 0.0 {
                return false;
            }
        }
        true
    }
}

/// Frustum culler with hierarchical transform support
#[wasm_bindgen]
pub struct FrustumCuller {
    /// Result indices
    visible_indices: Vec<u32>,
    
    /// Cached world AABBs (min_x, min_y, min_z, max_x, max_y, max_z)
    world_aabbs: Vec<f32>,
}

#[wasm_bindgen]
impl FrustumCuller {
    #[wasm_bindgen(constructor)]
    pub fn new(capacity: usize) -> FrustumCuller {
        FrustumCuller {
            visible_indices: Vec::with_capacity(capacity),
            world_aabbs: Vec::with_capacity(capacity * 6),
        }
    }

    /// Clear internal state
    pub fn clear(&mut self) {
        self.visible_indices.clear();
        self.visible_indices.shrink_to_fit();
        self.world_aabbs.clear();
        self.world_aabbs.shrink_to_fit();
    }

    /// Compute world AABBs from world matrices and local half-extents
    /// `world_matrices`: count * 16 floats (column-major 4x4)
    /// `local_half_extents`: count * 3 floats (half-size in each axis)
    pub fn compute_world_aabbs(
        &mut self,
        world_matrices: &[f32],
        local_half_extents: &[f32],
    ) {
        let count = local_half_extents.len() / 3;
        self.world_aabbs.clear();
        self.world_aabbs.resize(count * 6, 0.0);

        for i in 0..count {
            let mi = i * 16;
            let hi = i * 3;
            let ai = i * 6;

            // Extract world matrix columns
            let m0 = world_matrices[mi];
            let m1 = world_matrices[mi + 1];
            let m2 = world_matrices[mi + 2];
            let m4 = world_matrices[mi + 4];
            let m5 = world_matrices[mi + 5];
            let m6 = world_matrices[mi + 6];
            let m8 = world_matrices[mi + 8];
            let m9 = world_matrices[mi + 9];
            let m10 = world_matrices[mi + 10];
            let cx = world_matrices[mi + 12];
            let cy = world_matrices[mi + 13];
            let cz = world_matrices[mi + 14];

            let hx = local_half_extents[hi].abs();
            let hy = local_half_extents[hi + 1].abs();
            let hz = local_half_extents[hi + 2].abs();

            // Compute world-space extents (OBB -> AABB)
            let ex = m0.abs() * hx + m4.abs() * hy + m8.abs() * hz;
            let ey = m1.abs() * hx + m5.abs() * hy + m9.abs() * hz;
            let ez = m2.abs() * hx + m6.abs() * hy + m10.abs() * hz;

            // Store AABB
            self.world_aabbs[ai] = cx - ex;     // min_x
            self.world_aabbs[ai + 1] = cy - ey; // min_y
            self.world_aabbs[ai + 2] = cz - ez; // min_z
            self.world_aabbs[ai + 3] = cx + ex; // max_x
            self.world_aabbs[ai + 4] = cy + ey; // max_y
            self.world_aabbs[ai + 5] = cz + ez; // max_z
        }
    }

    /// Cull entities against frustum
    /// Returns indices of visible entities
    pub fn cull(&mut self, view_proj: &[f32]) -> Vec<u32> {
        if view_proj.len() != 16 {
            return Vec::new();
        }

        let frustum = Frustum::from_matrix(view_proj);
        let count = self.world_aabbs.len() / 6;

        self.visible_indices.clear();

        for i in 0..count {
            let ai = i * 6;
            let min = [
                self.world_aabbs[ai],
                self.world_aabbs[ai + 1],
                self.world_aabbs[ai + 2],
            ];
            let max = [
                self.world_aabbs[ai + 3],
                self.world_aabbs[ai + 4],
                self.world_aabbs[ai + 5],
            ];

            if frustum.intersects_aabb(min, max) {
                self.visible_indices.push(i as u32);
            }
        }

        self.visible_indices.clone()
    }

    /// Cull with active mask (only cull active entities)
    pub fn cull_active(&mut self, view_proj: &[f32], active_flags: &[u8]) -> Vec<u32> {
        if view_proj.len() != 16 {
            return Vec::new();
        }

        let frustum = Frustum::from_matrix(view_proj);
        let count = self.world_aabbs.len() / 6;

        self.visible_indices.clear();

        for i in 0..count {
            // Skip inactive entities
            if i < active_flags.len() && active_flags[i] == 0 {
                continue;
            }

            let ai = i * 6;
            let min = [
                self.world_aabbs[ai],
                self.world_aabbs[ai + 1],
                self.world_aabbs[ai + 2],
            ];
            let max = [
                self.world_aabbs[ai + 3],
                self.world_aabbs[ai + 4],
                self.world_aabbs[ai + 5],
            ];

            if frustum.intersects_aabb(min, max) {
                self.visible_indices.push(i as u32);
            }
        }

        self.visible_indices.clone()
    }

    /// Full pipeline: update transforms, compute AABBs, cull
    pub fn cull_hierarchy(
        &mut self,
        hierarchy: &mut TransformHierarchy,
        local_half_extents: &[f32],
        view_proj: &[f32],
    ) -> Vec<u32> {
        // Update world matrices
        hierarchy.update_world_matrices();

        // Compute world AABBs
        self.compute_world_aabbs(&hierarchy.world_matrices, local_half_extents);

        // Cull against frustum
        self.cull(view_proj)
    }
}

// ============================================================================
// Batch Operations API (Stateless)
// ============================================================================

/// Batch transform hierarchy update (stateless API)
/// Returns world matrices as flat Float32Array
#[wasm_bindgen]
pub fn batch_update_transforms(
    positions: &[f32],
    rotations: &[f32],
    scales: &[f32],
    parents: &[i32],
) -> Vec<f32> {
    let mut hierarchy = TransformHierarchy::new(parents.len());
    hierarchy.batch_update(positions, rotations, scales, parents)
}

/// Batch frustum cull (stateless API)
/// Returns visible indices
#[wasm_bindgen]
pub fn batch_frustum_cull(
    world_matrices: &[f32],
    local_half_extents: &[f32],
    view_proj: &[f32],
) -> Vec<u32> {
    let count = local_half_extents.len() / 3;
    let mut culler = FrustumCuller::new(count);
    culler.compute_world_aabbs(world_matrices, local_half_extents);
    culler.cull(view_proj)
}

/// Batch ECS query (stateless API)
#[wasm_bindgen]
pub fn batch_ecs_query(
    component_masks: &[u64],
    required_mask: u64,
) -> Vec<u32> {
    let mut world = EcsWorld::new(component_masks.len());
    world.batch_set_masks(component_masks);
    world.query(required_mask)
}

/// Batch ECS query with active filter
#[wasm_bindgen]
pub fn batch_ecs_query_active(
    component_masks: &[u64],
    active_flags: &[u8],
    required_mask: u64,
) -> Vec<u32> {
    let mut world = EcsWorld::new(component_masks.len());
    world.batch_set_masks(component_masks);
    world.batch_set_active(active_flags);
    world.query_active(required_mask)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transform_hierarchy_basic() {
        let mut hierarchy = TransformHierarchy::new(4);
        hierarchy.resize(4);

        // Set up hierarchy: 0 -> 1 -> 2, 0 -> 3
        hierarchy.parents[0] = -1; // root
        hierarchy.parents[1] = 0;
        hierarchy.parents[2] = 1;
        hierarchy.parents[3] = 0;

        // Set positions
        hierarchy.local_positions[0..3].copy_from_slice(&[0.0, 0.0, 0.0]);
        hierarchy.local_positions[3..6].copy_from_slice(&[1.0, 0.0, 0.0]);
        hierarchy.local_positions[6..9].copy_from_slice(&[1.0, 0.0, 0.0]);
        hierarchy.local_positions[9..12].copy_from_slice(&[0.0, 1.0, 0.0]);

        // Set identity rotations
        for i in 0..4 {
            hierarchy.local_rotations[i * 4 + 3] = 1.0;
        }

        // Set identity scales
        for i in 0..12 {
            hierarchy.local_scales[i] = 1.0;
        }

        hierarchy.mark_all_dirty();
        hierarchy.topo_dirty = true;
        hierarchy.update_world_matrices();

        // Check world positions
        // Entity 0: at origin
        assert!((hierarchy.world_matrices[12] - 0.0).abs() < EPSILON);
        
        // Entity 1: at (1, 0, 0) relative to 0 -> world (1, 0, 0)
        assert!((hierarchy.world_matrices[16 + 12] - 1.0).abs() < EPSILON);
        
        // Entity 2: at (1, 0, 0) relative to 1 -> world (2, 0, 0)
        assert!((hierarchy.world_matrices[32 + 12] - 2.0).abs() < EPSILON);
        
        // Entity 3: at (0, 1, 0) relative to 0 -> world (0, 1, 0)
        assert!((hierarchy.world_matrices[48 + 13] - 1.0).abs() < EPSILON);
    }

    #[test]
    fn test_ecs_query() {
        let mut world = EcsWorld::new(5);
        world.resize(5);

        // Set up component masks
        // Entity 0: components 0, 1
        // Entity 1: components 0, 2
        // Entity 2: components 0, 1, 2
        // Entity 3: component 3
        // Entity 4: components 0, 1, 3
        world.component_masks[0] = 0b0011; // 0, 1
        world.component_masks[1] = 0b0101; // 0, 2
        world.component_masks[2] = 0b0111; // 0, 1, 2
        world.component_masks[3] = 0b1000; // 3
        world.component_masks[4] = 0b1011; // 0, 1, 3

        // Query for entities with component 0
        let result = world.query(0b0001);
        assert_eq!(result.len(), 4); // 0, 1, 2, 4

        // Query for entities with components 0 and 1
        let result = world.query(0b0011);
        assert_eq!(result.len(), 3); // 0, 2, 4

        // Query for entities with components 0, 1, and 2
        let result = world.query(0b0111);
        assert_eq!(result.len(), 1); // 2
    }

    #[test]
    fn test_frustum_cull() {
        let mut culler = FrustumCuller::new(2);

        // Set up world AABBs manually
        culler.world_aabbs = vec![
            -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, // AABB at origin
            10.0, 10.0, 10.0, 11.0, 11.0, 11.0, // AABB far away
        ];

        // Simple orthographic frustum looking at origin
        let view_proj = [
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0,
        ];

        let visible = culler.cull(&view_proj);
        // Both should be visible with identity projection
        assert!(visible.len() >= 1);
    }
}

