use wasm_bindgen::prelude::*;
use glam::{Vec3, Vec4, Quat, Mat4};
use std::collections::HashMap;

#[cfg(feature = "panic-hook")]
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

// ============================================================================
// CORE TYPES
// ============================================================================

#[derive(Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum Interpolation {
    Step = 0,
    Linear = 1,
    Cubic = 2,
}

#[derive(Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum TrackType {
    Translation = 0,
    Rotation = 1,
    Scale = 2,
}

#[derive(Clone)]
pub struct Track {
    pub joint_index: usize,
    pub track_type: TrackType,
    pub times: Vec<f32>,
    pub values: Vec<f32>, // Stride: 3 for T/S, 4 for R
    pub interpolation: Interpolation,
    /// Cached last keyframe index for temporal coherence
    pub last_key_hint: u32,
}

#[derive(Clone)]
pub struct AnimationClip {
    pub id: u32,
    pub duration: f32,
    pub tracks: Vec<Track>,
}

#[derive(Clone)]
pub struct Skeleton {
    pub parents: Vec<i32>,
    pub inverse_bind_matrices: Vec<Mat4>,
}

#[derive(Clone)]
pub struct Instance {
    pub skeleton_id: u32,
    pub local_translations: Vec<Vec3>,
    pub local_rotations: Vec<Quat>,
    pub local_scales: Vec<Vec3>,
    pub skinning_matrices: Vec<Mat4>,
    pub global_bone_matrices: Vec<Mat4>,
    pub active: bool,
    pub current_clip: Option<u32>,
    pub current_time: f32,
    /// Per-track last keyframe hints for this instance
    pub track_hints: Vec<u32>,
}

impl Instance {
    pub fn new(skeleton_id: u32, joint_count: usize) -> Self {
        Self {
            skeleton_id,
            local_translations: vec![Vec3::ZERO; joint_count],
            local_rotations: vec![Quat::IDENTITY; joint_count],
            local_scales: vec![Vec3::ONE; joint_count],
            skinning_matrices: vec![Mat4::IDENTITY; joint_count],
            global_bone_matrices: vec![Mat4::IDENTITY; joint_count],
            active: true,
            current_clip: None,
            current_time: 0.0,
            track_hints: Vec::new(),
        }
    }

    /// Ensure track hints vector has correct size for the clip
    pub fn ensure_track_hints(&mut self, track_count: usize) {
        if self.track_hints.len() != track_count {
            self.track_hints.resize(track_count, 0);
        }
    }
}

// ============================================================================
// OPTIMIZED INTERVAL FINDING - O(log n) Binary Search with Hint
// ============================================================================

/// Find interval using binary search with last-frame hint for temporal coherence.
/// Returns (keyframe_index, interpolation_factor)
#[inline]
fn find_interval_binary(times: &[f32], time: f32, hint: &mut u32) -> (usize, f32) {
    let n = times.len();
    
    if n == 0 {
        return (0, 0.0);
    }
    if n == 1 {
        return (0, 0.0);
    }
    
    // Fast path: check if hint is still valid (temporal coherence)
    // Animation typically advances frame-by-frame, so hint is often correct
    let hint_idx = (*hint as usize).min(n - 2);
    
    // Check if we're in the hinted interval or the next one
    let t0 = times[hint_idx];
    let t1 = times[hint_idx + 1];
    
    if time >= t0 && time < t1 {
        // Hint was correct!
        let span = t1 - t0;
        let factor = if span > 0.0 { (time - t0) / span } else { 0.0 };
        return (hint_idx, factor);
    }
    
    // Check next interval (common for forward playback)
    if hint_idx + 2 < n {
        let t2 = times[hint_idx + 2];
        if time >= t1 && time < t2 {
            *hint = (hint_idx + 1) as u32;
            let span = t2 - t1;
            let factor = if span > 0.0 { (time - t1) / span } else { 0.0 };
            return (hint_idx + 1, factor);
        }
    }
    
    // Boundary checks
    if time <= times[0] {
        *hint = 0;
        return (0, 0.0);
    }
    if time >= times[n - 1] {
        *hint = (n - 2) as u32;
        return (n - 2, 1.0);
    }
    
    // Binary search fallback
    let idx = binary_search_interval(times, time);
    *hint = idx as u32;
    
    let t0 = times[idx];
    let t1 = times[idx + 1];
    let span = t1 - t0;
    let factor = if span > 0.0 { (time - t0) / span } else { 0.0 };
    
    (idx, factor)
}

