use wasm_bindgen::prelude::*;

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

#[derive(Clone, Copy)]
struct Obb {
    center: [f32; 3],
    // axes are column vectors of the rotation matrix (u, v, w), each normalized
    axes: [[f32; 3]; 3],
    half: [f32; 3],
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

#[inline]
fn normalize_quat(q: [f32; 4]) -> [f32; 4] {
    let len = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt();
    if len > 0.0 { [q[0] / len, q[1] / len, q[2] / len, q[3] / len] } else { [0.0, 0.0, 0.0, 1.0] }
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
        let h = [others_scl[si].abs() * 0.5, others_scl[si + 1].abs() * 0.5, others_scl[si + 2].abs() * 0.5];
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
}


