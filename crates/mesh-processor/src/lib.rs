use wasm_bindgen::prelude::*;
use glam::{Vec3, Vec2};

#[cfg(feature = "panic-hook")]
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn compute_normals(positions: &[f32], indices: &[u32]) -> Vec<f32> {
    let vertex_count = positions.len() / 3;
    let mut normals = vec![Vec3::ZERO; vertex_count];
    
    // Iterate over triangles
    for chunk in indices.chunks(3) {
        if chunk.len() < 3 { break; }
        
        let i0 = chunk[0] as usize;
        let i1 = chunk[1] as usize;
        let i2 = chunk[2] as usize;
        
        if i0 >= vertex_count || i1 >= vertex_count || i2 >= vertex_count {
            continue;
        }

        let v0 = Vec3::new(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
        let v1 = Vec3::new(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
        let v2 = Vec3::new(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

        let edge1 = v1 - v0;
        let edge2 = v2 - v0;
        let normal = edge1.cross(edge2); // Not normalized yet to weight by area
        
        // Add to each vertex normal
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
pub fn compute_normals_u16(positions: &[f32], indices: &[u16]) -> Vec<f32> {
    let vertex_count = positions.len() / 3;
    let mut normals = vec![Vec3::ZERO; vertex_count];
    
    // Iterate over triangles
    for chunk in indices.chunks(3) {
        if chunk.len() < 3 { break; }
        
        let i0 = chunk[0] as usize;
        let i1 = chunk[1] as usize;
        let i2 = chunk[2] as usize;
        
        if i0 >= vertex_count || i1 >= vertex_count || i2 >= vertex_count {
            continue;
        }

        let v0 = Vec3::new(positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]);
        let v1 = Vec3::new(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
        let v2 = Vec3::new(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);

        let edge1 = v1 - v0;
        let edge2 = v2 - v0;
        let normal = edge1.cross(edge2); // Not normalized yet to weight by area
        
        // Add to each vertex normal
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

