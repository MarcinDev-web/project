use wasm_bindgen::prelude::*;

#[cfg(feature = "simd")]
use core::arch::wasm32::*;

#[cfg(feature = "panic-hook")]
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}
use std::collections::HashMap;

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

    // 1) A's axes
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
    // Treating capsule as a segment for simplified check + radius
    // This is an approximation or requires solving distance from segment to OBB
    // For performance, we can check if the capsule segment intersects the expanded OBB
    // or test segment vs OBB distance.
    
    // Transform segment into OBB local space
    let u = obb.axes[0];
    let v = obb.axes[1];
    let w = obb.axes[2];
    
    let p0 = sub(capsule.base, obb.center);
    let p1 = sub(capsule.tip, obb.center);
    
    let local_p0 = [dot(p0, u), dot(p0, v), dot(p0, w)];
    let local_p1 = [dot(p1, u), dot(p1, v), dot(p1, w)];
    
    // Expand OBB by capsule radius
    let r = capsule.radius;
    let ext_x = obb.half[0] + r;
    let ext_y = obb.half[1] + r;
    let ext_z = obb.half[2] + r;
    
    // Simple AABB test against expanded OBB in local space
    let min_x = local_p0[0].min(local_p1[0]);
    let max_x = local_p0[0].max(local_p1[0]);
    let min_y = local_p0[1].min(local_p1[1]);
    let max_y = local_p0[1].max(local_p1[1]);
    let min_z = local_p0[2].min(local_p1[2]);
    let max_z = local_p0[2].max(local_p1[2]);
    
    if min_x > ext_x || max_x < -ext_x || min_y > ext_y || max_y < -ext_y || min_z > ext_z || max_z < -ext_z {
        return false;
    }
    
    // For more precision, we should compute distance between segment and box
    // But this is often "good enough" for broad checks or we can refine
    true 
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
    
    // Ray origin outside sphere (c > 0) and ray pointing away (b > 0)
    if c > 0.0 && b > 0.0 {
        return -1.0;
    }
    
    let discr = b*b - c;
    if discr < 0.0 {
        return -1.0;
    }
    
    let t = -b - discr.sqrt();
    if t < 0.0 {
        return 0.0; // Inside sphere
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
            // Ray almost parallel to slab. Check if origin is outside.
            if (-e - obb.half[i]) > 0.0 || (-e + obb.half[i]) < 0.0 {
                return -1.0;
            }
        }
    }
    
    if t_min > 0.0 { t_min } else { t_max } // Simplified, better handling needed for inside start
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
    // Project half-sizes onto world axes
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

#[wasm_bindgen]
pub struct CollisionWorld {
    positions: Vec<f32>,
    rotations: Vec<f32>,
    scales: Vec<f32>,
}

#[wasm_bindgen]
impl CollisionWorld {
    #[wasm_bindgen(constructor)]
    pub fn new() -> CollisionWorld {
        CollisionWorld {
            positions: Vec::new(),
            rotations: Vec::new(),
            scales: Vec::new(),
        }
    }

    /// Resize buffers to hold `count` entities.
    /// This preserves existing data up to new size, or initializes new slots with 0.
    pub fn resize(&mut self, count: usize) {
        // Add padding for SIMD safety (read 4 floats at any 3-float aligned position)
        self.positions.resize(count * 3 + 4, 0.0);
        self.rotations.resize(count * 4, 0.0);
        self.scales.resize(count * 3 + 4, 0.0);
    }

    /// Get pointer to positions buffer (Float32Array view in JS).
    pub fn get_positions_ptr(&self) -> *const f32 {
        self.positions.as_ptr()
    }

    /// Get pointer to rotations buffer (Float32Array view in JS).
    pub fn get_rotations_ptr(&self) -> *const f32 {
        self.rotations.as_ptr()
    }

    /// Get pointer to scales buffer (Float32Array view in JS).
    pub fn get_scales_ptr(&self) -> *const f32 {
        self.scales.as_ptr()
    }

