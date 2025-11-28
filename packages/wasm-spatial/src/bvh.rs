//! BVH utilities and helpers
//! Main BVH implementation is in lib.rs

use crate::{AABB, FrustumPlane, aabb_in_frustum};

/// Batch frustum culling for flat AABB array
/// 
/// planes: 6 planes × 4 floats = 24 floats [nx, ny, nz, d, ...]
/// aabbs: N × 6 floats [min_x, min_y, min_z, max_x, max_y, max_z, ...]
/// 
/// Returns indices of visible AABBs
pub fn batch_frustum_cull(planes_data: &[f32], aabbs: &[f32]) -> Vec<u32> {
    if planes_data.len() < 24 {
        return Vec::new();
    }
    
    let planes: [FrustumPlane; 6] = [
        FrustumPlane { nx: planes_data[0], ny: planes_data[1], nz: planes_data[2], d: planes_data[3] },
        FrustumPlane { nx: planes_data[4], ny: planes_data[5], nz: planes_data[6], d: planes_data[7] },
        FrustumPlane { nx: planes_data[8], ny: planes_data[9], nz: planes_data[10], d: planes_data[11] },
        FrustumPlane { nx: planes_data[12], ny: planes_data[13], nz: planes_data[14], d: planes_data[15] },
        FrustumPlane { nx: planes_data[16], ny: planes_data[17], nz: planes_data[18], d: planes_data[19] },
        FrustumPlane { nx: planes_data[20], ny: planes_data[21], nz: planes_data[22], d: planes_data[23] },
    ];
    
    let count = aabbs.len() / 6;
    let mut visible = Vec::with_capacity(count);
    
    for i in 0..count {
        let base = i * 6;
        let aabb = AABB {
            min_x: aabbs[base],
            min_y: aabbs[base + 1],
            min_z: aabbs[base + 2],
            max_x: aabbs[base + 3],
            max_y: aabbs[base + 4],
            max_z: aabbs[base + 5],
        };
        
        if aabb_in_frustum(&aabb, &planes) {
            visible.push(i as u32);
        }
    }
    
    visible
}

/// Batch transform + frustum cull in one pass
/// 
/// planes: 6 planes × 4 floats = 24 floats
/// matrices: N × 16 floats (world matrices)
/// local_aabbs: N × 6 floats (local AABBs)
/// 
/// Returns indices of visible entities
pub fn batch_transform_and_cull(
    planes_data: &[f32],
    matrices: &[f32],
    local_aabbs: &[f32],
) -> Vec<u32> {
    use crate::aabb::transform_aabb_arvo;
    
    if planes_data.len() < 24 {
        return Vec::new();
    }
    
    let planes: [FrustumPlane; 6] = [
        FrustumPlane { nx: planes_data[0], ny: planes_data[1], nz: planes_data[2], d: planes_data[3] },
        FrustumPlane { nx: planes_data[4], ny: planes_data[5], nz: planes_data[6], d: planes_data[7] },
        FrustumPlane { nx: planes_data[8], ny: planes_data[9], nz: planes_data[10], d: planes_data[11] },
        FrustumPlane { nx: planes_data[12], ny: planes_data[13], nz: planes_data[14], d: planes_data[15] },
        FrustumPlane { nx: planes_data[16], ny: planes_data[17], nz: planes_data[18], d: planes_data[19] },
        FrustumPlane { nx: planes_data[20], ny: planes_data[21], nz: planes_data[22], d: planes_data[23] },
    ];
    
    let count = matrices.len() / 16;
    let mut visible = Vec::with_capacity(count);
    
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
        
        if aabb_in_frustum(&world, &planes) {
            visible.push(i as u32);
        }
    }
    
    visible
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_batch_frustum_cull() {
        // Simple test with a unit cube at origin
        let planes: [f32; 24] = [
            // Left plane: x >= -10
            1.0, 0.0, 0.0, 10.0,
            // Right plane: x <= 10  
            -1.0, 0.0, 0.0, 10.0,
            // Bottom plane: y >= -10
            0.0, 1.0, 0.0, 10.0,
            // Top plane: y <= 10
            0.0, -1.0, 0.0, 10.0,
            // Near plane: z >= -10
            0.0, 0.0, 1.0, 10.0,
            // Far plane: z <= 10
            0.0, 0.0, -1.0, 10.0,
        ];
        
        // Cube at origin - should be visible
        let aabbs: [f32; 6] = [-0.5, -0.5, -0.5, 0.5, 0.5, 0.5];
        
        let visible = batch_frustum_cull(&planes, &aabbs);
        assert_eq!(visible.len(), 1);
        assert_eq!(visible[0], 0);
    }
}

