use wasm_bindgen::prelude::*;
use glam::{Vec3};

// Transparent voxel identifiers (treated specially during meshing).
// In a full engine this would come from a material registry, but for the WASM
// helper we keep a small built-in list.
const TRANSPARENT_IDS: [u16; 3] = [2, 3, 4];

#[wasm_bindgen]
pub struct MeshResult {
    vertices: Vec<f32>,
    indices: Vec<u32>,
    transparent_indices: Vec<u32>,
    normals: Vec<f32>,
    uvs: Vec<f32>,
    ao: Vec<f32>,
}

#[wasm_bindgen]
impl MeshResult {
    pub fn vertices(&self) -> Vec<f32> { self.vertices.clone() }
    pub fn indices(&self) -> Vec<u32> { self.indices.clone() }
    pub fn transparent_indices(&self) -> Vec<u32> { self.transparent_indices.clone() }
    pub fn normals(&self) -> Vec<f32> { self.normals.clone() }
    pub fn uvs(&self) -> Vec<f32> { self.uvs.clone() }
    pub fn ao(&self) -> Vec<f32> { self.ao.clone() }
}

#[wasm_bindgen]
pub fn mesh_chunk(
    voxels: &[u16], 
    size: u32,
    lod: u32,
) -> MeshResult {
    let lod = if lod < 1 { 1 } else { lod };
    let mut vertices = Vec::new();
    let mut indices = Vec::new();
    let mut transparent_indices = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut ao = Vec::new();
    let mut index_count = 0;

    // Effective size for the loop
    let size_effective = size / lod;
    let size_i = size_effective as i32;
    let step = lod as i32;
    
    // Helper to access voxel data safely
    // x, y, z are in LOD coordinates (0..size_effective)
    let get_voxel = |x: i32, y: i32, z: i32| -> u16 {
        if x < 0 || x >= size_i || y < 0 || y >= size_i || z < 0 || z >= size_i {
            return 0;
        }
        // Map back to original coordinates
        let rx = x * step;
        let ry = y * step;
        let rz = z * step;
        
        // Use original size for index calculation
        let original_size_i = size as i32;
        voxels[(rx + ry * original_size_i + rz * original_size_i * original_size_i) as usize]
    };

    let is_solid = |x: i32, y: i32, z: i32| -> bool {
        get_voxel(x, y, z) != 0
    };

    let is_transparent = |id: u16| -> bool {
        // Assuming 2=Water, 3=Glass, 4=Leaves, etc.
        TRANSPARENT_IDS.contains(&id)
    };

    let calc_ao_vertex = |s1: bool, s2: bool, c: bool| -> u32 {
        if s1 && s2 {
            0
        } else {
            3 - (if s1 {1} else {0} + if s2 {1} else {0} + if c {1} else {0})
        }
    };

    // Sweep over each axis (0=X, 1=Y, 2=Z)
    for d in 0..3 {
        let u = (d + 1) % 3;
        let v = (d + 2) % 3;
        
        let mut x = [0i32; 3];
        let mut q = [0i32; 3];
        q[d] = 1;
        
        let mask_len = (size_effective * size_effective) as usize;
        
        // Two passes: one for forward faces (+d), one for backward faces (-d)
        // This handles transparency correctly (e.g. Water | Glass -> draw both)
        for back_face in [false, true] {
            let mut mask = vec![0u32; mask_len];
            x[d] = -1;
            
            while x[d] < size_i {
                // 1. Compute mask
                let mut n = 0;
                x[v] = 0;
                while x[v] < size_i {
                    x[u] = 0;
                    while x[u] < size_i {
                        let voxel_curr = get_voxel(x[0], x[1], x[2]);
                        let voxel_next = get_voxel(x[0] + q[0], x[1] + q[1], x[2] + q[2]);
                        
                        let mask_val = if !back_face {
                            // Forward face: curr -> next
                            // Draw if curr is solid AND (next is air OR (curr is transparent AND next != curr))
                            if voxel_curr != 0 && (voxel_next == 0 || (is_transparent(voxel_curr) && voxel_next != voxel_curr)) {
                                voxel_curr
                            } else {
                                0
                            }
                        } else {
                            // Backward face: next -> curr
                            // Draw if next is solid AND (curr is air OR (next is transparent AND curr != next))
                            if voxel_next != 0 && (voxel_curr == 0 || (is_transparent(voxel_next) && voxel_curr != voxel_next)) {
                                voxel_next
                            } else {
                                0
                            }
                        };

                        if mask_val != 0 {
                            // Calculate AO
                            // We need the air block position (or the block causing occlusion)
                            let mut air_pos = x;
                            if !back_face {
                                air_pos[d] += 1;
                            }

                            // Neighbors in U and V directions
                            let mut du = [0i32; 3]; du[u] = 1;
                            let mut dv = [0i32; 3]; dv[v] = 1;
                            
                            // Helper to sample around air block
                            let sample = |ou: i32, ov: i32| -> bool {
                                is_solid(air_pos[0] + ou * du[0] + ov * dv[0],
                                         air_pos[1] + ou * du[1] + ov * dv[1],
                                         air_pos[2] + ou * du[2] + ov * dv[2])
                            };

                            // AO for corners (same as before)
                            let ao3 = calc_ao_vertex(sample(-1, 0), sample(0, -1), sample(-1, -1));
                            let ao2 = calc_ao_vertex(sample(1, 0), sample(0, -1), sample(1, -1));
                            let ao1 = calc_ao_vertex(sample(1, 0), sample(0, 1), sample(1, 1));
                            let ao0 = calc_ao_vertex(sample(-1, 0), sample(0, 1), sample(-1, 1));

                            // Pack into mask: ID (16b) | AO0 (2b) | AO1 (2b) | AO2 (2b) | AO3 (2b)
                            let packed = (mask_val as u32) 
                                | (ao0 << 16) 
                                | (ao1 << 18) 
                                | (ao2 << 20) 
                                | (ao3 << 22);
                            
                            mask[n] = packed;

                        } else {
                             mask[n] = 0;
                        }

                        n += 1;
                        x[u] += 1;
                    }
                    x[v] += 1;
                }
                
                // 2. Generate Mesh from Mask
                for j in 0..size_i {
                    for i in 0..size_i {
                        let idx = (j * size_i + i) as usize;
                        let mask_val = mask[idx];
                        
                        if mask_val != 0 {
                            let voxel_id = (mask_val & 0xFFFF) as u16;
                            
                            // Start a quad
                            let mut w = 1;
                            let mut h = 1;
                            
                            // Reconstruct coordinate
                            let mut pos = [0i32; 3];
                            pos[d] = x[d];
                            pos[u] = i;
                            pos[v] = j;
                            
                            // Use voxel logic to determine if we are drawing face at pos or pos+1
                            // If back_face, we are drawing face of voxel_next (which is at pos+1 effectively, facing -d)
                            // If !back_face, we are drawing face of voxel_curr (at pos, facing +d)
                            
                            // Compute width
                            while (i + w) < size_i {
                                let next_idx = (j * size_i + i + w) as usize;
                                let next_val = mask[next_idx];
                                if next_val != mask_val { break; }
                                w += 1;
                            }
                            
                            // Compute height
                            let mut bad_row = false;
                            while (j + h) < size_i {
                                for k in 0..w {
                                    let check_idx = ((j + h) * size_i + i + k) as usize;
                                    let check_val = mask[check_idx];
                                    if check_val != mask_val { 
                                        bad_row = true; 
                                        break; 
                                    }
                                }
                                if bad_row { break; }
                                h += 1;
                            }
                            
                            // Add quad and zero out mask
                            for y_off in 0..h {
                                for x_off in 0..w {
                                    mask[((j + y_off) * size_i + i + x_off) as usize] = 0;
                                }
                            }
                            
                            // Generate geometry
                            let mut origin = [0.0f32; 3];
                            origin[d] = (pos[d] + 1) as f32;
                            origin[u] = pos[u] as f32;
                            origin[v] = pos[v] as f32;
                            
                            // Scale origin by LOD
                            origin[0] *= lod as f32;
                            origin[1] *= lod as f32;
                            origin[2] *= lod as f32;

                            let origin_v = Vec3::from_array(origin);
                            
                            let normal_vec = if !back_face {
                                let mut n = [0.0f32; 3];
                                n[d] = 1.0;
                                n
                            } else {
                                let mut n = [0.0f32; 3];
                                n[d] = -1.0;
                                n
                            };
                            let normal_v = Vec3::from_array(normal_vec);
                            
                            // Scale width/height by LOD
                            let w_f = (w as f32) * (lod as f32);
                            let h_f = (h as f32) * (lod as f32);

                            let (final_up, final_right, final_origin) = match (d, !back_face) {
                                (0, true) => { // +X
                                    (Vec3::Y * w_f, Vec3::Z * h_f, origin_v)
                                },
                                (0, false) => { // -X
                                    (Vec3::Y * w_f, Vec3::NEG_Z * h_f, origin_v + Vec3::Z * h_f)
                                },
                                (1, true) => { // +Y
                                    (Vec3::X * h_f, Vec3::NEG_Z * w_f, origin_v + Vec3::Z * w_f)
                                },
                                (1, false) => { // -Y
                                    (Vec3::X * h_f, Vec3::Z * w_f, origin_v)
                                },
                                (2, true) => { // +Z
                                    (Vec3::Y * h_f, Vec3::NEG_X * w_f, origin_v + Vec3::X * w_f)
                                },
                                (2, false) => { // -Z
                                    (Vec3::Y * h_f, Vec3::X * w_f, origin_v)
                                },
                                _ => (Vec3::ZERO, Vec3::ZERO, Vec3::ZERO),
                            };

                            // Extract AO
                            let ao0 = ((mask_val >> 16) & 0x3) as f32 / 3.0;
                            let ao1 = ((mask_val >> 18) & 0x3) as f32 / 3.0;
                            let ao2 = ((mask_val >> 20) & 0x3) as f32 / 3.0;
                            let ao3 = ((mask_val >> 22) & 0x3) as f32 / 3.0;

                            // Target indices buffer
                            let target_indices = if is_transparent(voxel_id) {
                                &mut transparent_indices
                            } else {
                                &mut indices
                            };

                            add_quad(
                                &mut vertices, target_indices, &mut normals, &mut uvs, &mut ao, &mut index_count,
                                final_origin, final_up, final_right, normal_v,
                                w_f, h_f,
                                [ao0, ao1, ao2, ao3]
                            );
                        }
                    }
                }
                
                x[d] += 1;
            }
        }
    }

    MeshResult {
        vertices,
        indices,
        transparent_indices,
        normals,
        uvs,
        ao,
    }
}