    /// Run batch collision check using internal buffers.
    /// Returns flat array of indices [idxA1, idxB1, idxA2, idxB2, ...]
    pub fn check_collisions(&self) -> Vec<u32> {
        batch_check_all(&self.positions, &self.rotations, &self.scales)
    }
}

/// Linear batch check using TRS inputs (SoA) - baseline without spatial index
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

    // Preview OBB
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
        
        let half;
        #[cfg(all(feature = "simd", target_arch = "wasm32"))]
        if si + 4 <= others_scl.len() {
            unsafe {
                let v = v128_load(others_scl.as_ptr().add(si) as *const v128);
                let v_abs = f32x4_abs(v);
                let v_half = f32x4_mul(v_abs, f32x4_splat(0.5));
                let mut temp = [0.0; 4];
                v128_store(temp.as_mut_ptr() as *mut v128, v_half);
                half = [temp[0], temp[1], temp[2]];
            }
        } else {
            half = [
                others_scl[si].abs() * 0.5,
                others_scl[si + 1].abs() * 0.5,
                others_scl[si + 2].abs() * 0.5,
            ];
        }
        #[cfg(not(all(feature = "simd", target_arch = "wasm32")))]
        {
            half = [
                others_scl[si].abs() * 0.5,
                others_scl[si + 1].abs() * 0.5,
                others_scl[si + 2].abs() * 0.5,
            ];
        }

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

