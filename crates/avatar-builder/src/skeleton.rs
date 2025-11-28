//! Avatar skeleton system with joint hierarchy and world matrix computation.
//! 
//! Provides optimized skeleton operations for avatar animation:
//! - Joint hierarchy management
//! - Local-to-world matrix computation
//! - Pose manipulation

use wasm_bindgen::prelude::*;
use glam::{Vec3, Quat, Mat4};

/// Joint identifier (0-255 for compact representation)
pub type JointId = u8;

/// Maximum number of joints supported per skeleton
pub const MAX_JOINTS: usize = 64;

/// A single joint in the skeleton
#[derive(Clone, Copy)]
pub struct Joint {
    /// Parent joint index (-1 if root)
    pub parent: i8,
    /// Local translation
    pub translation: Vec3,
    /// Local rotation
    pub rotation: Quat,
    /// Local scale
    pub scale: Vec3,
}

impl Default for Joint {
    fn default() -> Self {
        Self {
            parent: -1,
            translation: Vec3::ZERO,
            rotation: Quat::IDENTITY,
            scale: Vec3::ONE,
        }
    }
}

/// Avatar skeleton with joint hierarchy and matrix caching.
/// 
/// Optimized for frequent pose updates in animation system.
#[wasm_bindgen]
pub struct AvatarSkeleton {
    joints: Vec<Joint>,
    world_matrices: Vec<Mat4>,
    /// Flat f32 buffer for WASM export of world matrices
    world_matrices_flat: Vec<f32>,
    dirty: bool,
}

#[wasm_bindgen]
impl AvatarSkeleton {
    /// Create a new skeleton with the specified number of joints.
    #[wasm_bindgen(constructor)]
    pub fn new(joint_count: u32) -> Self {
        let count = (joint_count as usize).min(MAX_JOINTS);
        Self {
            joints: vec![Joint::default(); count],
            world_matrices: vec![Mat4::IDENTITY; count],
            world_matrices_flat: vec![0.0; count * 16],
            dirty: true,
        }
    }
    
    /// Get number of joints in the skeleton.
    pub fn joint_count(&self) -> u32 {
        self.joints.len() as u32
    }
    
    /// Set parent joint for a given joint.
    pub fn set_parent(&mut self, joint_id: u8, parent_id: i8) {
        if let Some(joint) = self.joints.get_mut(joint_id as usize) {
            joint.parent = parent_id;
            self.dirty = true;
        }
    }
    
    /// Set local transform for a joint.
    pub fn set_local_transform(
        &mut self,
        joint_id: u8,
        tx: f32, ty: f32, tz: f32,
        rx: f32, ry: f32, rz: f32, rw: f32,
        sx: f32, sy: f32, sz: f32,
    ) {
        if let Some(joint) = self.joints.get_mut(joint_id as usize) {
            joint.translation = Vec3::new(tx, ty, tz);
            joint.rotation = Quat::from_xyzw(rx, ry, rz, rw).normalize();
            joint.scale = Vec3::new(sx, sy, sz);
            self.dirty = true;
        }
    }
    
    /// Set local translation for a joint.
    pub fn set_translation(&mut self, joint_id: u8, x: f32, y: f32, z: f32) {
        if let Some(joint) = self.joints.get_mut(joint_id as usize) {
            joint.translation = Vec3::new(x, y, z);
            self.dirty = true;
        }
    }
    
    /// Set local rotation for a joint (quaternion).
    pub fn set_rotation(&mut self, joint_id: u8, x: f32, y: f32, z: f32, w: f32) {
        if let Some(joint) = self.joints.get_mut(joint_id as usize) {
            joint.rotation = Quat::from_xyzw(x, y, z, w).normalize();
            self.dirty = true;
        }
    }
    
    /// Set local scale for a joint.
    pub fn set_scale(&mut self, joint_id: u8, x: f32, y: f32, z: f32) {
        if let Some(joint) = self.joints.get_mut(joint_id as usize) {
            joint.scale = Vec3::new(x, y, z);
            self.dirty = true;
        }
    }
    
    /// Compute world matrices for all joints.
    /// 
    /// This traverses the joint hierarchy and accumulates transforms.
    /// Should be called once per frame after all local transforms are set.
    pub fn compute_world_matrices(&mut self) {
        if !self.dirty {
            return;
        }
        
        for i in 0..self.joints.len() {
            let joint = self.joints[i];
            
            // Compute local matrix: T * R * S
            let local = Mat4::from_scale_rotation_translation(
                joint.scale,
                joint.rotation,
                joint.translation,
            );
            
            // Multiply by parent world matrix if not root
            let world = if joint.parent >= 0 && (joint.parent as usize) < i {
                self.world_matrices[joint.parent as usize] * local
            } else {
                local
            };
            
            self.world_matrices[i] = world;
            
            // Copy to flat buffer for WASM export
            let flat_base = i * 16;
            let cols = world.to_cols_array();
            self.world_matrices_flat[flat_base..flat_base + 16].copy_from_slice(&cols);
        }
        
        self.dirty = false;
    }
    
