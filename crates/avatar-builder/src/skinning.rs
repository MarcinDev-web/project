//! GPU skinning matrix computation.
//! 
//! Computes final skin matrices for shader consumption:
//! skin_matrix = world_matrix * inverse_bind_matrix
//! 
//! These matrices transform vertices from bind pose to current pose.

use wasm_bindgen::prelude::*;
use glam::Mat4;

/// Compute skin matrices for GPU skinning.
/// 
/// skin_matrix[i] = world_matrices[i] * inverse_bind_matrices[i]
/// 
/// # Arguments
/// * `world_matrices` - Current pose world matrices (16 floats per joint, column-major)
/// * `inverse_bind_matrices` - Inverse bind pose matrices (16 floats per joint, column-major)
/// * `joint_count` - Number of joints
/// 
/// # Returns
/// Flattened skin matrices (16 floats per joint)
#[wasm_bindgen]
pub fn compute_skin_matrices(
    world_matrices: &[f32],
    inverse_bind_matrices: &[f32],
    joint_count: u32,
) -> Vec<f32> {
    let count = joint_count as usize;
    let mut output = Vec::with_capacity(count * 16);
    
    for i in 0..count {
        let offset = i * 16;
        
        if offset + 16 > world_matrices.len() || offset + 16 > inverse_bind_matrices.len() {
            // Pad with identity if input is short
            output.extend_from_slice(&Mat4::IDENTITY.to_cols_array());
            continue;
        }
        
        let world = Mat4::from_cols_array(
            &world_matrices[offset..offset + 16].try_into().unwrap()
        );
        let ibm = Mat4::from_cols_array(
            &inverse_bind_matrices[offset..offset + 16].try_into().unwrap()
        );
        
        let skin = world * ibm;
        output.extend_from_slice(&skin.to_cols_array());
    }
    
    output
}

/// In-place skin matrix computation (avoids allocation).
/// 
/// # Arguments
/// * `world_matrices` - Current pose world matrices
/// * `inverse_bind_matrices` - Inverse bind pose matrices
/// * `out_skin_matrices` - Output buffer (must be joint_count * 16 floats)
/// * `joint_count` - Number of joints
/// 
/// # Returns
/// Number of joints processed
#[wasm_bindgen]
pub fn compute_skin_matrices_inplace(
    world_matrices: &[f32],
    inverse_bind_matrices: &[f32],
    out_skin_matrices: &mut [f32],
    joint_count: u32,
) -> u32 {
    let count = joint_count as usize;
    let max_output = out_skin_matrices.len() / 16;
    let actual_count = count.min(max_output);
    
    for i in 0..actual_count {
        let offset = i * 16;
        
        if offset + 16 > world_matrices.len() || offset + 16 > inverse_bind_matrices.len() {
            // Identity fallback
            out_skin_matrices[offset..offset + 16]
                .copy_from_slice(&Mat4::IDENTITY.to_cols_array());
            continue;
        }
        
        let world = Mat4::from_cols_array(
            &world_matrices[offset..offset + 16].try_into().unwrap()
        );
        let ibm = Mat4::from_cols_array(
            &inverse_bind_matrices[offset..offset + 16].try_into().unwrap()
        );
        
        let skin = world * ibm;
        out_skin_matrices[offset..offset + 16].copy_from_slice(&skin.to_cols_array());
    }
    
    actual_count as u32
}

/// Persistent skin matrix computer with reusable output buffer.
/// Avoids per-frame allocations for maximum performance.
#[wasm_bindgen]
pub struct SkinMatrixComputer {
    output_buffer: Vec<f32>,
    inverse_bind_matrices: Vec<f32>,
}

#[wasm_bindgen]
impl SkinMatrixComputer {
    /// Create a new computer with specified max joint count.
    #[wasm_bindgen(constructor)]
    pub fn new(max_joints: u32) -> Self {
        Self {
            output_buffer: vec![0.0; max_joints as usize * 16],
            inverse_bind_matrices: Vec::new(),
        }
    }
    
    /// Set inverse bind matrices (call once during skeleton setup).
    pub fn set_inverse_bind_matrices(&mut self, ibm: &[f32]) {
        self.inverse_bind_matrices = ibm.to_vec();
    }
    
    /// Compute skin matrices from current world matrices.
    /// Access result via get_output_ptr().
    /// 
    /// # Returns
    /// Number of joints processed
    pub fn compute(&mut self, world_matrices: &[f32], joint_count: u32) -> u32 {
        let required_size = joint_count as usize * 16;
        if self.output_buffer.len() < required_size {
            self.output_buffer.resize(required_size, 0.0);
        }
        
        compute_skin_matrices_inplace(
            world_matrices,
            &self.inverse_bind_matrices,
            &mut self.output_buffer,
            joint_count,
        )
    }
    
