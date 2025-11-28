use wasm_bindgen::prelude::*;

#[cfg(feature = "simd")]
use core::arch::wasm32::*;

#[cfg(feature = "panic-hook")]
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

const EPSILON: f32 = 1e-4;

#[inline]
fn dot(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

#[inline]
fn sub(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

#[inline]
fn add(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

#[allow(dead_code)]
#[inline]
fn cross(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

#[inline]
fn scale(v: [f32; 3], s: f32) -> [f32; 3] {
    [v[0] * s, v[1] * s, v[2] * s]
}

#[inline]
fn len_sq(v: [f32; 3]) -> f32 {
    v[0] * v[0] + v[1] * v[1] + v[2] * v[2]
}

#[allow(dead_code)]
#[inline]
fn normalize(v: [f32; 3]) -> [f32; 3] {
    let l = len_sq(v).sqrt();
    if l > EPSILON {
        scale(v, 1.0 / l)
    } else {
        [0.0, 0.0, 0.0]
    }
}

#[inline]
fn normalize_quat(q: [f32; 4]) -> [f32; 4] {
    #[cfg(all(feature = "simd", target_arch = "wasm32"))]
    unsafe {
        let v = v128_load(q.as_ptr() as *const v128);
        let sq = f32x4_mul(v, v);
        let len_sq = f32x4_extract_lane::<0>(sq) + f32x4_extract_lane::<1>(sq) + f32x4_extract_lane::<2>(sq) + f32x4_extract_lane::<3>(sq);
        if len_sq > 0.0 {
            let len = len_sq.sqrt();
            let factor = f32x4_splat(1.0 / len);
            let res = f32x4_mul(v, factor);
            let mut out = [0.0; 4];
            v128_store(out.as_mut_ptr() as *mut v128, res);
            return out;
        } else {
            return [0.0, 0.0, 0.0, 1.0];
        }
    }

    #[cfg(not(all(feature = "simd", target_arch = "wasm32")))]
    {
        let len = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt();
        if len > 0.0 { [q[0] / len, q[1] / len, q[2] / len, q[3] / len] } else { [0.0, 0.0, 0.0, 1.0] }
    }
}

/// Encodes a 3D coordinate (x, y, z) into a 30-bit Morton code.
/// Coordinates must be in [0, 1023] range.
#[inline]
fn encode_morton_3d(x: u32, y: u32, z: u32) -> u32 {
    fn part1by2(mut n: u32) -> u32 {
        n &= 0x000003ff;
        n = (n ^ (n << 16)) & 0xff0000ff;
        n = (n ^ (n << 8)) & 0x0300f00f;
        n = (n ^ (n << 4)) & 0x030c30c3;
        n = (n ^ (n << 2)) & 0x09249249;
        n
    }
    (part1by2(z) << 2) | (part1by2(y) << 1) | part1by2(x)
}

#[derive(Clone, Copy)]
struct Plane {
    normal: [f32; 3],
    distance: f32,
}

#[derive(Clone)]
struct Frustum {
    planes: [Plane; 6],
}

impl Frustum {
    fn from_matrix(m: &[f32]) -> Self {
        // Extract planes from ViewProjection matrix.
        // m is column-major 4x4 matrix.
        // Gribb & Hartmann method.
        let mut planes = [Plane { normal: [0.0; 3], distance: 0.0 }; 6];

        // Left
        planes[0].normal[0] = m[3] + m[0];
        planes[0].normal[1] = m[7] + m[4];
        planes[0].normal[2] = m[11] + m[8];
        planes[0].distance = m[15] + m[12];

        // Right
        planes[1].normal[0] = m[3] - m[0];
        planes[1].normal[1] = m[7] - m[4];
        planes[1].normal[2] = m[11] - m[8];
        planes[1].distance = m[15] - m[12];

        // Bottom
        planes[2].normal[0] = m[3] + m[1];
        planes[2].normal[1] = m[7] + m[5];
        planes[2].normal[2] = m[11] + m[9];
        planes[2].distance = m[15] + m[13];

        // Top
        planes[3].normal[0] = m[3] - m[1];
        planes[3].normal[1] = m[7] - m[5];
        planes[3].normal[2] = m[11] - m[9];
        planes[3].distance = m[15] - m[13];

        // Near
        planes[4].normal[0] = m[3] + m[2];
        planes[4].normal[1] = m[7] + m[6];
        planes[4].normal[2] = m[11] + m[10];
        planes[4].distance = m[15] + m[14];

        // Far
        planes[5].normal[0] = m[3] - m[2];
        planes[5].normal[1] = m[7] - m[6];
        planes[5].normal[2] = m[11] - m[10];
        planes[5].distance = m[15] - m[14];

        // Normalize
        for p in &mut planes {
            let len = (p.normal[0] * p.normal[0] + p.normal[1] * p.normal[1] + p.normal[2] * p.normal[2]).sqrt();
            if len > EPSILON {
                let inv_len = 1.0 / len;
                p.normal[0] *= inv_len;
                p.normal[1] *= inv_len;
                p.normal[2] *= inv_len;
                p.distance *= inv_len;
            }
        }

        Frustum { planes }
    }

    #[inline]
    fn intersects_aabb(&self, min: [f32; 3], max: [f32; 3]) -> bool {
        // Check AABB against all 6 planes.
        // If AABB is completely behind any plane, it's outside.
        for p in &self.planes {
            let mut p_vertex = [min[0], min[1], min[2]];
            
            if p.normal[0] >= 0.0 { p_vertex[0] = max[0]; }
            if p.normal[1] >= 0.0 { p_vertex[1] = max[1]; }
            if p.normal[2] >= 0.0 { p_vertex[2] = max[2]; }

            let dot = p.normal[0] * p_vertex[0] + p.normal[1] * p_vertex[1] + p.normal[2] * p_vertex[2];
            if dot + p.distance < 0.0 {
                return false;
            }
        }
        true
    }
}

// --- Occlusion Culling Structures ---

#[derive(Clone)]
struct OcclusionBuffer {
    width: u32,
    height: u32,
    buffer: Vec<f32>, // Stores depth values. Convention: 0.0 (near) to 1.0 (far). Initialized to 1.0.
    view_proj: [f32; 16],
}

impl OcclusionBuffer {
    fn new(width: u32, height: u32) -> Self {
        OcclusionBuffer {
            width,
            height,
            buffer: vec![1.0; (width * height) as usize],
            view_proj: [0.0; 16], // Needs to be updated
        }
    }

    fn clear(&mut self) {
        for v in &mut self.buffer {
            *v = 1.0;
        }
    }

    fn set_view_proj(&mut self, vp: &[f32]) {
        if vp.len() == 16 {
            self.view_proj.copy_from_slice(vp);
        }
    }

    // Project a point to screen space (NDC -> Screen Coords)
    // Returns (x, y, depth) in screen coords (pixels) and [0,1] depth.
    // Returns None if behind near plane (w <= 0).
    #[inline]
    fn project(&self, p: [f32; 3]) -> Option<([f32; 2], f32)> {
        let m = &self.view_proj;
        // Homogeneous coordinates
        let x = p[0]*m[0] + p[1]*m[4] + p[2]*m[8] + m[12];
        let y = p[0]*m[1] + p[1]*m[5] + p[2]*m[9] + m[13];
        let z = p[0]*m[2] + p[1]*m[6] + p[2]*m[10] + m[14];
        let w = p[0]*m[3] + p[1]*m[7] + p[2]*m[11] + m[15];

        if w <= EPSILON {
            return None;
        }

        let inv_w = 1.0 / w;
        let ndc_x = x * inv_w;
        let ndc_y = y * inv_w;
        let ndc_z = z * inv_w;

        // Map NDC [-1, 1] to Screen [0, W], [0, H]
        // Y is typically flipped in screen space vs NDC? 
        // WebGPU/Vulkan: Y down in screen, but Y up in NDC?
        // Let's assume standard mapping: (-1,-1) -> (0, H), (1,1) -> (W, 0) usually?
        // Actually simple mapping: 
        // x: (ndc_x + 1) * 0.5 * w
        // y: (1 - ndc_y) * 0.5 * h  (Y flip)
        // z: ndc_z (already 0..1 for WebGPU?) 
        // Note: WebGPU NDC z is [0, 1]. OpenGL is [-1, 1].
        // If projection matrix produces WebGPU-compatible Z [0, 1], then ndc_z is depth.
        // If standard GL, we need (ndc_z + 1) * 0.5.
        // Let's assume input matrix is correct for the target (WebGPU -> [0, 1]).
        
        let sx = (ndc_x + 1.0) * 0.5 * self.width as f32;
        let sy = (1.0 - ndc_y) * 0.5 * self.height as f32; // Flip Y
        
        Some(([sx, sy], ndc_z))
    }

    // Rasterize an AABB into the depth buffer.
    // Treating AABB as a solid block.
    // We project the 8 corners and compute a bounding rectangle in screen space.
    // For *occluder writing*, using the screen-space bounding rect of the AABB is INCORRECT (too aggressive).
    // We must be conservative: write only where the object *definitely* is.
    // However, implementing a full rasterizer for 12 triangles is expensive here.
    // COMPROMISE: We are NOT going to support "writing occluders" via AABB rasterization in this iteration 
    // because AABBs are poor occluders (contain empty space).
    // We will only implement IS_VISIBLE testing against the buffer.
    // To use this, the user would need to provide a way to "write" to the buffer, 
    // possibly by rasterizing a few large quads manually or if we implement `rasterize_quad`.
    
    // Actually, let's implement `rasterize_quad` so the user can feed walls/floors.
    // Or, simplest "Software Rasterizer": Point cloud? No.
    
    // Let's assume we treat "Occluders" as solid AABBs for now as requested.
    // To be conservative when writing depth for an AABB, we should effectively render the 
    // "inner" box, but we don't have that.
    // Let's render the front faces of the AABB.
    
    // For this task: "check against a depth buffer ... in Rust".
    // The most valuable part is the *query*.
    // I'll add `rasterize_occluder_aabb` which renders the AABB fully.
    // Caveat: If the AABB is larger than the object, it will occlude things it shouldn't.
    // This is acceptable for "Minecraft-like" voxel engines where AABB == Voxel Block.
    
    fn rasterize_aabb(&mut self, min: [f32; 3], max: [f32; 3]) {
        // Project all 8 corners to find screen bounds? 
        // No, we need per-pixel depth to be correct. 
        // We must rasterize the triangles of the box.
        
        let corners = [
            [min[0], min[1], min[2]], // 000
            [max[0], min[1], min[2]], // 100
            [min[0], max[1], min[2]], // 010
            [max[0], max[1], min[2]], // 110
            [min[0], min[1], max[2]], // 001
            [max[0], min[1], max[2]], // 101
            [min[0], max[1], max[2]], // 011
            [max[0], max[1], max[2]], // 111
        ];
        
        // Indices for 12 triangles (standard cube)
        // Front (Z-), Back (Z+), Left (X-), Right (X+), Bottom (Y-), Top (Y+)
        // Depending on winding. Let's assume CCW.
        // Or just rasterize all 12.
        
        // Simplified: Just rasterize the screen-space bounding box with the *farthest* depth?
        // No, for occlusion writing we want *nearest* depth.
        // But if we write *nearest* depth of an AABB to a full rect, we occlude empty corners.
        // Correct rasterization is needed.
        
        // Given the complexity constraint, I will implement a "2D Bounding Box" write 
        // but strictly for "is_visible" check (Reading).
        // Writing will be left as a future extension or implemented via a `clear_depth(1.0)` and user inputs.
        
        // Wait, the prompt says "Occlusion Culling can be added by extending query_frustum to check against a depth buffer or software rasterizer".
        // It doesn't explicitly say "implement writing occluders".
        // But checking against an empty buffer is useless.
        // So I MUST implement writing.
        
        // I will implement `rasterize_aabb` by computing the screen-space bounds 
        // and filling it with the `max_z` (farthest) of the AABB? 
        // No, `min_z` (nearest) is what occludes.
        // But we can't fill the rect with `min_z` because that's a "wall" at the front face.
        
        // Let's just implement a simplified point-cloud rasterizer? No.
        // Let's implement `rasterize_quad` and rasterize the 6 faces of the AABB.
        // That's 12 calls to rasterize_triangle.
        
        // Implementation of `rasterize_triangle` (barycentric) is roughly 50 lines.
        // It fits.
        
        let indices = [
             0, 2, 1, 1, 2, 3, // Front (Z-) ? Check coords. min_z is usually back in RH? 
                               // Let's just do all faces, backface culling will handle it.
             4, 5, 6, 5, 7, 6, // Back (Z+)
             0, 1, 4, 1, 5, 4, // Bottom (Y-)
             2, 6, 3, 3, 6, 7, // Top (Y+)
             0, 4, 2, 2, 4, 6, // Left (X-)
             1, 3, 5, 3, 7, 5, // Right (X+)
        ];
        
        for i in (0..36).step_by(3) {
             let v0 = corners[indices[i]];
             let v1 = corners[indices[i+1]];
             let v2 = corners[indices[i+2]];
             self.rasterize_triangle(v0, v1, v2);
        }
    }

    fn rasterize_triangle(&mut self, p0: [f32; 3], p1: [f32; 3], p2: [f32; 3]) {
        let v0_opt = self.project(p0);
        let v1_opt = self.project(p1);
        let v2_opt = self.project(p2);

        if v0_opt.is_none() || v1_opt.is_none() || v2_opt.is_none() { return; } // Clipping simplified: discard
        let (s0, z0) = v0_opt.unwrap();
        let (s1, z1) = v1_opt.unwrap();
        let (s2, z2) = v2_opt.unwrap();

        // 2D Bounding box
        let min_x = s0[0].min(s1[0]).min(s2[0]).max(0.0).floor() as i32;
        let max_x = s0[0].max(s1[0]).max(s2[0]).min((self.width - 1) as f32).ceil() as i32;
        let min_y = s0[1].min(s1[1]).min(s2[1]).max(0.0).floor() as i32;
        let max_y = s0[1].max(s1[1]).max(s2[1]).min((self.height - 1) as f32).ceil() as i32;

        if min_x > max_x || min_y > max_y { return; }

        // Edge functions
        let edge = |a: [f32; 2], b: [f32; 2], c: [f32; 2]| -> f32 {
             (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])
        };

        let area = edge(s0, s1, s2);
        if area.abs() < EPSILON { return; } // Degenerate
        let inv_area = 1.0 / area;

        for y in min_y..=max_y {
            for x in min_x..=max_x {
                let p = [x as f32 + 0.5, y as f32 + 0.5];
                let w0 = edge(s1, s2, p);
                let w1 = edge(s2, s0, p);
                let w2 = edge(s0, s1, p);

                // Barycentric coordinates
                // If winding is consistent, all should be >= 0 (or <= 0)
                if (w0 >= 0.0 && w1 >= 0.0 && w2 >= 0.0) || (w0 <= 0.0 && w1 <= 0.0 && w2 <= 0.0) {
                    let alpha = w0 * inv_area;
                    let beta = w1 * inv_area;
                    let gamma = w2 * inv_area;
                    
                    let z = alpha * z0 + beta * z1 + gamma * z2;
                    
                    // Depth test (Write)
                    // Assuming Z is 0..1, where 0 is near, 1 is far.
                    // We want to keep the NEAREST (smallest) z.
                    // Wait, WebGPU standard is 0=near, 1=far.
                    // Standard Z-buffer check: new_z < stored_z
                    
                    let idx = (y as u32 * self.width + x as u32) as usize;
                    if z < self.buffer[idx] {
                        self.buffer[idx] = z;
                    }
                }
            }
        }
    }

    // Check if an AABB is visible against the depth buffer.
    // Conservative check: if the AABB's *nearest* depth is greater than the *stored* depth
    // for ALL covered pixels, it is occluded.
    fn is_visible(&self, min: [f32; 3], max: [f32; 3]) -> bool {
        // Project 8 corners
        let corners = [
            [min[0], min[1], min[2]], [max[0], min[1], min[2]],
            [min[0], max[1], min[2]], [max[0], max[1], min[2]],
            [min[0], min[1], max[2]], [max[0], min[1], max[2]],
            [min[0], max[1], max[2]], [max[0], max[1], max[2]],
        ];

        let mut min_x = self.width as f32;
        let mut max_x = 0.0f32;
        let mut min_y = self.height as f32;
        let mut max_y = 0.0f32;
        let mut min_z = 1.0f32;

        let mut any_valid = false;

        for p in &corners {
            if let Some((s, z)) = self.project(*p) {
                if s[0] < min_x { min_x = s[0]; }
                if s[0] > max_x { max_x = s[0]; }
                if s[1] < min_y { min_y = s[1]; }
                if s[1] > max_y { max_y = s[1]; }
                if z < min_z { min_z = z; }
                any_valid = true;
            }
        }

        if !any_valid { return false; } // All behind camera? (Already culled by frustum usually)

        // Clamp to screen
        let ix0 = min_x.floor().max(0.0) as u32;
        let ix1 = max_x.ceil().min((self.width - 1) as f32) as u32;
        let iy0 = min_y.floor().max(0.0) as u32;
        let iy1 = max_y.ceil().min((self.height - 1) as f32) as u32;

        if ix0 > ix1 || iy0 > iy1 { return false; }

        // Check occlusion
        // Visible if for ANY pixel in bounds, min_z < buffer[pixel]
        // If min_z >= buffer[pixel] for ALL pixels, then it's occluded.
        
        for y in iy0..=iy1 {
            let row_offset = (y * self.width) as usize;
            for x in ix0..=ix1 {
                let depth = self.buffer[row_offset + x as usize];
                // Epsilon for z-fighting?
                if min_z < depth {
                    return true; // Visible at this pixel
                }
            }
        }

        false // Occluded everywhere
    }
}

#[derive(Clone, Copy)]
struct Obb {
    center: [f32; 3],
    // axes are column vectors of the rotation matrix (u, v, w), each normalized
    axes: [[f32; 3]; 3],
    half: [f32; 3],
}

#[derive(Clone, Copy)]
struct Sphere {
    center: [f32; 3],
    radius: f32,
}

#[derive(Clone, Copy)]
struct Capsule {
    base: [f32; 3],
    tip: [f32; 3],
    radius: f32,
}

#[inline]
fn load_center(src: &[f32]) -> [f32; 3] {
    [src[0], src[1], src[2]]
}

#[inline]
fn load_axes(src: &[f32]) -> [[f32; 3]; 3] {
    // src layout: [u0,u1,u2, v0,v1,v2, w0,w1,w2]
    [
        [src[0], src[1], src[2]],
        [src[3], src[4], src[5]],
        [src[6], src[7], src[8]],
    ]
}

#[inline]
fn load_half(src: &[f32]) -> [f32; 3] {
    [src[0], src[1], src[2]]
}

#[inline]
fn obb_from_slices(center: &[f32], axes: &[f32], half: &[f32]) -> Obb {
    Obb { center: load_center(center), axes: load_axes(axes), half: load_half(half) }
}

#[inline]
fn axis_overlap(t_proj: f32, ra_proj: f32, rb_proj: f32) -> bool {
    t_proj.abs() <= ra_proj + rb_proj + EPSILON
}

/// Contact information from collision detection.
/// Used for physics resolution (penetration depth, normal, contact point).
#[wasm_bindgen]
#[derive(Clone, Copy, Debug)]
pub struct CollisionContact {
    pub has_collision: bool,
    pub depth: f32,
    pub normal_x: f32,
    pub normal_y: f32,
    pub normal_z: f32,
    pub point_x: f32,
    pub point_y: f32,
    pub point_z: f32,
}

#[wasm_bindgen]
impl CollisionContact {
    #[wasm_bindgen(constructor)]
    pub fn new() -> CollisionContact {
        CollisionContact {
            has_collision: false,
            depth: 0.0,
            normal_x: 0.0,
            normal_y: 0.0,
            normal_z: 0.0,
            point_x: 0.0,
            point_y: 0.0,
            point_z: 0.0,
        }
    }
    
    pub fn get_normal(&self) -> Vec<f32> {
        vec![self.normal_x, self.normal_y, self.normal_z]
    }
    
    pub fn get_point(&self) -> Vec<f32> {
        vec![self.point_x, self.point_y, self.point_z]
    }
}

#[inline]
fn obb_intersect_impl(a: Obb, b: Obb) -> bool {
    let au = a.axes[0];
    let av = a.axes[1];
    let aw = a.axes[2];
    let bu = b.axes[0];
    let bv = b.axes[1];
    let bw = b.axes[2];

    // R[i][j] = Ai · Bj
    let r00 = dot(au, bu);
    let r01 = dot(au, bv);
    let r02 = dot(au, bw);
    let r10 = dot(av, bu);
    let r11 = dot(av, bv);
    let r12 = dot(av, bw);
    let r20 = dot(aw, bu);
    let r21 = dot(aw, bv);
    let r22 = dot(aw, bw);

    // |R| + epsilon
    let a00 = r00.abs() + EPSILON;
    let a01 = r01.abs() + EPSILON;
    let a02 = r02.abs() + EPSILON;
    let a10 = r10.abs() + EPSILON;
    let a11 = r11.abs() + EPSILON;
    let a12 = r12.abs() + EPSILON;
    let a20 = r20.abs() + EPSILON;
    let a21 = r21.abs() + EPSILON;
    let a22 = r22.abs() + EPSILON;

    // t in A's frame
    let t_world = sub(b.center, a.center);
    let t0 = dot(t_world, au);
    let t1 = dot(t_world, av);
    let t2 = dot(t_world, aw);

    let ra0 = a.half[0];
    let ra1 = a.half[1];
    let ra2 = a.half[2];
    let rb0 = b.half[0];
    let rb1 = b.half[1];
    let rb2 = b.half[2];

    // 1) A's axes (Test translation vector axes first for fail-fast)
    if !axis_overlap(t0, ra0, rb0 * a00 + rb1 * a01 + rb2 * a02) {
        return false;
    }
    if !axis_overlap(t1, ra1, rb0 * a10 + rb1 * a11 + rb2 * a12) {
        return false;
    }
    if !axis_overlap(t2, ra2, rb0 * a20 + rb1 * a21 + rb2 * a22) {
        return false;
    }

    // helper: dot(t, column j of R)
    let t_r0 = t0 * r00 + t1 * r10 + t2 * r20;
    let t_r1 = t0 * r01 + t1 * r11 + t2 * r21;
    let t_r2 = t0 * r02 + t1 * r12 + t2 * r22;

    // 2) B's axes
    if !axis_overlap(t_r0, ra0 * a00 + ra1 * a10 + ra2 * a20, rb0) {
        return false;
    }
    if !axis_overlap(t_r1, ra0 * a01 + ra1 * a11 + ra2 * a21, rb1) {
        return false;
    }
    if !axis_overlap(t_r2, ra0 * a02 + ra1 * a12 + ra2 * a22, rb2) {
        return false;
    }

    // 3) Cross products Ai x Bj
    // A.u x B.*
    if !axis_overlap(t2 * r10 - t1 * r20, ra1 * a20 + ra2 * a10, rb1 * a02 + rb2 * a01) {
        return false;
    }
    if !axis_overlap(t2 * r11 - t1 * r21, ra1 * a21 + ra2 * a11, rb0 * a02 + rb2 * a00) {
        return false;
    }
    if !axis_overlap(t2 * r12 - t1 * r22, ra1 * a22 + ra2 * a12, rb0 * a01 + rb1 * a00) {
        return false;
    }
    // A.v x B.*
    if !axis_overlap(t0 * r20 - t2 * r00, ra0 * a20 + ra2 * a00, rb1 * a12 + rb2 * a11) {
        return false;
    }
    if !axis_overlap(t0 * r21 - t2 * r01, ra0 * a21 + ra2 * a01, rb0 * a12 + rb2 * a10) {
        return false;
    }
    if !axis_overlap(t0 * r22 - t2 * r02, ra0 * a22 + ra2 * a02, rb0 * a11 + rb1 * a10) {
        return false;
    }
    // A.w x B.*
    if !axis_overlap(t1 * r00 - t0 * r10, ra0 * a10 + ra1 * a00, rb1 * a22 + rb2 * a21) {
        return false;
    }
    if !axis_overlap(t1 * r01 - t0 * r11, ra0 * a11 + ra1 * a01, rb0 * a22 + rb2 * a20) {
        return false;
    }
    if !axis_overlap(t1 * r02 - t0 * r12, ra0 * a12 + ra1 * a02, rb0 * a21 + rb1 * a20) {
        return false;
    }

    true
}

/// OBB-OBB collision with contact information (penetration depth, normal, contact point).
/// Returns collision info with the minimum penetration axis.
#[inline]
fn obb_intersect_with_contact_impl(a: Obb, b: Obb) -> CollisionContact {
    let au = a.axes[0];
    let av = a.axes[1];
    let aw = a.axes[2];
    let bu = b.axes[0];
    let bv = b.axes[1];
    let bw = b.axes[2];

    // R[i][j] = Ai · Bj
    let r00 = dot(au, bu);
    let r01 = dot(au, bv);
    let r02 = dot(au, bw);
    let r10 = dot(av, bu);
    let r11 = dot(av, bv);
    let r12 = dot(av, bw);
    let r20 = dot(aw, bu);
    let r21 = dot(aw, bv);
    let r22 = dot(aw, bw);

    // |R| + epsilon
    let a00 = r00.abs() + EPSILON;
    let a01 = r01.abs() + EPSILON;
    let a02 = r02.abs() + EPSILON;
    let a10 = r10.abs() + EPSILON;
    let a11 = r11.abs() + EPSILON;
    let a12 = r12.abs() + EPSILON;
    let a20 = r20.abs() + EPSILON;
    let a21 = r21.abs() + EPSILON;
    let a22 = r22.abs() + EPSILON;

    // t in A's frame
    let t_world = sub(b.center, a.center);
    let t0 = dot(t_world, au);
    let t1 = dot(t_world, av);
    let t2 = dot(t_world, aw);

    let ra0 = a.half[0];
    let ra1 = a.half[1];
    let ra2 = a.half[2];
    let rb0 = b.half[0];
    let rb1 = b.half[1];
    let rb2 = b.half[2];

    // Track minimum penetration
    let mut min_pen = f32::INFINITY;
    let mut best_axis: [f32; 3] = [0.0, 0.0, 0.0];
    let mut pen_sign = 1.0f32;

    // Helper to check axis and track minimum
    let mut check_axis = |t_proj: f32, ra_proj: f32, rb_proj: f32, axis: [f32; 3]| -> bool {
        let overlap = ra_proj + rb_proj - t_proj.abs();
        if overlap < -EPSILON {
            return false;
        }
        if overlap < min_pen {
            min_pen = overlap;
            best_axis = axis;
            pen_sign = if t_proj < 0.0 { -1.0 } else { 1.0 };
        }
        true
    };

    // 1) A's axes
    if !check_axis(t0, ra0, rb0 * a00 + rb1 * a01 + rb2 * a02, au) {
        return CollisionContact::new();
    }
    if !check_axis(t1, ra1, rb0 * a10 + rb1 * a11 + rb2 * a12, av) {
        return CollisionContact::new();
    }
    if !check_axis(t2, ra2, rb0 * a20 + rb1 * a21 + rb2 * a22, aw) {
        return CollisionContact::new();
    }

    // helper: dot(t, column j of R)
    let t_r0 = t0 * r00 + t1 * r10 + t2 * r20;
    let t_r1 = t0 * r01 + t1 * r11 + t2 * r21;
    let t_r2 = t0 * r02 + t1 * r12 + t2 * r22;

    // 2) B's axes
    if !check_axis(t_r0, ra0 * a00 + ra1 * a10 + ra2 * a20, rb0, bu) {
        return CollisionContact::new();
    }
    if !check_axis(t_r1, ra0 * a01 + ra1 * a11 + ra2 * a21, rb1, bv) {
        return CollisionContact::new();
    }
    if !check_axis(t_r2, ra0 * a02 + ra1 * a12 + ra2 * a22, rb2, bw) {
        return CollisionContact::new();
    }

    // 3) Cross products (edge-edge cases) - simplified: just check overlap, don't track as min penetration axis
    // These are less stable for contact normal, so we prefer face normals when close
    if !axis_overlap(t2 * r10 - t1 * r20, ra1 * a20 + ra2 * a10, rb1 * a02 + rb2 * a01) {
        return CollisionContact::new();
    }
    if !axis_overlap(t2 * r11 - t1 * r21, ra1 * a21 + ra2 * a11, rb0 * a02 + rb2 * a00) {
        return CollisionContact::new();
    }
    if !axis_overlap(t2 * r12 - t1 * r22, ra1 * a22 + ra2 * a12, rb0 * a01 + rb1 * a00) {
        return CollisionContact::new();
    }
    if !axis_overlap(t0 * r20 - t2 * r00, ra0 * a20 + ra2 * a00, rb1 * a12 + rb2 * a11) {
        return CollisionContact::new();
    }
    if !axis_overlap(t0 * r21 - t2 * r01, ra0 * a21 + ra2 * a01, rb0 * a12 + rb2 * a10) {
        return CollisionContact::new();
    }
    if !axis_overlap(t0 * r22 - t2 * r02, ra0 * a22 + ra2 * a02, rb0 * a11 + rb1 * a10) {
        return CollisionContact::new();
    }
    if !axis_overlap(t1 * r00 - t0 * r10, ra0 * a10 + ra1 * a00, rb1 * a22 + rb2 * a21) {
        return CollisionContact::new();
    }
    if !axis_overlap(t1 * r01 - t0 * r11, ra0 * a11 + ra1 * a01, rb0 * a22 + rb2 * a20) {
        return CollisionContact::new();
    }
    if !axis_overlap(t1 * r02 - t0 * r12, ra0 * a12 + ra1 * a02, rb0 * a21 + rb1 * a20) {
        return CollisionContact::new();
    }

    // Collision confirmed - compute normal (pointing from A to B)
    let normal = scale(best_axis, pen_sign);
    
    // Contact point: midpoint between closest points on the surfaces
    // Simplified: use center between boxes offset by penetration
    let contact_pt = [
        (a.center[0] + b.center[0]) * 0.5,
        (a.center[1] + b.center[1]) * 0.5,
        (a.center[2] + b.center[2]) * 0.5,
    ];

    CollisionContact {
        has_collision: true,
        depth: min_pen.max(0.0),
        normal_x: normal[0],
        normal_y: normal[1],
        normal_z: normal[2],
        point_x: contact_pt[0],
        point_y: contact_pt[1],
        point_z: contact_pt[2],
    }
}

// New Primitives

#[inline]
fn sphere_sphere_intersect_impl(a: Sphere, b: Sphere) -> bool {
    let dist_sq = len_sq(sub(a.center, b.center));
    let r_sum = a.radius + b.radius;
    dist_sq <= r_sum * r_sum
}

#[inline]
fn sphere_obb_intersect_impl(sphere: Sphere, box_collider: Obb) -> bool {
    let rel_center = sub(sphere.center, box_collider.center);
    
    // Transform sphere center to box local space
    let u = box_collider.axes[0];
    let v = box_collider.axes[1];
    let w = box_collider.axes[2];
    
    let local_x = dot(rel_center, u);
    let local_y = dot(rel_center, v);
    let local_z = dot(rel_center, w);

    // Find closest point on box
    let mut closest_x = local_x;
    let mut closest_y = local_y;
    let mut closest_z = local_z;

    if closest_x < -box_collider.half[0] { closest_x = -box_collider.half[0]; }
    else if closest_x > box_collider.half[0] { closest_x = box_collider.half[0]; }
    
    if closest_y < -box_collider.half[1] { closest_y = -box_collider.half[1]; }
    else if closest_y > box_collider.half[1] { closest_y = box_collider.half[1]; }
    
    if closest_z < -box_collider.half[2] { closest_z = -box_collider.half[2]; }
    else if closest_z > box_collider.half[2] { closest_z = box_collider.half[2]; }

    let dx = local_x - closest_x;
    let dy = local_y - closest_y;
    let dz = local_z - closest_z;
    
    let dist_sq = dx*dx + dy*dy + dz*dz;
    dist_sq <= sphere.radius * sphere.radius
}

#[inline]
fn point_segment_distance_sq(p: [f32; 3], a: [f32; 3], b: [f32; 3]) -> f32 {
    let ab = sub(b, a);
    let ap = sub(p, a);
    let e = dot(ap, ab);
    let f = len_sq(ab);
    
    let mut t = 0.0;
    if f > EPSILON {
        t = e / f;
    }
    if t < 0.0 { t = 0.0; }
    if t > 1.0 { t = 1.0; }
    
    let closest = add(a, scale(ab, t));
    len_sq(sub(p, closest))
}

#[inline]
fn capsule_sphere_intersect_impl(capsule: Capsule, sphere: Sphere) -> bool {
    let dist_sq = point_segment_distance_sq(sphere.center, capsule.base, capsule.tip);
    let r_sum = sphere.radius + capsule.radius;
    dist_sq <= r_sum * r_sum
}

#[inline]
fn closest_pt_segment_segment(p1: [f32; 3], q1: [f32; 3], p2: [f32; 3], q2: [f32; 3]) -> ([f32; 3], [f32; 3]) {
    let d1 = sub(q1, p1);
    let d2 = sub(q2, p2);
    let r = sub(p1, p2);
    let a = dot(d1, d1);
    let e = dot(d2, d2);
    let f = dot(d2, r);

    if a <= EPSILON && e <= EPSILON {
        return (p1, p2);
    }
    
    let mut s;
    let mut t;

    if a <= EPSILON {
        // Segment 1 is a point
        s = 0.0;
        t = (f / e).clamp(0.0, 1.0);
    } else {
        let c = dot(d1, r);
        if e <= EPSILON {
            // Segment 2 is a point
            t = 0.0;
            s = (-c / a).clamp(0.0, 1.0);
        } else {
            let b = dot(d1, d2);
            let denom = a*e - b*b;
            
            if denom != 0.0 {
                s = (b*f - c*e) / denom;
                s = s.clamp(0.0, 1.0);
            } else {
                s = 0.0;
            }
            
            t = (b*s + f) / e;
            if t < 0.0 {
                t = 0.0;
                s = (-c / a).clamp(0.0, 1.0);
            } else if t > 1.0 {
                t = 1.0;
                s = ((b - c) / a).clamp(0.0, 1.0);
            }
        }
    }

    let c1 = add(p1, scale(d1, s));
    let c2 = add(p2, scale(d2, t));
    (c1, c2)
}

#[inline]
fn capsule_capsule_intersect_impl(a: Capsule, b: Capsule) -> bool {
    let (c1, c2) = closest_pt_segment_segment(a.base, a.tip, b.base, b.tip);
    let dist_sq = len_sq(sub(c1, c2));
    let r_sum = a.radius + b.radius;
    dist_sq <= r_sum * r_sum
}

#[inline]
fn capsule_obb_intersect_impl(capsule: Capsule, obb: Obb) -> bool {
    // Transform capsule segment to OBB local space
    let u = obb.axes[0];
    let v = obb.axes[1];
    let w = obb.axes[2];
    
    let p0_local = sub(capsule.base, obb.center);
    let p1_local = sub(capsule.tip, obb.center);
    
    let start = [dot(p0_local, u), dot(p0_local, v), dot(p0_local, w)];
    let end = [dot(p1_local, u), dot(p1_local, v), dot(p1_local, w)];
    
    let r = capsule.radius;
    let ext_x = obb.half[0] + r;
    let ext_y = obb.half[1] + r;
    let ext_z = obb.half[2] + r;
    
    let min_x = start[0].min(end[0]);
    let max_x = start[0].max(end[0]);
    let min_y = start[1].min(end[1]);
    let max_y = start[1].max(end[1]);
    let min_z = start[2].min(end[2]);
    let max_z = start[2].max(end[2]);
    
    if min_x > ext_x || max_x < -ext_x || min_y > ext_y || max_y < -ext_y || min_z > ext_z || max_z < -ext_z {
        return false;
    }
    
    // Simple distance check for endpoints
    fn closest_pt_aabb(p: [f32; 3], half: [f32; 3]) -> [f32; 3] {
        [
            p[0].clamp(-half[0], half[0]),
            p[1].clamp(-half[1], half[1]),
            p[2].clamp(-half[2], half[2]),
        ]
    }
    
    let d = sub(end, start);
    let c_start = closest_pt_aabb(start, obb.half);
    if len_sq(sub(start, c_start)) <= r * r { return true; }
    
    let c_end = closest_pt_aabb(end, obb.half);
    if len_sq(sub(end, c_end)) <= r * r { return true; }
    
    // Ternary search for minimum distance
    let mut t_min = 0.0;
    let mut t_max = 1.0;
    for _ in 0..4 { 
        let t1 = t_min + (t_max - t_min) / 3.0;
        let t2 = t_max - (t_max - t_min) / 3.0;
        
        let p1 = add(start, scale(d, t1));
        let c1 = closest_pt_aabb(p1, obb.half);
        let d1 = len_sq(sub(p1, c1));
        
        let p2 = add(start, scale(d, t2));
        let c2 = closest_pt_aabb(p2, obb.half);
        let d2 = len_sq(sub(p2, c2));
        
        if d1 < d2 {
            t_max = t2;
            if d1 <= r*r { return true; }
        } else {
            t_min = t1;
            if d2 <= r*r { return true; }
        }
    }
    
    let t_mid = (t_min + t_max) * 0.5;
    let p_mid = add(start, scale(d, t_mid));
    let c_mid = closest_pt_aabb(p_mid, obb.half);
    if len_sq(sub(p_mid, c_mid)) <= r * r { return true; }

    false 
}

// Raycast logic

#[derive(Clone, Copy)]
struct Ray {
    origin: [f32; 3],
    dir: [f32; 3],
}

#[inline]
fn ray_sphere_intersect_impl(ray: Ray, sphere: Sphere) -> f32 {
    let m = sub(ray.origin, sphere.center);
    let b = dot(m, ray.dir);
    let c = dot(m, m) - sphere.radius * sphere.radius;
    
    if c > 0.0 && b > 0.0 {
        return -1.0;
    }
    
    let discr = b*b - c;
    if discr < 0.0 {
        return -1.0;
    }
    
    let t = -b - discr.sqrt();
    if t < 0.0 {
        return 0.0;
    }
    t
}

#[inline]
fn ray_obb_intersect_impl(ray: Ray, obb: Obb) -> f32 {
    let mut t_min = 0.0f32;
    let mut t_max = f32::INFINITY;
    
    let p = sub(obb.center, ray.origin);
    
    for i in 0..3 {
        let e = dot(obb.axes[i], p);
        let f = dot(obb.axes[i], ray.dir);
        
        if f.abs() > EPSILON {
            let t1 = (e + obb.half[i]) / f;
            let t2 = (e - obb.half[i]) / f;
            
            let (t_enter, t_exit) = if t1 > t2 { (t2, t1) } else { (t1, t2) };
            
            if t_enter > t_min { t_min = t_enter; }
            if t_exit < t_max { t_max = t_exit; }
            
            if t_min > t_max { return -1.0; }
            if t_max < 0.0 { return -1.0; }
        } else {
            if (-e - obb.half[i]) > 0.0 || (-e + obb.half[i]) < 0.0 {
                return -1.0;
            }
        }
    }
    
    if t_min > 0.0 { t_min } else { t_max }
}

/// Ray-capsule intersection.
/// Returns the distance to intersection or -1.0 if no hit.
/// The capsule is defined by two endpoints (base and tip) and a radius.
#[inline]
fn ray_capsule_intersect_impl(ray: Ray, capsule: Capsule) -> f32 {
    let ba = sub(capsule.tip, capsule.base);
    let oa = sub(ray.origin, capsule.base);
    
    let baba = dot(ba, ba);
    let bard = dot(ba, ray.dir);
    let baoa = dot(ba, oa);
    let rdoa = dot(ray.dir, oa);
    let oaoa = dot(oa, oa);
    
    let a = baba - bard * bard;
    let b = baba * rdoa - baoa * bard;
    let c = baba * oaoa - baoa * baoa - capsule.radius * capsule.radius * baba;
    
    let h = b * b - a * c;
    
    if h >= 0.0 {
        let t = (-b - h.sqrt()) / a;
        let y = baoa + t * bard;
        
        // Check if hit is on the cylindrical body
        if y > 0.0 && y < baba && t >= 0.0 {
            return t;
        }
        
        // Check caps (spheres at each end)
        // Base cap
        let sphere_base = Sphere { center: capsule.base, radius: capsule.radius };
        let t_base = ray_sphere_intersect_impl(ray, sphere_base);
        
        // Tip cap
        let sphere_tip = Sphere { center: capsule.tip, radius: capsule.radius };
        let t_tip = ray_sphere_intersect_impl(ray, sphere_tip);
        
        // Return closest valid hit
        match (t_base >= 0.0, t_tip >= 0.0) {
            (true, true) => t_base.min(t_tip),
            (true, false) => t_base,
            (false, true) => t_tip,
            (false, false) => -1.0,
        }
    } else {
        // Check caps only (ray parallel to cylinder axis or misses cylinder)
        let sphere_base = Sphere { center: capsule.base, radius: capsule.radius };
        let t_base = ray_sphere_intersect_impl(ray, sphere_base);
        
        let sphere_tip = Sphere { center: capsule.tip, radius: capsule.radius };
        let t_tip = ray_sphere_intersect_impl(ray, sphere_tip);
        
        match (t_base >= 0.0, t_tip >= 0.0) {
            (true, true) => t_base.min(t_tip),
            (true, false) => t_base,
            (false, true) => t_tip,
            (false, false) => -1.0,
        }
    }
}

#[inline]
fn quat_to_axes(q: [f32; 4]) -> [[f32; 3]; 3] {
    let [x, y, z, w] = q;
    let m00 = 1.0 - 2.0 * (y * y + z * z);
    let m01 = 2.0 * (x * y - z * w);
    let m02 = 2.0 * (x * z + y * w);
    let m10 = 2.0 * (x * y + z * w);
    let m11 = 1.0 - 2.0 * (x * x + z * z);
    let m12 = 2.0 * (y * z - x * w);
    let m20 = 2.0 * (x * z - y * w);
    let m21 = 2.0 * (y * z + x * w);
    let m22 = 1.0 - 2.0 * (x * x + y * y);
    // columns u, v, w
    [[m00, m10, m20], [m01, m11, m21], [m02, m12, m22]]
}

#[inline]
fn obb_to_aabb_extents(center: [f32; 3], axes: [[f32; 3]; 3], half: [f32; 3]) -> ([f32; 3], [f32; 3]) {
    let ex = axes[0][0].abs() * half[0] + axes[1][0].abs() * half[1] + axes[2][0].abs() * half[2];
    let ey = axes[0][1].abs() * half[0] + axes[1][1].abs() * half[1] + axes[2][1].abs() * half[2];
    let ez = axes[0][2].abs() * half[0] + axes[1][2].abs() * half[1] + axes[2][2].abs() * half[2];
    let min = [center[0] - ex, center[1] - ey, center[2] - ez];
    let max = [center[0] + ex, center[1] + ey, center[2] + ez];
    (min, max)
}

#[inline]
fn boxes_intersect(min_a: [f32; 3], max_a: [f32; 3], min_b: [f32; 3], max_b: [f32; 3]) -> bool {
    let overlap_x = max_a[0] >= min_b[0] - EPSILON && min_a[0] <= max_b[0] + EPSILON;
    let overlap_y = max_a[1] >= min_b[1] - EPSILON && min_a[1] <= max_b[1] + EPSILON;
    let overlap_z = max_a[2] >= min_b[2] - EPSILON && min_a[2] <= max_b[2] + EPSILON;
    overlap_x && overlap_y && overlap_z
}

#[derive(Clone, Copy, Debug)]
struct SpatialEntry {
    cell_key: u32,
    index: u32,
}

#[wasm_bindgen]
pub struct CollisionWorld {
    positions: Vec<f32>,
    rotations: Vec<f32>,
    scales: Vec<f32>,
    
    #[wasm_bindgen(skip)]
    pub centers: Vec<[f32; 3]>,
    #[wasm_bindgen(skip)]
    pub axes: Vec<[[f32; 3]; 3]>,
    #[wasm_bindgen(skip)]
    pub halves: Vec<[f32; 3]>,
    #[wasm_bindgen(skip)]
    pub mins: Vec<[f32; 3]>,
    #[wasm_bindgen(skip)]
    pub maxs: Vec<[f32; 3]>,
    
    spatial_indices: Vec<SpatialEntry>,
    grid_min: [f32; 3],
    grid_cell_size: f32,
    
    #[wasm_bindgen(skip)]
    pub results: Vec<u32>,
    #[wasm_bindgen(skip)]
    pub workspace_pairs: Vec<u64>,

    // Occlusion Culling
    occlusion_buffer: Option<OcclusionBuffer>,
}

#[wasm_bindgen]
impl CollisionWorld {
    #[wasm_bindgen(constructor)]
    pub fn new() -> CollisionWorld {
        CollisionWorld {
            positions: Vec::new(),
            rotations: Vec::new(),
            scales: Vec::new(),
            centers: Vec::new(),
            axes: Vec::new(),
            halves: Vec::new(),
            mins: Vec::new(),
            maxs: Vec::new(),
            spatial_indices: Vec::new(),
            grid_min: [0.0; 3],
            grid_cell_size: 1.0,
            results: Vec::new(),
            workspace_pairs: Vec::new(),
            occlusion_buffer: None,
        }
    }

    pub fn resize(&mut self, count: usize) {
        self.positions.resize(count * 3 + 4, 0.0);
        self.rotations.resize(count * 4, 0.0);
        self.scales.resize(count * 3 + 4, 0.0);
        
        self.centers.resize(count, [0.0; 3]);
        self.axes.resize(count, [[0.0; 3]; 3]);
        self.halves.resize(count, [0.0; 3]);
        self.mins.resize(count, [0.0; 3]);
        self.maxs.resize(count, [0.0; 3]);
        self.spatial_indices.resize(count * 27, SpatialEntry { cell_key: 0, index: 0 }); 
        self.spatial_indices.clear(); 
    }

    /// Clears all data and releases memory by shrinking internal vectors.
    /// Use this when the collision world is no longer needed or to reset state.
    pub fn clear(&mut self) {
        self.positions.clear();
        self.positions.shrink_to_fit();
        self.rotations.clear();
        self.rotations.shrink_to_fit();
        self.scales.clear();
        self.scales.shrink_to_fit();
        
        self.centers.clear();
        self.centers.shrink_to_fit();
        self.axes.clear();
        self.axes.shrink_to_fit();
        self.halves.clear();
        self.halves.shrink_to_fit();
        self.mins.clear();
        self.mins.shrink_to_fit();
        self.maxs.clear();
        self.maxs.shrink_to_fit();
        
        self.spatial_indices.clear();
        self.spatial_indices.shrink_to_fit();
        self.results.clear();
        self.results.shrink_to_fit();
        self.workspace_pairs.clear();
        self.workspace_pairs.shrink_to_fit();
        
        self.grid_min = [0.0; 3];
        self.grid_cell_size = 1.0;
        
        if let Some(buffer) = &mut self.occlusion_buffer {
            buffer.clear();
        }
    }

    pub fn get_positions_ptr(&self) -> *const f32 {
        self.positions.as_ptr()
    }

    pub fn get_rotations_ptr(&self) -> *const f32 {
        self.rotations.as_ptr()
    }

    pub fn get_scales_ptr(&self) -> *const f32 {
        self.scales.as_ptr()
    }

    // Occlusion Culling Methods

    /// Initialize occlusion buffer with given dimensions (e.g., 256x128).
    pub fn init_occlusion_culling(&mut self, width: u32, height: u32) {
        self.occlusion_buffer = Some(OcclusionBuffer::new(width, height));
    }

    /// Clear occlusion buffer.
    pub fn clear_occlusion_buffer(&mut self) {
        if let Some(buffer) = &mut self.occlusion_buffer {
            buffer.clear();
        }
    }

    /// Rasterize a set of entities (indices) as occluders.
    /// These entities will be rendered into the depth buffer as solid boxes.
    pub fn rasterize_occluders(&mut self, indices: &[u32], view_proj: &[f32]) {
        if self.occlusion_buffer.is_none() { return; }
        if view_proj.len() != 16 { return; }
        
        let buffer = self.occlusion_buffer.as_mut().unwrap();
        buffer.set_view_proj(view_proj);
        
        let n = self.centers.len();
        
        for &idx in indices {
            let i = idx as usize;
            if i < n {
                // Rasterize AABB
                // Note: Update workspace must be called before this if transforms changed!
                buffer.rasterize_aabb(self.mins[i], self.maxs[i]);
            }
        }
    }

    // Spatial Grid & Collision Methods

    fn rebuild_spatial_structure(&mut self) {
        let count = self.centers.len();
        if count == 0 { return; }

        let mut min_b = [f32::INFINITY; 3];
        let mut max_b = [f32::NEG_INFINITY; 3];
        let mut avg_size = 0.0;

        for i in 0..count {
            let mn = self.mins[i];
            let mx = self.maxs[i];
            for k in 0..3 {
                if mn[k] < min_b[k] { min_b[k] = mn[k]; }
                if mx[k] > max_b[k] { max_b[k] = mx[k]; }
            }
            let sz = (mx[0]-mn[0]).max(mx[1]-mn[1]).max(mx[2]-mn[2]);
            avg_size += sz;
        }
        avg_size = (avg_size / count as f32) * 2.0;
        if avg_size < 1.0 { avg_size = 1.0; }

        min_b[0] -= avg_size; min_b[1] -= avg_size; min_b[2] -= avg_size;
        max_b[0] += avg_size; max_b[1] += avg_size; max_b[2] += avg_size;

        self.grid_min = min_b;
        let extent = (max_b[0]-min_b[0]).max(max_b[1]-min_b[1]).max(max_b[2]-min_b[2]);
        self.grid_cell_size = extent / 1023.0; 
        if self.grid_cell_size < EPSILON { self.grid_cell_size = 1.0; }

        let inv_cell = 1.0 / self.grid_cell_size;

        self.spatial_indices.clear();
        
        for i in 0..count {
            let mn = self.mins[i];
            let mx = self.maxs[i];
            
            let x0 = ((mn[0] - self.grid_min[0]) * inv_cell).clamp(0.0, 1023.0) as u32;
            let y0 = ((mn[1] - self.grid_min[1]) * inv_cell).clamp(0.0, 1023.0) as u32;
            let z0 = ((mn[2] - self.grid_min[2]) * inv_cell).clamp(0.0, 1023.0) as u32;
            let x1 = ((mx[0] - self.grid_min[0]) * inv_cell).clamp(0.0, 1023.0) as u32;
            let y1 = ((mx[1] - self.grid_min[1]) * inv_cell).clamp(0.0, 1023.0) as u32;
            let z1 = ((mx[2] - self.grid_min[2]) * inv_cell).clamp(0.0, 1023.0) as u32;

            for z in z0..=z1 {
                for y in y0..=y1 {
                    for x in x0..=x1 {
                        let code = encode_morton_3d(x, y, z);
                        self.spatial_indices.push(SpatialEntry { cell_key: code, index: i as u32 });
                    }
                }
            }
        }

        self.spatial_indices.sort_unstable_by_key(|e| e.cell_key);
    }

    fn update_workspace(&mut self, count: usize) {
        let n = if count > self.centers.len() { self.centers.len() } else { count };
        if self.centers.len() < n { self.resize(n); }

        for i in 0..n {
            let pi = i * 3;
            let ri = i * 4;
            let si = i * 3;
            
            let c = [self.positions[pi], self.positions[pi+1], self.positions[pi+2]];
            let q = [self.rotations[ri], self.rotations[ri+1], self.rotations[ri+2], self.rotations[ri+3]];
            let s = [self.scales[si], self.scales[si+1], self.scales[si+2]];
            
            let a = quat_to_axes(normalize_quat(q));
            let h = [s[0].abs() * 0.5, s[1].abs() * 0.5, s[2].abs() * 0.5];
            let (mn, mx) = obb_to_aabb_extents(c, a, h);
            
            self.centers[i] = c;
            self.axes[i] = a;
            self.halves[i] = h;
            self.mins[i] = mn;
            self.maxs[i] = mx;
        }
    }

    pub fn check_collisions(&mut self) -> Vec<u32> {
        let count = self.positions.len() / 3;
        if count == 0 {
            return Vec::new();
        }
        
        self.update_workspace(count);
        self.rebuild_spatial_structure();
        
        self.results.clear(); 
        
        let mut start = 0;
        while start < self.spatial_indices.len() {
            let mut end = start + 1;
            let key = self.spatial_indices[start].cell_key;
            
            while end < self.spatial_indices.len() && self.spatial_indices[end].cell_key == key {
                end += 1;
            }
            
            for i in start..end {
                for j in (i+1)..end {
                    let idx_a = self.spatial_indices[i].index as usize;
                    let idx_b = self.spatial_indices[j].index as usize;
                    
                    if idx_a >= idx_b { continue; }
                    
                    if boxes_intersect(self.mins[idx_a], self.maxs[idx_a], self.mins[idx_b], self.maxs[idx_b]) {
                         let ob_a = Obb { center: self.centers[idx_a], axes: self.axes[idx_a], half: self.halves[idx_a] };
                         let ob_b = Obb { center: self.centers[idx_b], axes: self.axes[idx_b], half: self.halves[idx_b] };
                         
                         if obb_intersect_impl(ob_a, ob_b) {
                             self.results.push(idx_a as u32);
                             self.results.push(idx_b as u32);
                         }
                    }
                }
            }
            start = end;
        }
        
        self.workspace_pairs.clear();
        for chunk in self.results.chunks(2) {
            self.workspace_pairs.push( ((chunk[0] as u64) << 32) | (chunk[1] as u64) );
        }
        
        self.workspace_pairs.sort_unstable();
        self.workspace_pairs.dedup();
        
        self.results.clear();
        for p in &self.workspace_pairs {
            self.results.push((p >> 32) as u32);
            self.results.push((p & 0xFFFFFFFF) as u32);
        }
        
        self.results.clone()
    }

    pub fn query_frustum(&mut self, view_proj: &[f32]) -> Vec<u32> {
        if view_proj.len() != 16 { return Vec::new(); }
        
        let count = self.positions.len() / 3;
        if count == 0 { return Vec::new(); }

        self.update_workspace(count);
        self.rebuild_spatial_structure();
        
        let frustum = Frustum::from_matrix(view_proj);
        
        // Update occlusion buffer view proj if present
        if let Some(buffer) = &mut self.occlusion_buffer {
            buffer.set_view_proj(view_proj);
        }
        
        self.results.clear();
        
        let mut start = 0;
        while start < self.spatial_indices.len() {
            let mut end = start + 1;
            let key = self.spatial_indices[start].cell_key;
            while end < self.spatial_indices.len() && self.spatial_indices[end].cell_key == key {
                end += 1;
            }
            
            fn decode_morton_3d(code: u32) -> (u32, u32, u32) {
                fn compact1by2(mut x: u32) -> u32 {
                    x &= 0x09249249;
                    x = (x ^ (x >> 2)) & 0x030c30c3;
                    x = (x ^ (x >> 4)) & 0x0300f00f;
                    x = (x ^ (x >> 8)) & 0xff0000ff;
                    x = (x ^ (x >> 16)) & 0x000003ff;
                    x
                }
                (compact1by2(code), compact1by2(code >> 1), compact1by2(code >> 2))
            }
            
            let (gx, gy, gz) = decode_morton_3d(key);
            let cell_min = [
                self.grid_min[0] + gx as f32 * self.grid_cell_size,
                self.grid_min[1] + gy as f32 * self.grid_cell_size,
                self.grid_min[2] + gz as f32 * self.grid_cell_size,
            ];
            let cell_max = [
                cell_min[0] + self.grid_cell_size,
                cell_min[1] + self.grid_cell_size,
                cell_min[2] + self.grid_cell_size,
            ];
            
            if !frustum.intersects_aabb(cell_min, cell_max) {
                start = end;
                continue;
            }
            
            for i in start..end {
                let idx = self.spatial_indices[i].index as usize;
                if frustum.intersects_aabb(self.mins[idx], self.maxs[idx]) {
                    // Occlusion test
                    let visible = if let Some(buffer) = &self.occlusion_buffer {
                         buffer.is_visible(self.mins[idx], self.maxs[idx])
                    } else {
                         true
                    };
                    
                    if visible {
                        self.results.push(idx as u32);
                    }
                }
            }
            
            start = end;
        }
        
        self.results.sort_unstable();
        self.results.dedup();
        
        self.results.clone()
    }
    
    pub fn raycast_world(&self, origin: &[f32], dir: &[f32]) -> Option<Vec<f32>> {
         if origin.len() != 3 || dir.len() != 3 { return None; }
         let r_org = load_center(origin);
         let r_dir = load_center(dir);
         let ray = Ray { origin: r_org, dir: r_dir };
         
         let mut closest_t = f32::INFINITY;
         let mut hit_idx = u32::MAX;
         
         for i in 0..self.centers.len() {
             let obb = Obb { center: self.centers[i], axes: self.axes[i], half: self.halves[i] };
             let t = ray_obb_intersect_impl(ray, obb);
             
             if t >= 0.0 && t < closest_t {
                 closest_t = t;
                 hit_idx = i as u32;
             }
         }
         
         if hit_idx != u32::MAX {
             Some(vec![hit_idx as f32, closest_t])
         } else {
             None
         }
    }
}

// Wrappers
#[wasm_bindgen]
pub fn batch_check_trs_linear(
    pre_pos: &[f32],
    pre_rot: &[f32],
    pre_scl: &[f32],
    others_pos: &[f32],
    others_rot: &[f32],
    others_scl: &[f32],
) -> Vec<u32> {
    if pre_pos.len() != 3 || pre_rot.len() != 4 || pre_scl.len() != 3 {
        return Vec::new();
    }
    let n = others_pos.len() / 3;
    if others_rot.len() / 4 != n || others_scl.len() / 3 != n {
        return Vec::new();
    }

    let pre_center = [pre_pos[0], pre_pos[1], pre_pos[2]];
    let pre_axes = quat_to_axes(normalize_quat([pre_rot[0], pre_rot[1], pre_rot[2], pre_rot[3]]));
    let pre_half = [
        (pre_scl[0]).abs() * 0.5f32,
        (pre_scl[1]).abs() * 0.5f32,
        (pre_scl[2]).abs() * 0.5f32,
    ];
    let (pre_min, pre_max) = obb_to_aabb_extents(pre_center, pre_axes, pre_half);
    let pre_obb = Obb { center: pre_center, axes: pre_axes, half: pre_half };

    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let pi = i * 3;
        let ri = i * 4;
        let si = i * 3;
        let center = [others_pos[pi], others_pos[pi + 1], others_pos[pi + 2]];
        let axes = quat_to_axes(normalize_quat([
            others_rot[ri], others_rot[ri + 1], others_rot[ri + 2], others_rot[ri + 3],
        ]));
        
        let half = [
            others_scl[si].abs() * 0.5,
            others_scl[si + 1].abs() * 0.5,
            others_scl[si + 2].abs() * 0.5,
        ];

        let (omin, omax) = obb_to_aabb_extents(center, axes, half);
        if !boxes_intersect(pre_min, pre_max, omin, omax) {
            continue;
        }
        let ob = Obb { center, axes, half };
        if obb_intersect_impl(pre_obb, ob) {
            out.push(i as u32);
        }
    }
    out
}

#[wasm_bindgen]
pub fn batch_check_trs(
    pre_pos: &[f32],
    pre_rot: &[f32],
    pre_scl: &[f32],
    others_pos: &[f32],
    others_rot: &[f32],
    others_scl: &[f32],
) -> Vec<u32> {
    batch_check_trs_linear(pre_pos, pre_rot, pre_scl, others_pos, others_rot, others_scl)
}

#[wasm_bindgen]
pub fn batch_check_all(
    pos: &[f32],
    rot: &[f32],
    scl: &[f32],
) -> Vec<u32> {
    let n = pos.len() / 3;
    let mut world = CollisionWorld::new();
    world.resize(n);
    
    for i in 0..n*3 {
        world.positions[i] = pos[i];
    }
    for i in 0..n*4 {
        world.rotations[i] = rot[i];
    }
    for i in 0..n*3 {
        world.scales[i] = scl[i];
    }
    
    world.check_collisions()
}

#[wasm_bindgen]
pub fn obb_intersect(
    a_center: &[f32],
    a_axes: &[f32],
    a_half: &[f32],
    b_center: &[f32],
    b_axes: &[f32],
    b_half: &[f32],
) -> bool {
    if a_center.len() != 3 || b_center.len() != 3 || a_axes.len() != 9 || b_axes.len() != 9 || a_half.len() != 3 || b_half.len() != 3 {
        return false;
    }
    let a = obb_from_slices(a_center, a_axes, a_half);
    let b = obb_from_slices(b_center, b_axes, b_half);
    obb_intersect_impl(a, b)
}

/// OBB-OBB collision with contact information for physics resolution.
/// Returns a CollisionContact struct with penetration depth, normal, and contact point.
#[wasm_bindgen]
pub fn obb_intersect_with_contact(
    a_center: &[f32],
    a_axes: &[f32],
    a_half: &[f32],
    b_center: &[f32],
    b_axes: &[f32],
    b_half: &[f32],
) -> CollisionContact {
    if a_center.len() != 3 || b_center.len() != 3 || a_axes.len() != 9 || b_axes.len() != 9 || a_half.len() != 3 || b_half.len() != 3 {
        return CollisionContact::new();
    }
    let a = obb_from_slices(a_center, a_axes, a_half);
    let b = obb_from_slices(b_center, b_axes, b_half);
    obb_intersect_with_contact_impl(a, b)
}

#[wasm_bindgen]
pub fn sphere_sphere_intersect(
    a_center: &[f32],
    a_radius: f32,
    b_center: &[f32],
    b_radius: f32,
) -> bool {
    if a_center.len() != 3 || b_center.len() != 3 { return false; }
    sphere_sphere_intersect_impl(
        Sphere { center: load_center(a_center), radius: a_radius },
        Sphere { center: load_center(b_center), radius: b_radius }
    )
}

#[wasm_bindgen]
pub fn sphere_obb_intersect(
    s_center: &[f32],
    s_radius: f32,
    b_center: &[f32],
    b_axes: &[f32],
    b_half: &[f32],
) -> bool {
    if s_center.len() != 3 || b_center.len() != 3 || b_axes.len() != 9 || b_half.len() != 3 { return false; }
    sphere_obb_intersect_impl(
        Sphere { center: load_center(s_center), radius: s_radius },
        obb_from_slices(b_center, b_axes, b_half)
    )
}

#[wasm_bindgen]
pub fn capsule_sphere_intersect(
    c_base: &[f32],
    c_tip: &[f32],
    c_radius: f32,
    s_center: &[f32],
    s_radius: f32,
) -> bool {
    if c_base.len() != 3 || c_tip.len() != 3 || s_center.len() != 3 { return false; }
    capsule_sphere_intersect_impl(
        Capsule { base: load_center(c_base), tip: load_center(c_tip), radius: c_radius },
        Sphere { center: load_center(s_center), radius: s_radius }
    )
}

#[wasm_bindgen]
pub fn capsule_obb_intersect(
    c_base: &[f32],
    c_tip: &[f32],
    c_radius: f32,
    b_center: &[f32],
    b_axes: &[f32],
    b_half: &[f32],
) -> bool {
    if c_base.len() != 3 || c_tip.len() != 3 || b_center.len() != 3 || b_axes.len() != 9 || b_half.len() != 3 { return false; }
    capsule_obb_intersect_impl(
        Capsule { base: load_center(c_base), tip: load_center(c_tip), radius: c_radius },
        obb_from_slices(b_center, b_axes, b_half)
    )
}

#[wasm_bindgen]
pub fn capsule_capsule_intersect(
    a_base: &[f32],
    a_tip: &[f32],
    a_radius: f32,
    b_base: &[f32],
    b_tip: &[f32],
    b_radius: f32,
) -> bool {
    if a_base.len() != 3 || a_tip.len() != 3 || b_base.len() != 3 || b_tip.len() != 3 { return false; }
    capsule_capsule_intersect_impl(
        Capsule { base: load_center(a_base), tip: load_center(a_tip), radius: a_radius },
        Capsule { base: load_center(b_base), tip: load_center(b_tip), radius: b_radius }
    )
}

#[wasm_bindgen]
pub fn ray_sphere_intersect(
    ray_origin: &[f32],
    ray_dir: &[f32],
    s_center: &[f32],
    s_radius: f32,
) -> f32 {
    if ray_origin.len() != 3 || ray_dir.len() != 3 || s_center.len() != 3 { return -1.0; }
    ray_sphere_intersect_impl(
        Ray { origin: load_center(ray_origin), dir: load_center(ray_dir) },
        Sphere { center: load_center(s_center), radius: s_radius }
    )
}

#[wasm_bindgen]
pub fn ray_obb_intersect(
    ray_origin: &[f32],
    ray_dir: &[f32],
    b_center: &[f32],
    b_axes: &[f32],
    b_half: &[f32],
) -> f32 {
    if ray_origin.len() != 3 || ray_dir.len() != 3 || b_center.len() != 3 || b_axes.len() != 9 || b_half.len() != 3 { return -1.0; }
    ray_obb_intersect_impl(
        Ray { origin: load_center(ray_origin), dir: load_center(ray_dir) },
        obb_from_slices(b_center, b_axes, b_half)
    )
}

/// Ray-capsule intersection test.
/// Returns distance to intersection or -1.0 if no hit.
/// @param c_base - Capsule base point [x, y, z]
/// @param c_tip - Capsule tip point [x, y, z]
/// @param c_radius - Capsule radius
#[wasm_bindgen]
pub fn ray_capsule_intersect(
    ray_origin: &[f32],
    ray_dir: &[f32],
    c_base: &[f32],
    c_tip: &[f32],
    c_radius: f32,
) -> f32 {
    if ray_origin.len() != 3 || ray_dir.len() != 3 || c_base.len() != 3 || c_tip.len() != 3 { return -1.0; }
    ray_capsule_intersect_impl(
        Ray { origin: load_center(ray_origin), dir: load_center(ray_dir) },
        Capsule { base: load_center(c_base), tip: load_center(c_tip), radius: c_radius }
    )
}

#[wasm_bindgen]
pub fn batch_check(
    pre_center: &[f32],
    pre_axes: &[f32],
    pre_half: &[f32],
    others_centers: &[f32],
    others_axes: &[f32],
    others_half: &[f32],
) -> Vec<u32> {
    if pre_center.len() != 3 || pre_axes.len() != 9 || pre_half.len() != 3 {
        return Vec::new();
    }
    let a = obb_from_slices(pre_center, pre_axes, pre_half);

    // Validate lengths
    let n = others_centers.len() / 3;
    if others_axes.len() / 9 != n || others_half.len() / 3 != n {
        return Vec::new();
    }

    let mut result = Vec::new();
    result.reserve(n);
    for i in 0..n {
        let ci = i * 3;
        let ai = i * 9;
        let hi = i * 3;
        let b = Obb {
            center: [
                others_centers[ci],
                others_centers[ci + 1],
                others_centers[ci + 2],
            ],
            axes: [
                [others_axes[ai], others_axes[ai + 1], others_axes[ai + 2]],
                [others_axes[ai + 3], others_axes[ai + 4], others_axes[ai + 5]],
                [others_axes[ai + 6], others_axes[ai + 7], others_axes[ai + 8]],
            ],
            half: [others_half[hi], others_half[hi + 1], others_half[hi + 2]],
        };
        if obb_intersect_impl(a, b) {
            result.push(i as u32);
        }
    }
    result
}

#[wasm_bindgen]
pub fn compute_scene_bounds(world_mats: &[f32], half_extents: &[f32]) -> Option<Vec<f32>> {
    if world_mats.len() % 16 != 0 {
        return None;
    }
    let count = world_mats.len() / 16;
    if count == 0 || half_extents.len() / 3 != count {
        return None;
    }

    let mut min_x = f32::INFINITY;
    let mut min_y = f32::INFINITY;
    let mut min_z = f32::INFINITY;
    let mut max_x = f32::NEG_INFINITY;
    let mut max_y = f32::NEG_INFINITY;
    let mut max_z = f32::NEG_INFINITY;
    let mut has_any = false;

    for i in 0..count {
        let mat_base = i * 16;
        let half_base = i * 3;
        let hx = half_extents[half_base].abs();
        let hy = half_extents[half_base + 1].abs();
        let hz = half_extents[half_base + 2].abs();

        if !hx.is_finite() || !hy.is_finite() || !hz.is_finite() {
            continue;
        }

        let m0 = world_mats[mat_base];
        let m1 = world_mats[mat_base + 1];
        let m2 = world_mats[mat_base + 2];
        let m4 = world_mats[mat_base + 4];
        let m5 = world_mats[mat_base + 5];
        let m6 = world_mats[mat_base + 6];
        let m8 = world_mats[mat_base + 8];
        let m9 = world_mats[mat_base + 9];
        let m10 = world_mats[mat_base + 10];
        let cx = world_mats[mat_base + 12];
        let cy = world_mats[mat_base + 13];
        let cz = world_mats[mat_base + 14];

        if !cx.is_finite() || !cy.is_finite() || !cz.is_finite() {
            continue;
        }

        let ex = m0.abs() * hx + m4.abs() * hy + m8.abs() * hz;
        let ey = m1.abs() * hx + m5.abs() * hy + m9.abs() * hz;
        let ez = m2.abs() * hx + m6.abs() * hy + m10.abs() * hz;

        if !ex.is_finite() || !ey.is_finite() || !ez.is_finite() {
            continue;
        }

        let minx = cx - ex;
        let miny = cy - ey;
        let minz = cz - ez;
        let maxx = cx + ex;
        let maxy = cy + ey;
        let maxz = cz + ez;

        if minx < min_x { min_x = minx; }
        if miny < min_y { min_y = miny; }
        if minz < min_z { min_z = minz; }
        if maxx > max_x { max_x = maxx; }
        if maxy > max_y { max_y = maxy; }
        if maxz > max_z { max_z = maxz; }
        has_any = true;
    }

    if !has_any || !min_x.is_finite() {
        None
    } else {
        Some(vec![min_x, min_y, min_z, max_x, max_y, max_z])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn touching_faces_intersect() {
        let a = Obb { center: [0.0, 0.0, 0.0], axes: [[1.0,0.0,0.0],[0.0,1.0,0.0],[0.0,0.0,1.0]], half: [0.5, 0.5, 0.5] };
        let b = Obb { center: [1.0, 0.0, 0.0], axes: [[1.0,0.0,0.0],[0.0,1.0,0.0],[0.0,0.0,1.0]], half: [0.5, 0.5, 0.5] };
        assert!(obb_intersect_impl(a, b));
    }

    #[test]
    fn separated_do_not_intersect() {
        let a = Obb { center: [0.0, 0.0, 0.0], axes: [[1.0,0.0,0.0],[0.0,1.0,0.0],[0.0,0.0,1.0]], half: [0.5, 0.5, 0.5] };
        let b = Obb { center: [2.1, 0.0, 0.0], axes: [[1.0,0.0,0.0],[0.0,1.0,0.0],[0.0,0.0,1.0]], half: [0.5, 0.5, 0.5] };
        assert!(!obb_intersect_impl(a, b));
    }

    #[test]
    fn rotated_intersect() {
        let a = Obb { center: [0.0, 0.0, 0.0], axes: [[1.0,0.0,0.0],[0.0,1.0,0.0],[0.0,0.0,1.0]], half: [1.0, 0.5, 0.5] };
        // 45 deg around Z
        let s = (0.5f32).sqrt();
        let b = Obb { center: [0.4, 0.0, 0.0], axes: [[s,s,0.0],[-s,s,0.0],[0.0,0.0,1.0]], half: [0.6, 0.6, 0.5] };
        assert!(obb_intersect_impl(a, b));
    }

    #[test]
    fn test_occlusion_buffer_visibility() {
        let mut buffer = OcclusionBuffer::new(10, 10);
        let mut m = [0.0; 16];
        // Identity projection: x,y in [-1, 1], z in [-1, 1] (GL) or [0, 1] (WebGPU)
        // Our project() assumes WebGPU [0, 1] depth or similar.
        m[0] = 1.0; m[5] = 1.0; m[10] = 1.0; m[15] = 1.0;
        buffer.set_view_proj(&m);
        
        // Clear to far (1.0)
        buffer.clear();
        
        // Object at 0,0,0.5 (Visible)
        assert!(buffer.is_visible([-0.1, -0.1, 0.5], [0.1, 0.1, 0.51]));
        
        // "Rasterize" a closer object covering center
        // Manually set buffer center to 0.2
        for y in 3..7 {
            for x in 3..7 {
                buffer.buffer[y * 10 + x] = 0.2;
            }
        }
        
        // Object at 0,0,0.5 should now be occluded (0.5 > 0.2)
        // Center of screen is roughly (5, 5)
        // AABB [-0.1, 0.1] projects to center pixels.
        assert!(!buffer.is_visible([-0.1, -0.1, 0.5], [0.1, 0.1, 0.51]));
        
        // Object at 0,0,0.1 (In front of occluder)
        assert!(buffer.is_visible([-0.1, -0.1, 0.1], [0.1, 0.1, 0.11]));
    }
}