    /// Get pointer to world matrices buffer for zero-copy GPU upload.
    /// 
    /// Returns pointer to flat f32 array: [mat0_col0..mat0_col3, mat1_col0..mat1_col3, ...]
    /// Each matrix is 16 floats in column-major order.
    pub fn get_world_matrices_ptr(&self) -> *const f32 {
        self.world_matrices_flat.as_ptr()
    }
    
    /// Get world matrices buffer length in floats.
    pub fn get_world_matrices_len(&self) -> usize {
        self.world_matrices_flat.len()
    }
    
    /// Copy world matrices to output buffer (for debugging/testing).
    pub fn get_world_matrices(&self) -> Vec<f32> {
        self.world_matrices_flat.clone()
    }
    
    /// Get world position of a joint.
    pub fn get_joint_world_position(&self, joint_id: u8) -> Vec<f32> {
        if let Some(mat) = self.world_matrices.get(joint_id as usize) {
            let pos = mat.col(3);
            vec![pos.x, pos.y, pos.z]
        } else {
            vec![0.0, 0.0, 0.0]
        }
    }
    
    /// Reset all joints to identity transform.
    pub fn reset(&mut self) {
        for joint in &mut self.joints {
            joint.translation = Vec3::ZERO;
            joint.rotation = Quat::IDENTITY;
            joint.scale = Vec3::ONE;
        }
        self.dirty = true;
        self.compute_world_matrices();
    }
}

/// Batch set multiple joint transforms from flat arrays.
/// 
/// More efficient than individual calls when setting entire pose.
#[wasm_bindgen]
pub fn batch_set_transforms(
    skeleton: &mut AvatarSkeleton,
    translations: &[f32],  // 3 floats per joint
    rotations: &[f32],     // 4 floats per joint (xyzw)
    scales: &[f32],        // 3 floats per joint
    joint_count: u32,
) {
    let count = joint_count as usize;
    
    for i in 0..count {
        if i >= skeleton.joints.len() {
            break;
        }
        
        let t_base = i * 3;
        let r_base = i * 4;
        let s_base = i * 3;
        
        if t_base + 2 < translations.len() {
            skeleton.joints[i].translation = Vec3::new(
                translations[t_base],
                translations[t_base + 1],
                translations[t_base + 2],
            );
        }
        
        if r_base + 3 < rotations.len() {
            skeleton.joints[i].rotation = Quat::from_xyzw(
                rotations[r_base],
                rotations[r_base + 1],
                rotations[r_base + 2],
                rotations[r_base + 3],
            ).normalize();
        }
        
        if s_base + 2 < scales.len() {
            skeleton.joints[i].scale = Vec3::new(
                scales[s_base],
                scales[s_base + 1],
                scales[s_base + 2],
            );
        }
    }
    
    skeleton.dirty = true;
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_skeleton_creation() {
        let skel = AvatarSkeleton::new(10);
        assert_eq!(skel.joint_count(), 10);
    }
    
    #[test]
    fn test_skeleton_world_matrices() {
        let mut skel = AvatarSkeleton::new(3);
        
        // Set up simple hierarchy: 0 -> 1 -> 2
        skel.set_parent(1, 0);
        skel.set_parent(2, 1);
        
        // Move root joint up by 1 unit
        skel.set_translation(0, 0.0, 1.0, 0.0);
        // Move joint 1 up by another 1 unit (relative to parent)
        skel.set_translation(1, 0.0, 1.0, 0.0);
        // Move joint 2 up by another 1 unit (relative to parent)
        skel.set_translation(2, 0.0, 1.0, 0.0);
        
        skel.compute_world_matrices();
        
        let pos0 = skel.get_joint_world_position(0);
        let pos1 = skel.get_joint_world_position(1);
        let pos2 = skel.get_joint_world_position(2);
        
        assert!((pos0[1] - 1.0).abs() < 0.001);
        assert!((pos1[1] - 2.0).abs() < 0.001);
        assert!((pos2[1] - 3.0).abs() < 0.001);
    }
    
    #[test]
    fn test_batch_set_transforms() {
        let mut skel = AvatarSkeleton::new(2);
        
        let translations = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
        let rotations = [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];
        let scales = [1.0, 1.0, 1.0, 2.0, 2.0, 2.0];
        
        batch_set_transforms(&mut skel, &translations, &rotations, &scales, 2);
        skel.compute_world_matrices();
        
        let pos0 = skel.get_joint_world_position(0);
        let pos1 = skel.get_joint_world_position(1);
        
        assert!((pos0[0] - 1.0).abs() < 0.001);
        assert!((pos1[0] - 4.0).abs() < 0.001);
    }
}

