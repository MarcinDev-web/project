use wasm_bindgen::prelude::*;
use glam::Vec3;

#[wasm_bindgen]
pub struct RaycastResult {
    pub x: i32,
    pub y: i32,
    pub z: i32,
    pub face: u8, // 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
    pub dist: f32,
}

#[wasm_bindgen]
impl RaycastResult {
    pub fn x(&self) -> i32 { self.x }
    pub fn y(&self) -> i32 { self.y }
    pub fn z(&self) -> i32 { self.z }
    pub fn face(&self) -> u8 { self.face }
    pub fn dist(&self) -> f32 { self.dist }
}

#[wasm_bindgen]
pub fn raycast(
    ox: f32, oy: f32, oz: f32,
    dx: f32, dy: f32, dz: f32,
    max_dist: f32,
    voxels: &[u16],
    size: u32,
) -> Option<RaycastResult> {
    let size_i = size as i32;
    
    // Normalize direction just in case, though usually caller provides normalized
    // But DDA works with any length? Standard DDA assumes unit direction for `dist` to be metric.
    // If dx,dy,dz is normalized, dist is in units.
    // Let's assume input is not guaranteed normalized, so we normalize it?
    // Or trust the caller. Let's trust the caller for perf, but DDA logic relies on deltaDist scaling.
    // Actually, to be safe:
    let dir = Vec3::new(dx, dy, dz).normalize_or_zero();
    if dir == Vec3::ZERO { return None; }

    let mut map_x = ox.floor() as i32;
    let mut map_y = oy.floor() as i32;
    let mut map_z = oz.floor() as i32;

    // Delta distance
    let delta_dist_x = if dir.x == 0.0 { f32::INFINITY } else { (1.0 / dir.x).abs() };
    let delta_dist_y = if dir.y == 0.0 { f32::INFINITY } else { (1.0 / dir.y).abs() };
    let delta_dist_z = if dir.z == 0.0 { f32::INFINITY } else { (1.0 / dir.z).abs() };

    let step_x;
    let mut side_dist_x;
    if dir.x < 0.0 {
        step_x = -1;
        side_dist_x = (ox - map_x as f32) * delta_dist_x;
    } else {
        step_x = 1;
        side_dist_x = (map_x as f32 + 1.0 - ox) * delta_dist_x;
    }

    let step_y;
    let mut side_dist_y;
    if dir.y < 0.0 {
        step_y = -1;
        side_dist_y = (oy - map_y as f32) * delta_dist_y;
    } else {
        step_y = 1;
        side_dist_y = (map_y as f32 + 1.0 - oy) * delta_dist_y;
    }

    let step_z;
    let mut side_dist_z;
    if dir.z < 0.0 {
        step_z = -1;
        side_dist_z = (oz - map_z as f32) * delta_dist_z;
    } else {
        step_z = 1;
        side_dist_z = (map_z as f32 + 1.0 - oz) * delta_dist_z;
    }

    let mut face = 0; // To be determined
    let mut dist = 0.0;

    // Safety max iterations to prevent freeze
    let max_iter = (max_dist * 2.0) as i32 + 10; 
    
    for _ in 0..max_iter {
        // Check valid bounds
        // If we are inside bounds, check voxel.
        // If we leave bounds, we might re-enter? No, chunk raycast usually stops at chunk boundary?
        // The `voxels` array is for a SINGLE chunk.
        // So if we exit chunk bounds, we stop.
        if map_x < 0 || map_x >= size_i || map_y < 0 || map_y >= size_i || map_z < 0 || map_z >= size_i {
            // Out of bounds.
            // If we just started inside, we check. If we stepped out, we stop.
            // Since we loop, if we step out, we break.
            // But we might start outside? The function assumes local coords?
            // If local coords, 0..size.
            break;
        }

        // Check voxel
        let idx = (map_x + map_y * size_i + map_z * size_i * size_i) as usize;
        if idx < voxels.len() {
            let id = voxels[idx];
            if id != 0 {
                // Hit!
                // Face: depending on which step we took last.
                // Wait, we haven't stepped yet in the first iteration?
                // No, we check FIRST, then step?
                // Standard DDA: Check, then Step? 
                // If we start inside a block, dist is 0.
                // But we usually want to step first if we are strictly "raycasting for intersection".
                // If origin is inside a block, do we return it?
                // Yes.
                return Some(RaycastResult {
                    x: map_x,
                    y: map_y,
                    z: map_z,
                    face,
                    dist,
                });
            }
        }

        // Step
        if side_dist_x < side_dist_y {
            if side_dist_x < side_dist_z {
                dist = side_dist_x;
                side_dist_x += delta_dist_x;
                map_x += step_x;
                face = if step_x > 0 { 1 } else { 0 }; // If step +X, we hit left face (-X normal).
            } else {
                dist = side_dist_z;
                side_dist_z += delta_dist_z;
                map_z += step_z;
                face = if step_z > 0 { 5 } else { 4 }; // If step +Z, we hit back face (-Z normal).
            }
        } else {
            if side_dist_y < side_dist_z {
                dist = side_dist_y;
                side_dist_y += delta_dist_y;
                map_y += step_y;
                face = if step_y > 0 { 3 } else { 2 }; // If step +Y, we hit bottom face (-Y normal).
            } else {
                dist = side_dist_z;
                side_dist_z += delta_dist_z;
                map_z += step_z;
                face = if step_z > 0 { 5 } else { 4 };
            }
        }

        if dist > max_dist {
            break;
        }
    }

    None
}