fn add_quad(
    vertices: &mut Vec<f32>,
    indices: &mut Vec<u32>,
    normals: &mut Vec<f32>,
    uvs: &mut Vec<f32>,
    ao: &mut Vec<f32>,
    index_count: &mut u32,
    origin: Vec3,
    up: Vec3,
    right: Vec3,
    normal: Vec3,
    u_scale: f32,
    v_scale: f32,
    ao_values: [f32; 4],
) {
    let v0 = origin + up;
    let v1 = origin + up + right;
    let v2 = origin + right;
    let v3 = origin;

    vertices.push(v0.x); vertices.push(v0.y); vertices.push(v0.z);
    vertices.push(v1.x); vertices.push(v1.y); vertices.push(v1.z);
    vertices.push(v2.x); vertices.push(v2.y); vertices.push(v2.z);
    vertices.push(v3.x); vertices.push(v3.y); vertices.push(v3.z);

    for _ in 0..4 {
        normals.push(normal.x); normals.push(normal.y); normals.push(normal.z);
    }

    uvs.push(0.0); uvs.push(v_scale);
    uvs.push(u_scale); uvs.push(v_scale);
    uvs.push(u_scale); uvs.push(0.0);
    uvs.push(0.0); uvs.push(0.0);

    ao.push(ao_values[0]);
    ao.push(ao_values[1]);
    ao.push(ao_values[2]);
    ao.push(ao_values[3]);

    let start = *index_count;
    
    // Standard quad
    indices.push(start);
    indices.push(start + 3);
    indices.push(start + 2);
    indices.push(start + 2);
    indices.push(start + 1);
    indices.push(start);

    *index_count += 4;
}