/// Batch check using TRS with uniform-grid broad-phase inside Rust
#[wasm_bindgen]
pub fn batch_check_trs(
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

    // Small-N fallback to linear
    if n <= 64 {
        return batch_check_trs_linear(pre_pos, pre_rot, pre_scl, others_pos, others_rot, others_scl);
    }

    // Preview OBB and AABB
    let pre_center = [pre_pos[0], pre_pos[1], pre_pos[2]];
    let pre_axes = quat_to_axes(normalize_quat([pre_rot[0], pre_rot[1], pre_rot[2], pre_rot[3]]));
    let pre_half = [pre_scl[0].abs() * 0.5, pre_scl[1].abs() * 0.5, pre_scl[2].abs() * 0.5];
    let (pre_min, pre_max) = obb_to_aabb_extents(pre_center, pre_axes, pre_half);
    let pre_obb = Obb { center: pre_center, axes: pre_axes, half: pre_half };

    // Build arrays of others' OBB + AABB
    let mut centers: Vec<[f32;3]> = Vec::with_capacity(n);
    let mut axess: Vec<[[f32;3];3]> = Vec::with_capacity(n);
    let mut halves: Vec<[f32;3]> = Vec::with_capacity(n);
    let mut mins: Vec<[f32;3]> = Vec::with_capacity(n);
    let mut maxs: Vec<[f32;3]> = Vec::with_capacity(n);
    // SAFETY: vectors hold plain-old-data (`[f32; N]`). Every slot is written
    // immediately after this block and before any potential early return.
    unsafe {
        centers.set_len(n);
        axess.set_len(n);
        halves.set_len(n);
        mins.set_len(n);
        maxs.set_len(n);
    }

    // Compute cell size heuristic (based on preview diameter)
    let mut cell_size = (pre_half[0].max(pre_half[1]).max(pre_half[2])) * 2.0;
    if cell_size <= 1e-3 { cell_size = 1.0; }

    for i in 0..n {
        let pi = i * 3;
        let ri = i * 4;
        let si = i * 3;
        let c = [others_pos[pi], others_pos[pi + 1], others_pos[pi + 2]];
        let a = quat_to_axes(normalize_quat([
            others_rot[ri], others_rot[ri + 1], others_rot[ri + 2], others_rot[ri + 3],
        ]));
        
        let h;
        #[cfg(all(feature = "simd", target_arch = "wasm32"))]
        if si + 4 <= others_scl.len() {
            unsafe {
                let v = v128_load(others_scl.as_ptr().add(si) as *const v128);
                let v_abs = f32x4_abs(v);
                let v_half = f32x4_mul(v_abs, f32x4_splat(0.5));
                let mut temp = [0.0; 4];
                v128_store(temp.as_mut_ptr() as *mut v128, v_half);
                h = [temp[0], temp[1], temp[2]];
            }
        } else {
            h = [others_scl[si].abs() * 0.5, others_scl[si + 1].abs() * 0.5, others_scl[si + 2].abs() * 0.5];
        }
        #[cfg(not(all(feature = "simd", target_arch = "wasm32")))]
        {
            h = [others_scl[si].abs() * 0.5, others_scl[si + 1].abs() * 0.5, others_scl[si + 2].abs() * 0.5];
        }

        let (mn, mx) = obb_to_aabb_extents(c, a, h);
        centers[i] = c;
        axess[i] = a;
        halves[i] = h;
        mins[i] = mn;
        maxs[i] = mx;
        // Track a rougher cell size using median-ish object size (simple running max)
        let dia = (h[0].max(h[1]).max(h[2])) * 2.0;
        if dia > 1e-3 && dia < cell_size { cell_size = dia; }
    }
    if cell_size <= 1e-3 { cell_size = 1.0; }

    // Build uniform grid
    let inv_cell = 1.0 / cell_size;
    let mut grid: HashMap<(i32,i32,i32), Vec<u32>> = HashMap::with_capacity(n * 2);
    for i in 0..n {
        let mn = mins[i];
        let mx = maxs[i];
        let x0 = (mn[0] * inv_cell).floor() as i32;
        let y0 = (mn[1] * inv_cell).floor() as i32;
        let z0 = (mn[2] * inv_cell).floor() as i32;
        let x1 = (mx[0] * inv_cell).floor() as i32;
        let y1 = (mx[1] * inv_cell).floor() as i32;
        let z1 = (mx[2] * inv_cell).floor() as i32;
        for x in x0..=x1 {
            for y in y0..=y1 {
                for z in z0..=z1 {
                    grid.entry((x,y,z)).or_default().push(i as u32);
                }
            }
        }
    }

    // Query preview overlap cells
    let qx0 = (pre_min[0] * inv_cell).floor() as i32;
    let qy0 = (pre_min[1] * inv_cell).floor() as i32;
    let qz0 = (pre_min[2] * inv_cell).floor() as i32;
    let qx1 = (pre_max[0] * inv_cell).floor() as i32;
    let qy1 = (pre_max[1] * inv_cell).floor() as i32;
    let qz1 = (pre_max[2] * inv_cell).floor() as i32;

    let mut visited = vec![false; n];
    let mut candidates: Vec<u32> = Vec::new();
    for x in qx0..=qx1 {
        for y in qy0..=qy1 {
            for z in qz0..=qz1 {
                if let Some(v) = grid.get(&(x,y,z)) {
                    for &idx in v.iter() {
                        let ui = idx as usize;
                        if !visited[ui] {
                            visited[ui] = true;
                            candidates.push(idx);
                        }
                    }
                }
            }
        }
    }

    // Narrow phase
    let mut out = Vec::with_capacity(candidates.len());
    for &idx in candidates.iter() {
        let i = idx as usize;
        if !boxes_intersect(pre_min, pre_max, mins[i], maxs[i]) { continue; }
        let ob = Obb { center: centers[i], axes: axess[i], half: halves[i] };
        if obb_intersect_impl(pre_obb, ob) { out.push(idx); }
    }
    out
}

