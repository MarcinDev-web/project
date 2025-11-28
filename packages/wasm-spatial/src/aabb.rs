//! AABB utilities and optimized operations

use crate::AABB;

/// Transforms a local AABB by a 4x4 matrix using Arvo's method
/// 
/// This is O(18) operations vs O(96) for transforming all 8 corners.
/// 
/// Matrix format: column-major [m00, m01, m02, m03, m10, m11, m12, m13, ...]
#[inline]
pub fn transform_aabb_arvo(local: &AABB, matrix: &[f32; 16]) -> AABB {
    // Extract translation
    let tx = matrix[12];
    let ty = matrix[13];
    let tz = matrix[14];
    
    // Start with translation
    let mut min_x = tx;
    let mut min_y = ty;
    let mut min_z = tz;
    let mut max_x = tx;
    let mut max_y = ty;
    let mut max_z = tz;
    
    // For each matrix element, add the smaller product to min and larger to max
    // Column 0 (affects x)
    for i in 0..3 {
        let a = matrix[i] * local.min_x;
        let b = matrix[i] * local.max_x;
        if a < b {
            match i {
                0 => { min_x += a; max_x += b; }
                1 => { min_y += a; max_y += b; }
                2 => { min_z += a; max_z += b; }
                _ => {}
            }
        } else {
            match i {
                0 => { min_x += b; max_x += a; }
                1 => { min_y += b; max_y += a; }
                2 => { min_z += b; max_z += a; }
                _ => {}
            }
        }
    }
    
    // Column 1 (affects y)
    for i in 0..3 {
        let a = matrix[4 + i] * local.min_y;
        let b = matrix[4 + i] * local.max_y;
        if a < b {
            match i {
                0 => { min_x += a; max_x += b; }
                1 => { min_y += a; max_y += b; }
                2 => { min_z += a; max_z += b; }
                _ => {}
            }
        } else {
            match i {
                0 => { min_x += b; max_x += a; }
                1 => { min_y += b; max_y += a; }
                2 => { min_z += b; max_z += a; }
                _ => {}
            }
        }
    }
    
    // Column 2 (affects z)
    for i in 0..3 {
        let a = matrix[8 + i] * local.min_z;
        let b = matrix[8 + i] * local.max_z;
        if a < b {
            match i {
                0 => { min_x += a; max_x += b; }
                1 => { min_y += a; max_y += b; }
                2 => { min_z += a; max_z += b; }
                _ => {}
            }
        } else {
            match i {
                0 => { min_x += b; max_x += a; }
                1 => { min_y += b; max_y += a; }
                2 => { min_z += b; max_z += a; }
                _ => {}
            }
        }
    }
    
    AABB { min_x, min_y, min_z, max_x, max_y, max_z }
}

/// Batch transforms AABBs using Arvo's method
/// 
/// matrices: N × 16 floats (column-major 4×4 matrices)
/// local_aabbs: N × 6 floats [min_x, min_y, min_z, max_x, max_y, max_z]
/// 
/// Returns N × 6 floats of world AABBs
pub fn batch_transform_aabbs(
    matrices: &[f32],
    local_aabbs: &[f32],
) -> Vec<f32> {
    let count = matrices.len() / 16;
    let mut result = Vec::with_capacity(count * 6);
    
    for i in 0..count {
        let mat_base = i * 16;
        let aabb_base = i * 6;
        
        let local = AABB {
            min_x: local_aabbs[aabb_base],
            min_y: local_aabbs[aabb_base + 1],
            min_z: local_aabbs[aabb_base + 2],
            max_x: local_aabbs[aabb_base + 3],
            max_y: local_aabbs[aabb_base + 4],
            max_z: local_aabbs[aabb_base + 5],
        };
        
        let matrix: [f32; 16] = matrices[mat_base..mat_base + 16]
            .try_into()
            .unwrap_or([
                1.0, 0.0, 0.0, 0.0,
                0.0, 1.0, 0.0, 0.0,
                0.0, 0.0, 1.0, 0.0,
                0.0, 0.0, 0.0, 1.0,
            ]);
        
        let world = transform_aabb_arvo(&local, &matrix);
        
        result.push(world.min_x);
        result.push(world.min_y);
        result.push(world.min_z);
        result.push(world.max_x);
        result.push(world.max_y);
        result.push(world.max_z);
    }
    
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_identity_transform() {
        let local = AABB::new(-1.0, -1.0, -1.0, 1.0, 1.0, 1.0);
        let identity = [
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0,
        ];
        
        let result = transform_aabb_arvo(&local, &identity);
        
        assert!((result.min_x - local.min_x).abs() < 0.001);
        assert!((result.max_x - local.max_x).abs() < 0.001);
    }
    
    #[test]
    fn test_translation() {
        let local = AABB::new(0.0, 0.0, 0.0, 1.0, 1.0, 1.0);
        let translate = [
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            5.0, 10.0, 15.0, 1.0,
        ];
        
        let result = transform_aabb_arvo(&local, &translate);
        
        assert!((result.min_x - 5.0).abs() < 0.001);
        assert!((result.min_y - 10.0).abs() < 0.001);
        assert!((result.min_z - 15.0).abs() < 0.001);
        assert!((result.max_x - 6.0).abs() < 0.001);
    }
}

