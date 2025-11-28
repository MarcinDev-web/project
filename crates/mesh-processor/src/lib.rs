use wasm_bindgen::prelude::*;
use glam::{Vec2, Vec3};

#[cfg(feature = "panic-hook")]
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

trait MeshIndex: Copy {
    fn to_usize(self) -> usize;
}

impl MeshIndex for u16 {
    #[inline]
    fn to_usize(self) -> usize {
        self as usize
    }
}

impl MeshIndex for u32 {
    #[inline]
    fn to_usize(self) -> usize {
        self as usize
    }
}

fn compute_normals_impl<I: MeshIndex>(positions: &[f32], indices: &[I]) -> Vec<f32> {
    if positions.len() % 3 != 0 {
        return Vec::new();
    }

    let vertex_count = positions.len() / 3;
    let mut normals = vec![Vec3::ZERO; vertex_count];
    
    // Iterate over triangles
    for chunk in indices.chunks(3) {
        if chunk.len() < 3 { break; }
        
        let i0 = chunk[0].to_usize();
        let i1 = chunk[1].to_usize();
        let i2 = chunk[2].to_usize();
        
        if i0 >= vertex_count || i1 >= vertex_count || i2 >= vertex_count {
            continue;
        }

        let v0 = Vec3::new(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
        let v1 = Vec3::new(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
        let v2 = Vec3::new(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

        let edge1 = v1 - v0;
        let edge2 = v2 - v0;
        
        // Weight by area (length of cross product is 2x area)
        let normal = edge1.cross(edge2);
        
        // Add to each vertex normal
        // We don't normalize here to accumulate weighted normals
        normals[i0] += normal;
        normals[i1] += normal;
        normals[i2] += normal;
    }

    // Normalize and flatten
    let mut result = Vec::with_capacity(positions.len());
    for normal in normals {
        let n = normal.normalize_or_zero();
        result.push(n.x);
        result.push(n.y);
        result.push(n.z);
    }
    
    result
}

#[wasm_bindgen]
pub fn compute_normals(positions: &[f32], indices: &[u32]) -> Vec<f32> {
    compute_normals_impl(positions, indices)
}

#[wasm_bindgen]
pub fn compute_normals_u16(positions: &[f32], indices: &[u16]) -> Vec<f32> {
    compute_normals_impl(positions, indices)
}

/// Compute normals for a terrain grid region (incremental update)
/// 
/// This is optimized for terrain sculpting where only a small region changes.
/// Instead of recalculating all normals, it only processes:
/// 1. Triangles that touch the affected region
/// 2. Vertices within the affected region + 1-ring neighborhood
///
/// # Arguments
/// * `positions` - All vertex positions (x, y, z) for the entire mesh
/// * `indices` - All triangle indices (u16)
/// * `normals` - Existing normals buffer (will be modified in-place for affected region)
/// * `resolution` - Grid resolution (vertices per side)
/// * `min_x` - Minimum grid X coordinate of affected region
/// * `max_x` - Maximum grid X coordinate of affected region  
/// * `min_z` - Minimum grid Z coordinate of affected region
/// * `max_z` - Maximum grid Z coordinate of affected region
#[wasm_bindgen]
pub fn compute_normals_region_u16(
    positions: &[f32],
    indices: &[u16],
    normals: &mut [f32],
    resolution: u32,
    min_x: u32,
    max_x: u32,
    min_z: u32,
    max_z: u32,
) {
    compute_normals_region_impl::<u16>(
        positions, indices, normals, resolution, min_x, max_x, min_z, max_z
    );
}

/// Internal implementation for region-based normal computation
fn compute_normals_region_impl<I: MeshIndex>(
    positions: &[f32],
    _indices: &[I], // Not used - we compute triangles directly from grid structure
    normals: &mut [f32],
    resolution: u32,
    min_x: u32,
    max_x: u32,
    min_z: u32,
    max_z: u32,
) {
    if positions.len() % 3 != 0 || normals.len() != positions.len() {
        return;
    }
    
    let res = resolution as usize;
    let vertex_count = positions.len() / 3;
    
    // Expand region by 1 for neighbor influence on normals
    // (vertices at boundary are affected by triangles outside the edited region)
    let expanded_min_x = min_x.saturating_sub(1) as usize;
    let expanded_max_x = ((max_x + 1) as usize).min(res - 1);
    let expanded_min_z = min_z.saturating_sub(1) as usize;
    let expanded_max_z = ((max_z + 1) as usize).min(res - 1);
    
    // Create a local accumulator for affected vertices
    // Use a Vec for the affected region only to minimize allocations
    let region_width = expanded_max_x - expanded_min_x + 1;
    let region_height = expanded_max_z - expanded_min_z + 1;
    let mut local_normals: Vec<Vec3> = vec![Vec3::ZERO; region_width * region_height];
    
    // Helper to convert grid coords to vertex index
    let grid_to_vertex = |x: usize, z: usize| -> usize { z * res + x };
    
    // Helper to check if a vertex is in the expanded region
    let in_expanded_region = |x: usize, z: usize| -> bool {
        x >= expanded_min_x && x <= expanded_max_x && 
        z >= expanded_min_z && z <= expanded_max_z
    };
    
    // Helper to convert vertex index to local region index
    let to_local_index = |x: usize, z: usize| -> usize {
        (z - expanded_min_z) * region_width + (x - expanded_min_x)
    };
    
    // Process triangles that touch the affected region
    // For a terrain grid, triangles are arranged in quads:
    // Each quad (x, z) has 2 triangles using vertices:
    // (x,z), (x+1,z), (x,z+1), (x+1,z+1)
    //
    // We need to process quads where any vertex is in the expanded region
    // This means quads from (expanded_min_x-1, expanded_min_z-1) to (expanded_max_x, expanded_max_z)
    let quad_min_x = expanded_min_x.saturating_sub(1);
    let quad_max_x = expanded_max_x.min(res - 2);
    let quad_min_z = expanded_min_z.saturating_sub(1);
    let quad_max_z = expanded_max_z.min(res - 2);
    
    for qz in quad_min_z..=quad_max_z {
        for qx in quad_min_x..=quad_max_x {
            // Two triangles per quad
            // Triangle 1: (qx, qz), (qx+1, qz), (qx, qz+1)
            // Triangle 2: (qx+1, qz), (qx+1, qz+1), (qx, qz+1)
            
            let tl = grid_to_vertex(qx, qz);      // top-left
            let tr = grid_to_vertex(qx + 1, qz);  // top-right
            let bl = grid_to_vertex(qx, qz + 1);  // bottom-left
            let br = grid_to_vertex(qx + 1, qz + 1); // bottom-right
            
            if tl >= vertex_count || tr >= vertex_count || bl >= vertex_count || br >= vertex_count {
                continue;
            }
            
            // Get positions
            let p_tl = Vec3::new(positions[tl * 3], positions[tl * 3 + 1], positions[tl * 3 + 2]);
            let p_tr = Vec3::new(positions[tr * 3], positions[tr * 3 + 1], positions[tr * 3 + 2]);
            let p_bl = Vec3::new(positions[bl * 3], positions[bl * 3 + 1], positions[bl * 3 + 2]);
            let p_br = Vec3::new(positions[br * 3], positions[br * 3 + 1], positions[br * 3 + 2]);
            
            // Triangle 1: tl, tr, bl (matches JS winding: topLeft, topRight, bottomLeft)
            let edge1_t1 = p_tr - p_tl;
            let edge2_t1 = p_bl - p_tl;
            let normal_t1 = edge1_t1.cross(edge2_t1);
            
            // Triangle 2: tr, br, bl (matches JS winding: topRight, bottomRight, bottomLeft)
            let edge1_t2 = p_br - p_tr;
            let edge2_t2 = p_bl - p_tr;
            let normal_t2 = edge1_t2.cross(edge2_t2);
            
            // Accumulate to affected vertices
            // Triangle 1 vertices: tl (qx, qz), tr (qx+1, qz), bl (qx, qz+1)
            if in_expanded_region(qx, qz) {
                local_normals[to_local_index(qx, qz)] += normal_t1;
            }
            if in_expanded_region(qx + 1, qz) {
                local_normals[to_local_index(qx + 1, qz)] += normal_t1;
            }
            if in_expanded_region(qx, qz + 1) {
                local_normals[to_local_index(qx, qz + 1)] += normal_t1;
            }
            
            // Triangle 2 vertices: tr (qx+1, qz), br (qx+1, qz+1), bl (qx, qz+1)
            if in_expanded_region(qx + 1, qz) {
                local_normals[to_local_index(qx + 1, qz)] += normal_t2;
            }
            if in_expanded_region(qx + 1, qz + 1) {
                local_normals[to_local_index(qx + 1, qz + 1)] += normal_t2;
            }
            if in_expanded_region(qx, qz + 1) {
                local_normals[to_local_index(qx, qz + 1)] += normal_t2;
            }
        }
    }
    
    // Normalize and write back to the normals buffer
    for z in expanded_min_z..=expanded_max_z {
        for x in expanded_min_x..=expanded_max_x {
            let local_idx = to_local_index(x, z);
            let vertex_idx = grid_to_vertex(x, z);
            
            let n = local_normals[local_idx].normalize_or_zero();
            
            // Default to up vector if normal is zero (flat areas)
            let final_normal = if n.length_squared() < 0.0001 {
                Vec3::Y
            } else {
                n
            };
            
            normals[vertex_idx * 3] = final_normal.x;
            normals[vertex_idx * 3 + 1] = final_normal.y;
            normals[vertex_idx * 3 + 2] = final_normal.z;
        }
    }
}

fn compute_tangents_impl<I: MeshIndex>(
    positions: &[f32], 
    normals: &[f32], 
    uvs: &[f32], 
    indices: &[I]
) -> Vec<f32> {
    // Validation
    if positions.len() % 3 != 0 || normals.len() != positions.len() || uvs.len() % 2 != 0 {
        return Vec::new();
    }

    let vertex_count = positions.len() / 3;
    if uvs.len() / 2 != vertex_count {
        return Vec::new();
    }

    let mut tangents = vec![Vec3::ZERO; vertex_count];
    let mut bitangents = vec![Vec3::ZERO; vertex_count];

    for chunk in indices.chunks(3) {
        if chunk.len() < 3 { break; }

        let i0 = chunk[0].to_usize();
        let i1 = chunk[1].to_usize();
        let i2 = chunk[2].to_usize();

        if i0 >= vertex_count || i1 >= vertex_count || i2 >= vertex_count {
            continue;
        }

        let v0 = Vec3::new(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
        let v1 = Vec3::new(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
        let v2 = Vec3::new(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

        let uv0 = Vec2::new(uvs[i0 * 2], uvs[i0 * 2 + 1]);
        let uv1 = Vec2::new(uvs[i1 * 2], uvs[i1 * 2 + 1]);
        let uv2 = Vec2::new(uvs[i2 * 2], uvs[i2 * 2 + 1]);

        let e1 = v1 - v0;
        let e2 = v2 - v0;

        let delta_uv1 = uv1 - uv0;
        let delta_uv2 = uv2 - uv0;

        let r = 1.0 / (delta_uv1.x * delta_uv2.y - delta_uv1.y * delta_uv2.x);
        
        // If UVs are degenerate, we might get Infinity/NaN. Handle gracefully.
        let (t, b) = if r.is_finite() {
            (
                (e1 * delta_uv2.y - e2 * delta_uv1.y) * r,
                (e2 * delta_uv1.x - e1 * delta_uv2.x) * r
            )
        } else {
            (Vec3::ZERO, Vec3::ZERO)
        };

        tangents[i0] += t;
        tangents[i1] += t;
        tangents[i2] += t;

        bitangents[i0] += b;
        bitangents[i1] += b;
        bitangents[i2] += b;
    }

    let mut result = Vec::with_capacity(vertex_count * 4);
    for i in 0..vertex_count {
        let n = Vec3::new(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        let t = tangents[i];
        let b = bitangents[i];
        
        // Gram-Schmidt orthogonalization
        let t_ortho = (t - n * n.dot(t)).normalize_or_zero();
        
        // Calculate handedness
        let w = if n.cross(t).dot(b) < 0.0 { -1.0 } else { 1.0 };

        result.push(t_ortho.x);
        result.push(t_ortho.y);
        result.push(t_ortho.z);
        result.push(w);
    }

    result
}

#[wasm_bindgen]
pub fn compute_tangents(
    positions: &[f32], 
    normals: &[f32], 
    uvs: &[f32], 
    indices: &[u32]
) -> Vec<f32> {
    compute_tangents_impl(positions, normals, uvs, indices)
}

#[wasm_bindgen]
pub fn compute_tangents_u16(
    positions: &[f32], 
    normals: &[f32], 
    uvs: &[f32], 
    indices: &[u16]
) -> Vec<f32> {
    compute_tangents_impl(positions, normals, uvs, indices)
}

#[wasm_bindgen]
pub fn compute_uvs_box(positions: &[f32], normals: &[f32]) -> Vec<f32> {
    let vertex_count = positions.len() / 3;
    let mut uvs = Vec::with_capacity(vertex_count * 2);

    for i in 0..vertex_count {
        let p = Vec3::new(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        let n = Vec3::new(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
        
        // Determine dominant axis
        let abs_n = n.abs();
        let uv = if abs_n.x >= abs_n.y && abs_n.x >= abs_n.z {
            // X-axis dominant
            Vec2::new(if n.x > 0.0 { -p.z } else { p.z }, p.y)
        } else if abs_n.y >= abs_n.x && abs_n.y >= abs_n.z {
            // Y-axis dominant
            Vec2::new(p.x, if n.y > 0.0 { -p.z } else { p.z })
        } else {
            // Z-axis dominant
            Vec2::new(if n.z > 0.0 { p.x } else { -p.x }, p.y)
        };

        uvs.push(uv.x);
        uvs.push(uv.y);
    }

    uvs
}

#[wasm_bindgen]
pub fn compute_uvs_planar(positions: &[f32], normal: &[f32], scale: f32) -> Vec<f32> {
    let vertex_count = positions.len() / 3;
    let mut uvs = Vec::with_capacity(vertex_count * 2);
    
    let plane_normal = Vec3::new(normal[0], normal[1], normal[2]).normalize_or_zero();
    
    // Create a basis for the plane
    let up = if plane_normal.y.abs() > 0.99 {
        Vec3::X
    } else {
        Vec3::Y
    };
    
    let tangent = plane_normal.cross(up).normalize();
    let bitangent = plane_normal.cross(tangent).normalize();

    for i in 0..vertex_count {
        let p = Vec3::new(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        
        // Project point onto plane basis
        let u = p.dot(tangent) * scale;
        let v = p.dot(bitangent) * scale;
        
        uvs.push(u);
        uvs.push(v);
    }

    uvs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_normals_simple_triangle() {
        // Triangle in XY plane, facing +Z
        // 0: (0,0,0), 1: (1,0,0), 2: (0,1,0)
        let positions = vec![
            0.0, 0.0, 0.0,
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
        ];
        let indices = vec![0u32, 1, 2];
        
        let normals = compute_normals(&positions, &indices);
        
        assert_eq!(normals.len(), 9);
        
        // Expect all normals to be (0, 0, 1)
        for i in 0..3 {
            assert_eq!(normals[i*3], 0.0);
            assert_eq!(normals[i*3+1], 0.0);
            assert!(normals[i*3+2] > 0.99);
        }
    }

    #[test]
    fn test_compute_tangents_simple_quad() {
        // Quad in XY plane, normal +Z, UVs 0..1
        // 0 -- 1
        // |    |
        // 3 -- 2
        
        let positions = vec![
            0.0, 1.0, 0.0, // 0 (top-left)
            1.0, 1.0, 0.0, // 1 (top-right)
            1.0, 0.0, 0.0, // 2 (bottom-right)
            0.0, 0.0, 0.0, // 3 (bottom-left)
        ];
        
        // +Z normals
        let normals = vec![
            0.0, 0.0, 1.0,
            0.0, 0.0, 1.0,
            0.0, 0.0, 1.0,
            0.0, 0.0, 1.0,
        ];

        // Standard UVs
        // 0: (0,1), 1: (1,1), 2: (1,0), 3: (0,0)
        // NOTE: UV coordinate system matters. Assuming OpenGL style (0,0 bottom-left) vs DirectX/Vulkan (0,0 top-left).
        // If positions are Y-up:
        // 0: (0,1) -> x=0, y=1
        // 1: (1,1) -> x=1, y=1
        // 2: (1,0) -> x=1, y=0
        // 3: (0,0) -> x=0, y=0
        let uvs = vec![
            0.0, 1.0,
            1.0, 1.0,
            1.0, 0.0,
            0.0, 0.0,
        ];

        // Two triangles: 0-3-2, 2-1-0  (CCW winding)
        // Tri 1: 0(0,1), 3(0,0), 2(1,0) -> DeltaPos: (0,-1), (1,-1). DeltaUV: (0,-1), (1,-1).
        // Tri 2: 2(1,0), 1(1,1), 0(0,1) -> DeltaPos: (0,1), (-1,1). DeltaUV: (0,1), (-1,1).
        let indices = vec![
            0, 3, 2,
            2, 1, 0
        ];

        let tangents = compute_tangents(&positions, &normals, &uvs, &indices);

        assert_eq!(tangents.len(), 16); // 4 vertices * 4 floats

        // Tangent should be +X (1, 0, 0) because U increases with X
        // W should be 1.0 or -1.0 depending on basis
        
        for i in 0..4 {
            let tx = tangents[i*4];
            let ty = tangents[i*4+1];
            let tz = tangents[i*4+2];
            
            // Tangent along X
            assert!((tx - 1.0).abs() < 0.01, "Vertex {}: Tangent X should be 1.0, got {}", i, tx);
            assert!(ty.abs() < 0.01, "Vertex {}: Tangent Y should be 0.0, got {}", i, ty);
            assert!(tz.abs() < 0.01, "Vertex {}: Tangent Z should be 0.0, got {}", i, tz);
        }
    }

    /// Creates a flat terrain grid for testing
    fn create_flat_terrain_grid(resolution: usize, height: f32) -> (Vec<f32>, Vec<u16>, Vec<f32>) {
        let vertex_count = resolution * resolution;
        let mut positions = Vec::with_capacity(vertex_count * 3);
        let normals = vec![0.0f32; vertex_count * 3];
        
        // Create vertices
        for z in 0..resolution {
            for x in 0..resolution {
                positions.push(x as f32);
                positions.push(height);
                positions.push(z as f32);
            }
        }
        
        // Create indices (2 triangles per quad)
        let mut indices = Vec::new();
        for z in 0..(resolution - 1) {
            for x in 0..(resolution - 1) {
                let tl = (z * resolution + x) as u16;
                let tr = tl + 1;
                let bl = ((z + 1) * resolution + x) as u16;
                let br = bl + 1;
                
                // Triangle 1: tl, tr, bl
                indices.push(tl);
                indices.push(tr);
                indices.push(bl);
                
                // Triangle 2: tr, br, bl
                indices.push(tr);
                indices.push(br);
                indices.push(bl);
            }
        }
        
        (positions, indices, normals)
    }

    #[test]
    fn test_compute_normals_region_flat_terrain() {
        let resolution = 5usize;
        let (positions, indices, mut normals) = create_flat_terrain_grid(resolution, 0.0);
        
        // Compute normals for center region
        compute_normals_region_u16(
            &positions,
            &indices,
            &mut normals,
            resolution as u32,
            1, 3, // minX, maxX
            1, 3, // minZ, maxZ
        );
        
        // All normals in flat terrain should point down (0, -1, 0)
        // This is due to the winding order: tl, tr, bl produces -Y facing normals
        // (consistent with the full compute_normals_impl)
        for z in 1..=3 {
            for x in 1..=3 {
                let idx = z * resolution + x;
                let nx = normals[idx * 3];
                let ny = normals[idx * 3 + 1];
                let nz = normals[idx * 3 + 2];
                
                assert!(nx.abs() < 0.01, "Normal X should be ~0, got {}", nx);
                assert!((ny - (-1.0)).abs() < 0.01, "Normal Y should be ~-1, got {}", ny);
                assert!(nz.abs() < 0.01, "Normal Z should be ~0, got {}", nz);
            }
        }
    }

    #[test]
    fn test_compute_normals_region_sloped_terrain() {
        let resolution = 5usize;
        let (mut positions, indices, mut normals) = create_flat_terrain_grid(resolution, 0.0);
        
        // Create an asymmetric slope: raise one edge of the terrain (x=3, x=4)
        // This creates a slope tilting towards +X
        for z in 0..resolution {
            for x in 3..resolution {
                let idx = z * resolution + x;
                let height = (x - 2) as f32 * 2.0; // Gradual slope
                positions[idx * 3 + 1] = height;
            }
        }
        
        // Compute normals for center region
        compute_normals_region_u16(
            &positions,
            &indices,
            &mut normals,
            resolution as u32,
            1, 3,
            1, 3,
        );
        
        // Check a vertex on the slope (2, 2) - should have tilted normal towards -X
        let slope_idx = 2 * resolution + 2;
        let nx = normals[slope_idx * 3];
        let ny = normals[slope_idx * 3 + 1];
        let nz = normals[slope_idx * 3 + 2];
        
        // Normal should tilt towards -X (slope goes up in +X direction)
        // Normal Y is negative (pointing down due to winding)
        assert!(ny < 0.0, "Normal Y should be negative, got {}", ny);
        
        // Verify normal is normalized
        let length = (nx * nx + ny * ny + nz * nz).sqrt();
        assert!((length - 1.0).abs() < 0.01, "Normal should be normalized, length = {}", length);
        
        // Check that normals are different from flat terrain (ny should not be exactly -1)
        // Due to the slope, there should be some X component
        assert!(nx.abs() > 0.01 || ny.abs() < 0.99, 
            "Normal should be tilted from slope, nx={}, ny={}", nx, ny);
    }

    #[test]
    fn test_compute_normals_region_boundary() {
        let resolution = 5usize;
        let (positions, indices, mut normals) = create_flat_terrain_grid(resolution, 0.0);
        
        // Compute normals only for corner region
        compute_normals_region_u16(
            &positions,
            &indices,
            &mut normals,
            resolution as u32,
            0, 1, // minX, maxX (corner)
            0, 1, // minZ, maxZ (corner)
        );
        
        // Corner vertices should have valid normals (pointing down for flat terrain)
        let corner_idx = 0;
        let ny = normals[corner_idx * 3 + 1];
        assert!(ny < -0.5, "Corner normal Y should point down (< -0.5), got {}", ny);
        
        // Far corner should still be zero (not in region)
        let far_corner_idx = 4 * resolution + 4;
        let far_ny = normals[far_corner_idx * 3 + 1];
        assert!(far_ny.abs() < 0.01, "Far corner should be unchanged (0), got {}", far_ny);
    }

    #[test]
    fn test_compute_normals_region_matches_full_recompute() {
        let resolution = 5usize;
        let (mut positions, indices, mut normals_region) = create_flat_terrain_grid(resolution, 0.0);
        
        // Create a hill in the center
        positions[(2 * resolution + 2) * 3 + 1] = 3.0;
        
        // Compute normals using full recompute
        let normals_full = compute_normals_u16(&positions, &indices);
        
        // Compute normals using region update (entire terrain)
        compute_normals_region_u16(
            &positions,
            &indices,
            &mut normals_region,
            resolution as u32,
            0, (resolution - 1) as u32,
            0, (resolution - 1) as u32,
        );
        
        // Results should match
        for i in 0..normals_full.len() {
            assert!(
                (normals_full[i] - normals_region[i]).abs() < 0.01,
                "Normal mismatch at index {}: full={}, region={}",
                i, normals_full[i], normals_region[i]
            );
        }
    }
}