/// Batch check all vs all
/// Returns a list of pairs [a1, b1, a2, b2, ...]
#[wasm_bindgen]
pub fn batch_check_all(
    pos: &[f32],
    rot: &[f32],
    scl: &[f32],
) -> Vec<u32> {
    let n = pos.len() / 3;
    if n < 2 || rot.len() / 4 != n || scl.len() / 3 != n {
        return Vec::new();
    }

    let mut out = Vec::new();

    // Build world data once
    let mut centers: Vec<[f32;3]> = Vec::with_capacity(n);
    let mut axess: Vec<[[f32;3];3]> = Vec::with_capacity(n);
    let mut halves: Vec<[f32;3]> = Vec::with_capacity(n);
    let mut mins: Vec<[f32;3]> = Vec::with_capacity(n);
    let mut maxs: Vec<[f32;3]> = Vec::with_capacity(n);

    unsafe {
        centers.set_len(n);
        axess.set_len(n);
        halves.set_len(n);
        mins.set_len(n);
        maxs.set_len(n);
    }

    // Prepare data
    for i in 0..n {
        let pi = i * 3;
        let ri = i * 4;
        let si = i * 3;
        let c = [pos[pi], pos[pi + 1], pos[pi + 2]];
        let a = quat_to_axes(normalize_quat([
            rot[ri], rot[ri + 1], rot[ri + 2], rot[ri + 3],
        ]));
        let h = [scl[si].abs() * 0.5, scl[si + 1].abs() * 0.5, scl[si + 2].abs() * 0.5];
        let (mn, mx) = obb_to_aabb_extents(c, a, h);
        centers[i] = c;
        axess[i] = a;
        halves[i] = h;
        mins[i] = mn;
        maxs[i] = mx;
    }

    // Broadphase (Brute force for now, optimal for N < ~100, needs grid for more)
    // With n=1000, grid is better. 
    // Let's use simple spatial hashing or brute force depending on N.
    
    if n < 100 {
        // Brute force
        for i in 0..n {
            for j in (i + 1)..n {
                if boxes_intersect(mins[i], maxs[i], mins[j], maxs[j]) {
                    let ob1 = Obb { center: centers[i], axes: axess[i], half: halves[i] };
                    let ob2 = Obb { center: centers[j], axes: axess[j], half: halves[j] };
                    if obb_intersect_impl(ob1, ob2) {
                        out.push(i as u32);
                        out.push(j as u32);
                    }
                }
            }
        }
    } else {
        // Uniform Grid
        let mut cell_size = 1.0f32;
        // Estimate average size
        let mut sum_size = 0.0;
        for i in 0..n {
            sum_size += halves[i][0].max(halves[i][1]).max(halves[i][2]);
        }
        cell_size = (sum_size / n as f32) * 2.0 * 1.5; // heuristic
        if cell_size < 0.1 { cell_size = 0.1; }

        let inv_cell = 1.0 / cell_size;
        let mut grid: HashMap<(i32,i32,i32), Vec<usize>> = HashMap::with_capacity(n);

        for i in 0..n {
            let x0 = (mins[i][0] * inv_cell).floor() as i32;
            let y0 = (mins[i][1] * inv_cell).floor() as i32;
            let z0 = (mins[i][2] * inv_cell).floor() as i32;
            let x1 = (maxs[i][0] * inv_cell).floor() as i32;
            let y1 = (maxs[i][1] * inv_cell).floor() as i32;
            let z1 = (maxs[i][2] * inv_cell).floor() as i32;

            for x in x0..=x1 {
                for y in y0..=y1 {
                    for z in z0..=z1 {
                        grid.entry((x,y,z)).or_default().push(i);
                    }
                }
            }
        }

        // Iterate cells and check collisions
        // To avoid duplicates, only check if indexA < indexB
        // And to avoid checking same pair multiple times across cells, we need a way to dedupe.
        // Simple set or just re-check index condition.
        // Better: Iterate unique pairs.
        // Or: Sort pairs?
        
        // Simplified: Iterate all cells, check all pairs in cell. 
        // Deduplication is tricky.
        // Let's stick to "candidates check" approach.
        // Create a list of candidate pairs, sort and dedupe? O(K log K) where K is collisions.
        
        let mut candidates = Vec::new();
        for (_, indices) in grid {
             if indices.len() < 2 { continue; }
             for i in 0..indices.len() {
                 for j in (i+1)..indices.len() {
                     let idx1 = indices[i];
                     let idx2 = indices[j];
                     if idx1 < idx2 {
                         candidates.push((idx1, idx2));
                     } else {
                         candidates.push((idx2, idx1));
                     }
                 }
             }
        }
        
        candidates.sort_unstable();
        candidates.dedup();
        
        for (i, j) in candidates {
            if boxes_intersect(mins[i], maxs[i], mins[j], maxs[j]) {
                let ob1 = Obb { center: centers[i], axes: axess[i], half: halves[i] };
                let ob2 = Obb { center: centers[j], axes: axess[j], half: halves[j] };
                if obb_intersect_impl(ob1, ob2) {
                    out.push(i as u32);
                    out.push(j as u32);
                }
            }
        }
    }

    out
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

/// Computes global scene bounds (AABB) from world matrices and local half-extents.
/// Returns None if inputs are invalid or empty.
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

        if minx < min_x {
            min_x = minx;
        }
        if miny < min_y {
            min_y = miny;
        }
        if minz < min_z {
            min_z = minz;
        }
        if maxx > max_x {
            max_x = maxx;
        }
        if maxy > max_y {
            max_y = maxy;
        }
        if maxz > max_z {
            max_z = maxz;
        }
        has_any = true;
    }

    if !has_any
        || !min_x.is_finite()
        || !min_y.is_finite()
        || !min_z.is_finite()
        || !max_x.is_finite()
        || !max_y.is_finite()
        || !max_z.is_finite()
    {
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
    fn batch_indices() {
        let a = Obb { center: [0.0, 0.0, 0.0], axes: [[1.0,0.0,0.0],[0.0,1.0,0.0],[0.0,0.0,1.0]], half: [1.0, 1.0, 1.0] };
        let centers = vec![0.0, 0.0, 0.0, 3.0, 0.0, 0.0];
        let axes = vec![1.0,0.0,0.0, 0.0,1.0,0.0, 0.0,0.0,1.0,  1.0,0.0,0.0, 0.0,1.0,0.0, 0.0,0.0,1.0];
        let halves = vec![0.5,0.5,0.5, 0.5,0.5,0.5];
        let idx = batch_check(&a.center, &axes[0..9], &a.half, &centers, &axes, &halves);
        assert_eq!(idx, vec![0u32]);
    }

    #[test]
    fn batch_trs_indices() {
        let pre_pos = [0.0f32, 0.0, 0.0];
        let pre_rot = [0.0f32, 0.0, 0.0, 1.0];
        let pre_scl = [1.0f32, 1.0, 1.0];
        // first intersects, second does not
        let others_pos = vec![0.4, 0.0, 0.0, 3.0, 0.0, 0.0];
        let others_rot = vec![0.0,0.0,0.0,1.0,  0.0,0.0,0.0,1.0];
        let others_scl = vec![1.0,1.0,1.0, 1.0,1.0,1.0];
        let idx = batch_check_trs(&pre_pos, &pre_rot, &pre_scl, &others_pos, &others_rot, &others_scl);
        assert_eq!(idx, vec![0u32]);
    }

    #[test]
    fn batch_all_indices() {
        // Two objects intersecting at origin
        let pos = vec![0.0, 0.0, 0.0, 0.5, 0.0, 0.0]; 
        let rot = vec![0.0,0.0,0.0,1.0,  0.0,0.0,0.0,1.0];
        let scl = vec![1.0,1.0,1.0, 1.0,1.0,1.0];
        
        let pairs = batch_check_all(&pos, &rot, &scl);
        // Should detect collision between index 0 and 1
        assert_eq!(pairs.len(), 2);
        assert_eq!(pairs[0], 0);
        assert_eq!(pairs[1], 1);
    }

    #[test]
    fn scene_bounds_single_cube() {
        let world = vec![
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0,
        ];
        let half = vec![0.5, 0.5, 0.5];
        let bounds = compute_scene_bounds(&world, &half).expect("bounds");
        assert_eq!(bounds, vec![-0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
    }

    #[test]
    fn scene_bounds_invalid_lengths() {
        let world = vec![1.0; 15]; // not divisible by 16
        let half = vec![0.5, 0.5, 0.5];
        assert!(compute_scene_bounds(&world, &half).is_none());
    }
    
    #[test]
    fn sphere_sphere() {
        let s1 = Sphere { center: [0.0, 0.0, 0.0], radius: 1.0 };
        let s2 = Sphere { center: [1.5, 0.0, 0.0], radius: 1.0 };
        assert!(sphere_sphere_intersect_impl(s1, s2));
        let s3 = Sphere { center: [2.1, 0.0, 0.0], radius: 1.0 };
        assert!(!sphere_sphere_intersect_impl(s1, s3));
    }
}
