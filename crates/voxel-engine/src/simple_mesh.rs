use wasm_bindgen::prelude::*;
use glam::{Vec3};

#[wasm_bindgen]
pub struct SimpleMeshResult {
    vertices: Vec<f32>,
    indices: Vec<u32>,
    normals: Vec<f32>,
    uvs: Vec<f32>,
}

#[wasm_bindgen]
impl SimpleMeshResult {
    pub fn vertices(&self) -> Vec<f32> { self.vertices.clone() }
    pub fn indices(&self) -> Vec<u32> { self.indices.clone() }
    pub fn normals(&self) -> Vec<f32> { self.normals.clone() }
    pub fn uvs(&self) -> Vec<f32> { self.uvs.clone() }
}

// Simple cull facing meshing implementation
#[wasm_bindgen]
pub fn simple_mesh_chunk(
    voxels: &[u16], 
    size: u32,
) -> SimpleMeshResult {
    let _size_idx = size as usize;
    let mut vertices = Vec::new();
    let mut indices = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    
    let mut index_count = 0;

    // Helper to get voxel at x,y,z
    // Returns 0 if out of bounds (treated as air)
    let get_voxel = |x: i32, y: i32, z: i32| -> u16 {
        if x < 0 || x >= size as i32 || y < 0 || y >= size as i32 || z < 0 || z >= size as i32 {
            return 0;
        }
        voxels[(x + y * size as i32 + z * size as i32 * size as i32) as usize]
    };

    for z in 0..size as i32 {
        for y in 0..size as i32 {
            for x in 0..size as i32 {
                let voxel = get_voxel(x, y, z);
                if voxel == 0 { continue; } // Skip air

                // Check 6 neighbors
                // +X
                if get_voxel(x + 1, y, z) == 0 {
                    add_face(&mut vertices, &mut indices, &mut normals, &mut uvs, &mut index_count, 
                             Vec3::new(x as f32 + 1.0, y as f32, z as f32),
                             Vec3::new(0.0, 1.0, 0.0),
                             Vec3::new(0.0, 0.0, 1.0),
                             Vec3::new(1.0, 0.0, 0.0));
                }
                // -X
                if get_voxel(x - 1, y, z) == 0 {
                    add_face(&mut vertices, &mut indices, &mut normals, &mut uvs, &mut index_count,
                             Vec3::new(x as f32, y as f32, z as f32 + 1.0),
                             Vec3::new(0.0, 1.0, 0.0),
                             Vec3::new(0.0, 0.0, -1.0),
                             Vec3::new(-1.0, 0.0, 0.0));
                }
                // +Y
                if get_voxel(x, y + 1, z) == 0 {
                    add_face(&mut vertices, &mut indices, &mut normals, &mut uvs, &mut index_count,
                             Vec3::new(x as f32, y as f32 + 1.0, z as f32 + 1.0),
                             Vec3::new(1.0, 0.0, 0.0),
                             Vec3::new(0.0, 0.0, -1.0),
                             Vec3::new(0.0, 1.0, 0.0));
                }
                // -Y
                if get_voxel(x, y - 1, z) == 0 {
                    add_face(&mut vertices, &mut indices, &mut normals, &mut uvs, &mut index_count,
                             Vec3::new(x as f32, y as f32, z as f32),
                             Vec3::new(1.0, 0.0, 0.0),
                             Vec3::new(0.0, 0.0, 1.0),
                             Vec3::new(0.0, -1.0, 0.0));
                }
                // +Z
                if get_voxel(x, y, z + 1) == 0 {
                    add_face(&mut vertices, &mut indices, &mut normals, &mut uvs, &mut index_count,
                             Vec3::new(x as f32 + 1.0, y as f32, z as f32 + 1.0),
                             Vec3::new(0.0, 1.0, 0.0),
                             Vec3::new(-1.0, 0.0, 0.0),
                             Vec3::new(0.0, 0.0, 1.0));
                }
                // -Z
                if get_voxel(x, y, z - 1) == 0 {
                    add_face(&mut vertices, &mut indices, &mut normals, &mut uvs, &mut index_count,
                             Vec3::new(x as f32, y as f32, z as f32),
                             Vec3::new(0.0, 1.0, 0.0),
                             Vec3::new(1.0, 0.0, 0.0),
                             Vec3::new(0.0, 0.0, -1.0));
                }
            }
        }
    }

    SimpleMeshResult {
        vertices,
        indices,
        normals,
        uvs,
    }
}

fn add_face(
    vertices: &mut Vec<f32>,
    indices: &mut Vec<u32>,
    normals: &mut Vec<f32>,
    uvs: &mut Vec<f32>,
    index_count: &mut u32,
    origin: Vec3,
    up: Vec3,
    right: Vec3,
    normal: Vec3
) {
    // 0 -- 1
    // |    |
    // 3 -- 2
    
    // Vertices
    let v0 = origin + up;
    let v1 = origin + up + right;
    let v2 = origin + right;
    let v3 = origin;

    vertices.push(v0.x); vertices.push(v0.y); vertices.push(v0.z);
    vertices.push(v1.x); vertices.push(v1.y); vertices.push(v1.z);
    vertices.push(v2.x); vertices.push(v2.y); vertices.push(v2.z);
    vertices.push(v3.x); vertices.push(v3.y); vertices.push(v3.z);

    // Normals
    for _ in 0..4 {
        normals.push(normal.x); normals.push(normal.y); normals.push(normal.z);
    }

    // UVs
    uvs.push(0.0); uvs.push(1.0);
    uvs.push(1.0); uvs.push(1.0);
    uvs.push(1.0); uvs.push(0.0);
    uvs.push(0.0); uvs.push(0.0);

    // Indices (CCW)
    let start = *index_count;
    indices.push(start);
    indices.push(start + 3);
    indices.push(start + 2);
    indices.push(start + 2);
    indices.push(start + 1);
    indices.push(start);

    *index_count += 4;
}

