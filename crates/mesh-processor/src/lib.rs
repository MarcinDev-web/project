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
}