/// Binary search to find the interval containing `time`
/// Returns index `i` such that times[i] <= time < times[i+1]
#[inline]
fn binary_search_interval(times: &[f32], time: f32) -> usize {
    let mut lo = 0usize;
    let mut hi = times.len() - 1;
    
    while lo + 1 < hi {
        let mid = lo + (hi - lo) / 2;
        if times[mid] <= time {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    
    lo
}

// ============================================================================
// INTERPOLATION FUNCTIONS
// ============================================================================

#[inline]
fn lerp_vec3(a: Vec3, b: Vec3, t: f32) -> Vec3 {
    a + (b - a) * t
}

#[inline]
fn slerp_quat(a: Quat, b: Quat, t: f32) -> Quat {
    a.slerp(b, t)
}

/// Catmull-Rom spline interpolation for Vec3
#[inline]
fn catmull_rom_vec3(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: f32) -> Vec3 {
    let t2 = t * t;
    let t3 = t2 * t;
    
    0.5 * (2.0 * p1 
        + (-p0 + p2) * t
        + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
        + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3)
}

// ============================================================================
// BATCH SAMPLING
// ============================================================================

/// Sample a single track at given time, updating the hint
#[inline]
fn sample_track(
    track: &Track,
    time: f32,
    hint: &mut u32,
    translations: &mut [Vec3],
    rotations: &mut [Quat],
    scales: &mut [Vec3],
) {
    let n = track.times.len();
    if n == 0 || track.joint_index >= translations.len() {
        return;
    }
    
    let (idx, factor) = find_interval_binary(&track.times, time, hint);
    let joint = track.joint_index;
    
    match track.track_type {
        TrackType::Translation => {
            let result = sample_vec3_track(&track.values, n, idx, factor, track.interpolation);
            translations[joint] = result;
        }
        TrackType::Rotation => {
            let result = sample_quat_track(&track.values, n, idx, factor, track.interpolation);
            rotations[joint] = result;
        }
        TrackType::Scale => {
            let result = sample_vec3_track(&track.values, n, idx, factor, track.interpolation);
            scales[joint] = result;
        }
    }
}

#[inline]
fn sample_vec3_track(values: &[f32], key_count: usize, idx: usize, factor: f32, interp: Interpolation) -> Vec3 {
    let start = idx * 3;
    let v0 = Vec3::new(values[start], values[start + 1], values[start + 2]);
    
    if interp == Interpolation::Step || factor == 0.0 || idx + 1 >= key_count {
        return v0;
    }
    
    let next = (idx + 1) * 3;
    let v1 = Vec3::new(values[next], values[next + 1], values[next + 2]);
    
    match interp {
        Interpolation::Linear | Interpolation::Step => lerp_vec3(v0, v1, factor),
        Interpolation::Cubic => {
            // Catmull-Rom needs 4 control points
            let i0 = idx.saturating_sub(1);
            let i3 = (idx + 2).min(key_count - 1);
            
            let p0_off = i0 * 3;
            let p3_off = i3 * 3;
            
            let p0 = Vec3::new(values[p0_off], values[p0_off + 1], values[p0_off + 2]);
            let p3 = Vec3::new(values[p3_off], values[p3_off + 1], values[p3_off + 2]);
            
            catmull_rom_vec3(p0, v0, v1, p3, factor)
        }
    }
}

#[inline]
fn sample_quat_track(values: &[f32], key_count: usize, idx: usize, factor: f32, interp: Interpolation) -> Quat {
    let start = idx * 4;
    let q0 = Quat::from_xyzw(values[start], values[start + 1], values[start + 2], values[start + 3]);
    
    if interp == Interpolation::Step || factor == 0.0 || idx + 1 >= key_count {
        return q0;
    }
    
    let next = (idx + 1) * 4;
    let q1 = Quat::from_xyzw(values[next], values[next + 1], values[next + 2], values[next + 3]);
    
    // Always use slerp for quaternions (squad for cubic is complex and often overkill)
    slerp_quat(q0, q1, factor)
}

/// Sample entire clip into instance pose using batch processing
fn sample_clip_batch(clip: &AnimationClip, time: f32, instance: &mut Instance) {
    instance.ensure_track_hints(clip.tracks.len());
    
    for (track_idx, track) in clip.tracks.iter().enumerate() {
        let hint = &mut instance.track_hints[track_idx];
        sample_track(
            track,
            time,
            hint,
            &mut instance.local_translations,
            &mut instance.local_rotations,
            &mut instance.local_scales,
        );
    }
}

// ============================================================================
// POSE BLENDING
// ============================================================================

/// Blend two poses with given weight (0.0 = a, 1.0 = b)
#[wasm_bindgen]
pub fn blend_poses(
    out_translations: &mut [f32],
    out_rotations: &mut [f32],
    out_scales: &mut [f32],
    a_translations: &[f32],
    a_rotations: &[f32],
    a_scales: &[f32],
    b_translations: &[f32],
    b_rotations: &[f32],
    b_scales: &[f32],
    weight: f32,
    joint_count: u32,
) {
    let w = weight.clamp(0.0, 1.0);
    let joint_count = joint_count as usize;
    
    for i in 0..joint_count {
        // Translation blend
        let to = i * 3;
        out_translations[to] = a_translations[to] * (1.0 - w) + b_translations[to] * w;
        out_translations[to + 1] = a_translations[to + 1] * (1.0 - w) + b_translations[to + 1] * w;
        out_translations[to + 2] = a_translations[to + 2] * (1.0 - w) + b_translations[to + 2] * w;
        
        // Scale blend
        out_scales[to] = a_scales[to] * (1.0 - w) + b_scales[to] * w;
        out_scales[to + 1] = a_scales[to + 1] * (1.0 - w) + b_scales[to + 1] * w;
        out_scales[to + 2] = a_scales[to + 2] * (1.0 - w) + b_scales[to + 2] * w;
        
        // Rotation slerp
        let ro = i * 4;
        let qa = Quat::from_xyzw(
            a_rotations[ro], a_rotations[ro + 1], 
            a_rotations[ro + 2], a_rotations[ro + 3]
        );
        let qb = Quat::from_xyzw(
            b_rotations[ro], b_rotations[ro + 1], 
            b_rotations[ro + 2], b_rotations[ro + 3]
        );
        let qr = qa.slerp(qb, w);
        out_rotations[ro] = qr.x;
        out_rotations[ro + 1] = qr.y;
        out_rotations[ro + 2] = qr.z;
        out_rotations[ro + 3] = qr.w;
    }
}

// ============================================================================
// DUAL QUATERNION BATCH CONVERSION (Optimized for GPU Skinning)
// ============================================================================

/// Converts a single Mat4 to dual quaternion representation.
/// Returns (real, dual) as two Vec4s.
/// 
/// The matrix is assumed to be a rigid transform (rotation + translation, no scale).
#[inline]
fn mat4_to_dual_quat_internal(mat: &Mat4) -> (Vec4, Vec4) {
    // Extract rotation quaternion using glam's optimized conversion
    let rotation = Quat::from_mat4(mat).normalize();
    
    // Extract translation
    let translation = mat.col(3).truncate(); // Vec3
    let tx = translation.x;
    let ty = translation.y;
    let tz = translation.z;
    
    // Get quaternion components
    let (qx, qy, qz, qw) = (rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Real part: rotation quaternion
    let real = Vec4::new(qx, qy, qz, qw);
    
    // Dual part: d = 0.5 * t * r (where t is pure quaternion [tx, ty, tz, 0])
    // Quaternion multiplication: t * r
    // t = (tx, ty, tz, 0), r = (qx, qy, qz, qw)
    let dual = Vec4::new(
        0.5 * (tx * qw + ty * qz - tz * qy),
        0.5 * (-tx * qz + ty * qw + tz * qx),
        0.5 * (tx * qy - ty * qx + tz * qw),
        0.5 * (-tx * qx - ty * qy - tz * qz),
    );
    
    (real, dual)
}

/// Batch converts mat4x4 joint matrices to dual quaternion format.
/// 
/// Input: `matrices` - N×16 floats (N joint matrices in column-major order)
/// Output: N×8 floats packed as [real0(4), dual0(4), real1(4), dual1(4), ...]
/// 
/// This function is optimized for batch processing of skeletal animation joints.
/// For 50 joints × 20 characters = 1000 conversions/frame, this provides
/// significant speedup over per-joint JavaScript conversion.
#[wasm_bindgen]
pub fn batch_mat4_to_dual_quat(matrices: &[f32], joint_count: u32) -> Vec<f32> {
    let count = joint_count as usize;
    let mut output = Vec::with_capacity(count * 8);
    
    for i in 0..count {
        let offset = i * 16;
        if offset + 16 > matrices.len() {
            // Pad with identity dual quaternion if input is short
            output.extend_from_slice(&[0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0]);
            continue;
        }
        
        // Load matrix from column-major f32 array
        let mat = Mat4::from_cols_array(&matrices[offset..offset + 16].try_into().unwrap());
        
        let (real, dual) = mat4_to_dual_quat_internal(&mat);
        
        // Pack real then dual
        output.push(real.x);
        output.push(real.y);
        output.push(real.z);
        output.push(real.w);
        output.push(dual.x);
        output.push(dual.y);
        output.push(dual.z);
        output.push(dual.w);
    }
    
    output
}

/// In-place batch conversion that writes directly to the output buffer.
/// This avoids allocation when the output buffer is pre-allocated.
/// 
/// Returns the number of dual quaternions written.
#[wasm_bindgen]
pub fn batch_mat4_to_dual_quat_inplace(
    matrices: &[f32],
    joint_count: u32,
    out_dual_quats: &mut [f32],
) -> u32 {
    let count = joint_count as usize;
    let max_output = out_dual_quats.len() / 8;
    let actual_count = count.min(max_output);
    
    for i in 0..actual_count {
        let mat_offset = i * 16;
        let dq_offset = i * 8;
        
        if mat_offset + 16 > matrices.len() {
            // Identity dual quaternion
            out_dual_quats[dq_offset..dq_offset + 8]
                .copy_from_slice(&[0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0]);
            continue;
        }
        
        let mat = Mat4::from_cols_array(&matrices[mat_offset..mat_offset + 16].try_into().unwrap());
        let (real, dual) = mat4_to_dual_quat_internal(&mat);
        
        out_dual_quats[dq_offset] = real.x;
        out_dual_quats[dq_offset + 1] = real.y;
        out_dual_quats[dq_offset + 2] = real.z;
        out_dual_quats[dq_offset + 3] = real.w;
        out_dual_quats[dq_offset + 4] = dual.x;
        out_dual_quats[dq_offset + 5] = dual.y;
        out_dual_quats[dq_offset + 6] = dual.z;
        out_dual_quats[dq_offset + 7] = dual.w;
    }
    
    actual_count as u32
}

/// DualQuaternionConverter - Persistent converter with reusable output buffer.
/// Avoids per-frame allocations for maximum performance.
#[wasm_bindgen]
pub struct DualQuaternionConverter {
    output_buffer: Vec<f32>,
}

#[wasm_bindgen]
impl DualQuaternionConverter {
    #[wasm_bindgen(constructor)]
    pub fn new(max_joints: u32) -> Self {
        Self {
            output_buffer: vec![0.0; max_joints as usize * 8],
        }
    }
    
    /// Converts matrices to dual quaternions, returns count of joints converted.
    /// Access result via get_output_ptr() and get_output_len().
    pub fn convert(&mut self, matrices: &[f32], joint_count: u32) -> u32 {
        // Resize if needed
        let required_size = joint_count as usize * 8;
        if self.output_buffer.len() < required_size {
            self.output_buffer.resize(required_size, 0.0);
        }
        
        batch_mat4_to_dual_quat_inplace(matrices, joint_count, &mut self.output_buffer)
    }
    
    /// Pointer to output buffer in WASM linear memory.
    pub fn get_output_ptr(&self) -> *const f32 {
        self.output_buffer.as_ptr()
    }
    
    /// Length of valid output in floats (joint_count * 8).
    pub fn get_output_len(&self) -> usize {
        self.output_buffer.len()
    }
    
    /// Get output as a copy (for debugging/testing).
    pub fn get_output_copy(&self) -> Vec<f32> {
        self.output_buffer.clone()
    }
}

// ============================================================================
// STANDALONE BATCH SAMPLING (NEW API)
// ============================================================================

/// Batch sample a pose from clip data - single WASM call for entire pose
/// This is the optimized entry point for TypeScript
#[wasm_bindgen]
pub fn batch_sample_pose(
    // Track metadata (flattened)
    track_joint_indices: &[u32],
    track_types: &[u8],        // 0=T, 1=R, 2=S
    track_interpolations: &[u8], // 0=Step, 1=Linear, 2=Cubic
    // Track keyframe counts
    track_key_counts: &[u32],
    // All times concatenated
    all_times: &[f32],
    // All values concatenated  
    all_values: &[f32],
    // Sample time
    time: f32,
    // Hint state (in/out) - caller maintains this across frames
    hints: &mut [u32],
    // Output pose
    out_translations: &mut [f32],
    out_rotations: &mut [f32],
    out_scales: &mut [f32],
) {
    let track_count = track_joint_indices.len();
    
    let mut times_offset = 0usize;
    let mut values_offset = 0usize;
    
    for i in 0..track_count {
        let joint_idx = track_joint_indices[i] as usize;
        let key_count = track_key_counts[i] as usize;
        let track_type = track_types[i];
        let interp = track_interpolations[i];
        
        if key_count == 0 {
            continue;
        }
        
        let times = &all_times[times_offset..times_offset + key_count];
        let hint = &mut hints[i];
        
        let (idx, factor) = find_interval_binary(times, time, hint);
        
        let interp_enum = match interp {
            0 => Interpolation::Step,
            1 => Interpolation::Linear,
            _ => Interpolation::Cubic,
        };
        
        match track_type {
            0 => { // Translation
                let stride = 3;
                let values = &all_values[values_offset..values_offset + key_count * stride];
                let result = sample_vec3_track(values, key_count, idx, factor, interp_enum);
                let out_off = joint_idx * 3;
                out_translations[out_off] = result.x;
                out_translations[out_off + 1] = result.y;
                out_translations[out_off + 2] = result.z;
                values_offset += key_count * stride;
            }
            1 => { // Rotation
                let stride = 4;
                let values = &all_values[values_offset..values_offset + key_count * stride];
                let result = sample_quat_track(values, key_count, idx, factor, interp_enum);
                let out_off = joint_idx * 4;
                out_rotations[out_off] = result.x;
                out_rotations[out_off + 1] = result.y;
                out_rotations[out_off + 2] = result.z;
                out_rotations[out_off + 3] = result.w;
                values_offset += key_count * stride;
            }
            _ => { // Scale
                let stride = 3;
                let values = &all_values[values_offset..values_offset + key_count * stride];
                let result = sample_vec3_track(values, key_count, idx, factor, interp_enum);
                let out_off = joint_idx * 3;
                out_scales[out_off] = result.x;
                out_scales[out_off + 1] = result.y;
                out_scales[out_off + 2] = result.z;
                values_offset += key_count * stride;
            }
        }
        
        times_offset += key_count;
    }
}

// ============================================================================
// ANIMATION WORLD (Managed Instance System)
// ============================================================================

#[wasm_bindgen]
pub struct AnimationWorld {
    skeletons: HashMap<u32, Skeleton>,
    clips: HashMap<u32, AnimationClip>,
    instances: HashMap<u32, Instance>,
    output_buffer: Vec<f32>,
}

#[wasm_bindgen]
impl AnimationWorld {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            skeletons: HashMap::new(),
            clips: HashMap::new(),
            instances: HashMap::new(),
            output_buffer: Vec::new(),
        }
    }

    pub fn add_skeleton(&mut self, id: u32, parents: &[i32], ibm_src: &[f32]) {
        let bone_count = parents.len();
        let mut ibm = Vec::with_capacity(bone_count);
        
        for i in 0..bone_count {
            let start = i * 16;
            let end = start + 16;
            if end <= ibm_src.len() {
                let m = Mat4::from_cols_array(&ibm_src[start..end].try_into().unwrap());
                ibm.push(m);
            } else {
                ibm.push(Mat4::IDENTITY);
            }
        }

        self.skeletons.insert(id, Skeleton {
            parents: parents.to_vec(),
            inverse_bind_matrices: ibm,
        });
    }

    pub fn add_clip(
        &mut self,
        id: u32,
        duration: f32,
        joint_indices: &[u32],
        track_types: &[u8],
        interpolations: &[u8],
        times_all: &[f32],
        values_all: &[f32],
        times_counts: &[u32],
    ) {
        let track_count = joint_indices.len();
        let mut tracks = Vec::with_capacity(track_count);
        
        let mut times_offset = 0;
        let mut values_offset = 0;
        
        for i in 0..track_count {
            let count = times_counts[i] as usize;
            let kind = match track_types[i] {
                0 => TrackType::Translation,
                1 => TrackType::Rotation,
                _ => TrackType::Scale,
            };
            let interp = match interpolations[i] {
                0 => Interpolation::Step,
                1 => Interpolation::Linear,
                _ => Interpolation::Cubic,
            };
            
            let stride = if kind == TrackType::Rotation { 4 } else { 3 };
            
            let times = times_all[times_offset..times_offset + count].to_vec();
            let values = values_all[values_offset..values_offset + count * stride].to_vec();
            
            tracks.push(Track {
                joint_index: joint_indices[i] as usize,
                track_type: kind,
                times,
                values,
                interpolation: interp,
                last_key_hint: 0,
            });
            
            times_offset += count;
            values_offset += count * stride;
        }
        
        self.clips.insert(id, AnimationClip { id, duration, tracks });
    }

    pub fn create_instance(&mut self, instance_id: u32, skeleton_id: u32) -> bool {
        if let Some(skeleton) = self.skeletons.get(&skeleton_id) {
            let joint_count = skeleton.parents.len();
            self.instances.insert(instance_id, Instance::new(skeleton_id, joint_count));
            return true;
        }
        false
    }

    pub fn remove_instance(&mut self, instance_id: u32) {
        self.instances.remove(&instance_id);
    }

    pub fn set_instance_state(&mut self, instance_id: u32, clip_id: u32, time: f32) {
        if let Some(instance) = self.instances.get_mut(&instance_id) {
            instance.current_clip = Some(clip_id);
            instance.current_time = time;
        }
    }

    pub fn set_instance_bone(
        &mut self,
        instance_id: u32,
        bone_index: usize,
        tx: f32, ty: f32, tz: f32,
        rx: f32, ry: f32, rz: f32, rw: f32,
        sx: f32, sy: f32, sz: f32,
    ) {
        if let Some(instance) = self.instances.get_mut(&instance_id) {
            if bone_index < instance.local_translations.len() {
                instance.local_translations[bone_index] = Vec3::new(tx, ty, tz);
                instance.local_rotations[bone_index] = Quat::from_xyzw(rx, ry, rz, rw);
                instance.local_scales[bone_index] = Vec3::new(sx, sy, sz);
            }
        }
    }

    /// Main update loop - samples all animations and computes skinning matrices
    pub fn step(&mut self, _dt: f32) {
        // Collect instance IDs to process (avoid borrow issues)
        let instance_ids: Vec<u32> = self.instances.keys().cloned().collect();
        
        for instance_id in instance_ids {
            let (skeleton_id, clip_id, current_time, active) = {
                let instance = self.instances.get(&instance_id).unwrap();
                (instance.skeleton_id, instance.current_clip, instance.current_time, instance.active)
            };
            
            if !active {
                continue;
            }

            // 1. Sample Animation using optimized batch sampling
            if let Some(clip_id) = clip_id {
                if let Some(clip) = self.clips.get(&clip_id).cloned() {
                    let instance = self.instances.get_mut(&instance_id).unwrap();
                    sample_clip_batch(&clip, current_time, instance);
                }
            }
            
            // 2. Compute Global Matrices
            let skeleton = match self.skeletons.get(&skeleton_id) {
                Some(s) => s.clone(),
                None => continue,
            };
            
            let instance = self.instances.get_mut(&instance_id).unwrap();
            let count = skeleton.parents.len();
            
            for i in 0..count {
                let parent_idx = skeleton.parents[i];
                
                let local_mat = Mat4::from_scale_rotation_translation(
                    instance.local_scales[i],
                    instance.local_rotations[i],
                    instance.local_translations[i],
                );
                
                let global_mat = if parent_idx >= 0 && (parent_idx as usize) < i {
                    instance.global_bone_matrices[parent_idx as usize] * local_mat
                } else {
                    local_mat
                };
                
                instance.global_bone_matrices[i] = global_mat;
                instance.skinning_matrices[i] = global_mat * skeleton.inverse_bind_matrices[i];
            }
        }

        // Rebuild output buffer
        self.output_buffer.clear();
        let mut keys: Vec<_> = self.instances.keys().cloned().collect();
        keys.sort();
        
        for key in keys {
            if let Some(instance) = self.instances.get(&key) {
                if !instance.active { continue; }
                for mat in &instance.skinning_matrices {
                    self.output_buffer.extend_from_slice(&mat.to_cols_array());
                }
            }
        }
    }

    pub fn get_output_buffer(&mut self) -> Vec<f32> {
        self.output_buffer.clone()
    }

    pub fn get_output_buffer_ptr(&self) -> *const f32 {
        self.output_buffer.as_ptr()
    }

    pub fn get_output_buffer_len(&self) -> usize {
        self.output_buffer.len()
    }

    pub fn get_instance_local_translations_ptr(&self, instance_id: u32) -> *const f32 {
        self.instances
            .get(&instance_id)
            .map(|i| i.local_translations.as_ptr() as *const f32)
            .unwrap_or(std::ptr::null())
    }

    pub fn get_instance_local_rotations_ptr(&self, instance_id: u32) -> *const f32 {
        self.instances
            .get(&instance_id)
            .map(|i| i.local_rotations.as_ptr() as *const f32)
            .unwrap_or(std::ptr::null())
    }

    pub fn get_instance_local_scales_ptr(&self, instance_id: u32) -> *const f32 {
        self.instances
            .get(&instance_id)
            .map(|i| i.local_scales.as_ptr() as *const f32)
            .unwrap_or(std::ptr::null())
    }

    pub fn get_instance_joint_count(&self, instance_id: u32) -> u32 {
        self.instances
            .get(&instance_id)
            .map(|i| i.local_translations.len() as u32)
            .unwrap_or(0)
    }
}

impl Default for AnimationWorld {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_binary_search_interval() {
        let times = [0.0, 0.5, 1.0, 1.5, 2.0];
        
        assert_eq!(binary_search_interval(&times, 0.0), 0);
        assert_eq!(binary_search_interval(&times, 0.25), 0);
        assert_eq!(binary_search_interval(&times, 0.5), 1);
        assert_eq!(binary_search_interval(&times, 0.75), 1);
        assert_eq!(binary_search_interval(&times, 1.0), 2);
        assert_eq!(binary_search_interval(&times, 1.9), 3);
    }

    #[test]
    fn test_find_interval_with_hint() {
        let times = [0.0, 0.5, 1.0, 1.5, 2.0];
        let mut hint = 0u32;
        
        // First query
        let (idx, factor) = find_interval_binary(&times, 0.25, &mut hint);
        assert_eq!(idx, 0);
        assert!((factor - 0.5).abs() < 0.001);
        assert_eq!(hint, 0);
        
        // Sequential advance (should use hint)
        let (idx, factor) = find_interval_binary(&times, 0.75, &mut hint);
        assert_eq!(idx, 1);
        assert!((factor - 0.5).abs() < 0.001);
        
        // Continue advancing
        let (idx, _) = find_interval_binary(&times, 1.25, &mut hint);
        assert_eq!(idx, 2);
    }

    #[test]
    fn test_lerp_vec3() {
        let a = Vec3::new(0.0, 0.0, 0.0);
        let b = Vec3::new(10.0, 10.0, 10.0);
        
        let result = lerp_vec3(a, b, 0.5);
        assert!((result.x - 5.0).abs() < 0.001);
        assert!((result.y - 5.0).abs() < 0.001);
        assert!((result.z - 5.0).abs() < 0.001);
    }

    #[test]
    fn test_mat4_to_dual_quat_identity() {
        let identity = Mat4::IDENTITY;
        let (real, dual) = mat4_to_dual_quat_internal(&identity);
        
        // Identity rotation: (0, 0, 0, 1)
        assert!(real.x.abs() < 0.001);
        assert!(real.y.abs() < 0.001);
        assert!(real.z.abs() < 0.001);
        assert!((real.w - 1.0).abs() < 0.001);
        
        // No translation: dual part should be zero
        assert!(dual.x.abs() < 0.001);
        assert!(dual.y.abs() < 0.001);
        assert!(dual.z.abs() < 0.001);
        assert!(dual.w.abs() < 0.001);
    }

    #[test]
    fn test_mat4_to_dual_quat_translation() {
        let mat = Mat4::from_translation(Vec3::new(5.0, 3.0, 2.0));
        let (real, dual) = mat4_to_dual_quat_internal(&mat);
        
        // Identity rotation
        assert!((real.w - 1.0).abs() < 0.001);
        
        // Dual part encodes translation: d = 0.5 * t * r
        // For identity rotation, d = 0.5 * (tx, ty, tz, 0)
        assert!((dual.x - 2.5).abs() < 0.001); // 0.5 * 5
        assert!((dual.y - 1.5).abs() < 0.001); // 0.5 * 3
        assert!((dual.z - 1.0).abs() < 0.001); // 0.5 * 2
    }

    #[test]
    fn test_batch_mat4_to_dual_quat() {
        // 2 identity matrices
        let matrices: Vec<f32> = vec![
            // Identity matrix 1
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0,
            // Translation matrix 2 (translate by 10, 0, 0)
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            10.0, 0.0, 0.0, 1.0,
        ];
        
        let result = batch_mat4_to_dual_quat(&matrices, 2);
        
        assert_eq!(result.len(), 16); // 2 joints * 8 floats
        
        // Joint 0: identity
        assert!((result[3] - 1.0).abs() < 0.001); // real.w
        assert!(result[4].abs() < 0.001); // dual.x = 0
        
        // Joint 1: translation (10, 0, 0)
        assert!((result[11] - 1.0).abs() < 0.001); // real.w
        assert!((result[12] - 5.0).abs() < 0.001); // dual.x = 0.5 * 10
    }

    #[test]
    fn test_dual_quaternion_converter() {
        let matrices: Vec<f32> = vec![
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            2.0, 4.0, 6.0, 1.0,
        ];
        
        let mut converter = DualQuaternionConverter::new(10);
        let count = converter.convert(&matrices, 1);
        
        assert_eq!(count, 1);
        
        let output = converter.get_output_copy();
        // Translation (2, 4, 6) -> dual = (1, 2, 3, 0)
        assert!((output[4] - 1.0).abs() < 0.001);
        assert!((output[5] - 2.0).abs() < 0.001);
        assert!((output[6] - 3.0).abs() < 0.001);
    }
}