    /// Get pointer to output buffer.
    pub fn get_output_ptr(&self) -> *const f32 {
        self.output_buffer.as_ptr()
    }
    
    /// Get output buffer length in floats.
    pub fn get_output_len(&self) -> usize {
        self.output_buffer.len()
    }
    
    /// Copy output for debugging.
    pub fn get_output_copy(&self) -> Vec<f32> {
        self.output_buffer.clone()
    }
}

/// Blend two poses with given weight (0.0 = a, 1.0 = b).
/// 
/// # Arguments
/// * `translations_a/b` - Translation arrays (3 floats per joint)
/// * `rotations_a/b` - Rotation quaternion arrays (4 floats per joint, xyzw)
/// * `scales_a/b` - Scale arrays (3 floats per joint)
/// * `weight` - Blend weight (clamped to 0..1)
/// * `joint_count` - Number of joints
/// * `out_translations/rotations/scales` - Output arrays
#[wasm_bindgen]
pub fn blend_poses(
    translations_a: &[f32],
    rotations_a: &[f32],
    scales_a: &[f32],
    translations_b: &[f32],
    rotations_b: &[f32],
    scales_b: &[f32],
    weight: f32,
    joint_count: u32,
    out_translations: &mut [f32],
    out_rotations: &mut [f32],
    out_scales: &mut [f32],
) {
    use glam::Quat;
    
    let w = weight.clamp(0.0, 1.0);
    let count = joint_count as usize;
    
    for i in 0..count {
        let t_off = i * 3;
        let r_off = i * 4;
        
        // Translation lerp
        if t_off + 2 < translations_a.len() && t_off + 2 < translations_b.len() && t_off + 2 < out_translations.len() {
            out_translations[t_off] = translations_a[t_off] * (1.0 - w) + translations_b[t_off] * w;
            out_translations[t_off + 1] = translations_a[t_off + 1] * (1.0 - w) + translations_b[t_off + 1] * w;
            out_translations[t_off + 2] = translations_a[t_off + 2] * (1.0 - w) + translations_b[t_off + 2] * w;
        }
        
        // Scale lerp
        if t_off + 2 < scales_a.len() && t_off + 2 < scales_b.len() && t_off + 2 < out_scales.len() {
            out_scales[t_off] = scales_a[t_off] * (1.0 - w) + scales_b[t_off] * w;
            out_scales[t_off + 1] = scales_a[t_off + 1] * (1.0 - w) + scales_b[t_off + 1] * w;
            out_scales[t_off + 2] = scales_a[t_off + 2] * (1.0 - w) + scales_b[t_off + 2] * w;
        }
        
        // Rotation slerp
        if r_off + 3 < rotations_a.len() && r_off + 3 < rotations_b.len() && r_off + 3 < out_rotations.len() {
            let qa = Quat::from_xyzw(
                rotations_a[r_off],
                rotations_a[r_off + 1],
                rotations_a[r_off + 2],
                rotations_a[r_off + 3],
            );
            let qb = Quat::from_xyzw(
                rotations_b[r_off],
                rotations_b[r_off + 1],
                rotations_b[r_off + 2],
                rotations_b[r_off + 3],
            );
            let qr = qa.slerp(qb, w);
            out_rotations[r_off] = qr.x;
            out_rotations[r_off + 1] = qr.y;
            out_rotations[r_off + 2] = qr.z;
            out_rotations[r_off + 3] = qr.w;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_skin_matrices_identity() {
        let identity = Mat4::IDENTITY.to_cols_array();
        let world = identity.to_vec();
        let ibm = identity.to_vec();
        
        let result = compute_skin_matrices(&world, &ibm, 1);
        
        // skin = world * ibm = identity * identity = identity
        assert_eq!(result.len(), 16);
        for i in 0..16 {
            assert!((result[i] - identity[i]).abs() < 0.001);
        }
    }
    
    #[test]
    fn test_blend_poses() {
        let trans_a = [0.0, 0.0, 0.0];
        let trans_b = [10.0, 0.0, 0.0];
        let rot_a = [0.0, 0.0, 0.0, 1.0]; // identity
        let rot_b = [0.0, 0.0, 0.0, 1.0]; // identity
        let scale_a = [1.0, 1.0, 1.0];
        let scale_b = [1.0, 1.0, 1.0];
        
        let mut out_trans = [0.0f32; 3];
        let mut out_rot = [0.0f32; 4];
        let mut out_scale = [0.0f32; 3];
        
        blend_poses(
            &trans_a, &rot_a, &scale_a,
            &trans_b, &rot_b, &scale_b,
            0.5, 1,
            &mut out_trans, &mut out_rot, &mut out_scale,
        );
        
        // Translation should be blended to 5
        assert!((out_trans[0] - 5.0).abs() < 0.001);
    }
}