#[cfg(test)]
mod tests {
    use super::{mesh_chunk};

    #[test]
    fn test_single_voxel() {
        let size = 1;
        let voxels = vec![1];
        let mesh = mesh_chunk(&voxels, size, 1);
        assert_eq!(mesh.indices().len(), 36);
        assert_eq!(mesh.vertices().len() / 3, 24);
    }

    #[test]
    fn test_greedy_merge() {
        let size = 2;
        let mut voxels = vec![0; 8];
        voxels[0] = 1; 
        voxels[1] = 1; 
        voxels[2] = 1; 
        voxels[3] = 1; 
        
        let mesh = mesh_chunk(&voxels, size, 1);
        
        // Expect 6 faces * 1 quad per face = 6 quads.
        // 6 * 6 indices = 36 indices.
        assert_eq!(mesh.indices().len(), 36, "Should merge into 6 faces");
    }

    #[test]
    fn test_different_materials_no_merge() {
        let size = 2;
        let mut voxels = vec![0; 8];
        voxels[0] = 1; 
        voxels[1] = 2; 
        
        let mesh = mesh_chunk(&voxels, size, 1);
        
        // Expect 10 faces = 60 indices.
        assert_eq!(mesh.indices().len(), 60);
    }

    #[test]
    fn test_lod() {
        let size = 2;
        let mut voxels = vec![0; 8];
        voxels[0] = 1; // (0,0,0) is solid
        
        // LOD 2 means we only check 0,0,0 effectively (size/2 = 1)
        let mesh = mesh_chunk(&voxels, size, 2);
        
        // Should generate a single cube of size 2x2x2
        assert_eq!(mesh.indices().len(), 36);
        
        // Check vertex scale - should be 2.0
        let verts = mesh.vertices();
        let mut found_2 = false;
        for v in verts {
            if v == 2.0 { found_2 = true; }
        }
        assert!(found_2, "Should have vertices at coordinate 2.0");
    }
}
