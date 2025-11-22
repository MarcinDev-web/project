use wasm_bindgen::prelude::*;
use glam::{Vec3, Quat, Mat4};
use std::collections::HashMap;

#[cfg(feature = "panic-hook")]
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

// Internal structures

#[derive(Clone, Copy, PartialEq)]
pub enum Interpolation {
    Step = 0,
    Linear = 1,
    Cubic = 2,
}

#[derive(Clone, Copy, PartialEq)]
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
    pub values: Vec<f32>, // Stride depends on type: 3 for T/S, 4 for R
    pub interpolation: Interpolation,
}

#[derive(Clone)]
pub struct AnimationClip {
    pub id: u32,
    pub duration: f32,
    pub tracks: Vec<Track>,
}

#[derive(Clone)]
pub struct Skeleton {
    pub parents: Vec<i32>, // Parent index for each bone, -1 if root
    pub inverse_bind_matrices: Vec<Mat4>,
}

#[derive(Clone)]
pub struct Instance {
    pub skeleton_id: u32,
    // Local transform relative to parent bone
    pub local_translations: Vec<Vec3>,
    pub local_rotations: Vec<Quat>,
    pub local_scales: Vec<Vec3>,
    // Final skinning matrices (GlobalBone * InverseBind)
    pub skinning_matrices: Vec<Mat4>,
    // Internal global matrices (GlobalBone)
    pub global_bone_matrices: Vec<Mat4>,
    pub active: bool,
    
    // Animation State
    pub current_clip: Option<u32>,
    pub current_time: f32,
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
        }
    }
}

#[wasm_bindgen]
pub struct AnimationWorld {
    skeletons: HashMap<u32, Skeleton>,
    clips: HashMap<u32, AnimationClip>,
    instances: HashMap<u32, Instance>,
    // Unified buffer for all skinning matrices
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

    pub fn add_skeleton(
        &mut self, 
        id: u32, 
        parents: &[i32], 
        ibm_src: &[f32]
    ) {
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

        let skeleton = Skeleton {
            parents: parents.to_vec(),
            inverse_bind_matrices: ibm,
        };
        
        self.skeletons.insert(id, skeleton);
    }

    pub fn add_clip(
        &mut self,
        id: u32,
        duration: f32,
        // Track data
        joint_indices: &[u32],
        track_types: &[u8], // 0=T, 1=R, 2=S
        interpolations: &[u8], // 0=Step, 1=Lin, 2=Cub
        times_all: &[f32],
        values_all: &[f32],
        times_counts: &[u32]
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
            });
            
            times_offset += count;
            values_offset += count * stride;
        }
        
        self.clips.insert(id, AnimationClip {
            id,
            duration,
            tracks,
        });
    }

    pub fn create_instance(&mut self, instance_id: u32, skeleton_id: u32) -> bool {
        if let Some(skeleton) = self.skeletons.get(&skeleton_id) {
            let joint_count = skeleton.parents.len();
            let instance = Instance::new(skeleton_id, joint_count);
            self.instances.insert(instance_id, instance);
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
    
    // Optional: Manual control override
    pub fn set_instance_bone(
        &mut self,
        instance_id: u32,
        bone_index: usize,
        tx: f32, ty: f32, tz: f32,
        rx: f32, ry: f32, rz: f32, rw: f32,
        sx: f32, sy: f32, sz: f32
    ) {
        if let Some(instance) = self.instances.get_mut(&instance_id) {
            if bone_index < instance.local_translations.len() {
                instance.local_translations[bone_index] = Vec3::new(tx, ty, tz);
                instance.local_rotations[bone_index] = Quat::from_xyzw(rx, ry, rz, rw);
                instance.local_scales[bone_index] = Vec3::new(sx, sy, sz);
            }
        }
    }
    
    pub fn step(&mut self, _dt: f32) {
        for instance in self.instances.values_mut() {
            if !instance.active { continue; }

            // 1. Sample Animation
            if let Some(clip_id) = instance.current_clip {
                if let Some(clip) = self.clips.get(&clip_id) {
                    sample_clip(clip, instance.current_time, instance);
                }
            }
            
            // 2. Compute Global Matrices
            let skeleton = match self.skeletons.get(&instance.skeleton_id) {
                Some(s) => s,
                None => continue,
            };
            
            let count = skeleton.parents.len();
            
            for i in 0..count {
                let parent_idx = skeleton.parents[i];
                
                let local_mat = Mat4::from_scale_rotation_translation(
                    instance.local_scales[i],
                    instance.local_rotations[i],
                    instance.local_translations[i]
                );
                
                let global_mat = if parent_idx >= 0 && (parent_idx as usize) < i {
                    instance.global_bone_matrices[parent_idx as usize] * local_mat
                } else {
                    local_mat
                };
                
                instance.global_bone_matrices[i] = global_mat;
                
                // Compute skinning matrix
                instance.skinning_matrices[i] = global_mat * skeleton.inverse_bind_matrices[i];
            }
        }

        // Rebuild output buffer
        // This is where we optimize for shared memory.
        // We keep the buffer consistent (sorted by ID) so the view remains valid logic-wise
        // (though indices might shift if instances are added/removed).
        // Ideally we'd use fixed slots, but for now:
        
        self.output_buffer.clear();
        let mut keys: Vec<_> = self.instances.keys().cloned().collect();
        keys.sort(); // Deterministic order
        
        for key in keys {
            if let Some(instance) = self.instances.get(&key) {
                if !instance.active { continue; }
                for mat in &instance.skinning_matrices {
                    self.output_buffer.extend_from_slice(&mat.to_cols_array());
                }
            }
        }
    }
    
    // Returns the memory view of the output buffer (copy)
    pub fn get_output_buffer(&mut self) -> Vec<f32> {
        self.output_buffer.clone()
    }
    
    // Pointer to the output buffer in WASM memory
    pub fn get_output_buffer_ptr(&self) -> *const f32 {
        self.output_buffer.as_ptr()
    }
    
    // Length (in floats) of the output buffer
    pub fn get_output_buffer_len(&self) -> usize {
        self.output_buffer.len()
    }

    // --- NEW ACCESSORS ---

    // Returns pointer to local translations for instance
    pub fn get_instance_local_translations_ptr(&self, instance_id: u32) -> *const f32 {
        if let Some(instance) = self.instances.get(&instance_id) {
            // Vec<Vec3> layout is contiguous f32 (x,y,z)
            instance.local_translations.as_ptr() as *const f32
        } else {
            std::ptr::null()
        }
    }

    pub fn get_instance_local_rotations_ptr(&self, instance_id: u32) -> *const f32 {
        if let Some(instance) = self.instances.get(&instance_id) {
            // Vec<Quat> layout is contiguous f32 (x,y,z,w)
            instance.local_rotations.as_ptr() as *const f32
        } else {
            std::ptr::null()
        }
    }

    pub fn get_instance_local_scales_ptr(&self, instance_id: u32) -> *const f32 {
        if let Some(instance) = self.instances.get(&instance_id) {
            // Vec<Vec3> layout is contiguous f32 (x,y,z)
            instance.local_scales.as_ptr() as *const f32
        } else {
            std::ptr::null()
        }
    }
    
    // Returns joint count for validation
    pub fn get_instance_joint_count(&self, instance_id: u32) -> u32 {
        if let Some(instance) = self.instances.get(&instance_id) {
            instance.local_translations.len() as u32
        } else {
            0
        }
    }
}

fn sample_clip(clip: &AnimationClip, time: f32, instance: &mut Instance) {
    for track in &clip.tracks {
        if track.joint_index >= instance.local_translations.len() { continue; }
        
        // Find frame
        let count = track.times.len();
        if count == 0 { continue; }
        
        if count == 1 || time <= track.times[0] {
            // Clamp start
            apply_track_value(track, &track.values, 0, instance);
            continue;
        }
        
        if time >= track.times[count - 1] {
            // Clamp end
            let stride = if track.track_type == TrackType::Rotation { 4 } else { 3 };
            apply_track_value(track, &track.values, (count - 1) * stride, instance);
            continue;
        }
        
        // Interpolate
        let mut idx = 0;
        for i in 0..count-1 {
            if time < track.times[i+1] {
                idx = i;
                break;
            }
        }
        
        let t0 = track.times[idx];
        let t1 = track.times[idx+1];
        let factor = (time - t0) / (t1 - t0);
        
        match track.track_type {
            TrackType::Translation => {
                let start = idx * 3;
                let v0 = Vec3::from_slice(&track.values[start..start+3]);
                let v1 = Vec3::from_slice(&track.values[start+3..start+6]);
                let res = v0.lerp(v1, factor);
                instance.local_translations[track.joint_index] = res;
            },
            TrackType::Rotation => {
                let start = idx * 4;
                let q0 = Quat::from_slice(&track.values[start..start+4]);
                let q1 = Quat::from_slice(&track.values[start+4..start+8]);
                let res = q0.slerp(q1, factor);
                instance.local_rotations[track.joint_index] = res;
            },
            TrackType::Scale => {
                let start = idx * 3;
                let v0 = Vec3::from_slice(&track.values[start..start+3]);
                let v1 = Vec3::from_slice(&track.values[start+3..start+6]);
                let res = v0.lerp(v1, factor);
                instance.local_scales[track.joint_index] = res;
            },
        }
    }
}

fn apply_track_value(track: &Track, values: &[f32], offset: usize, instance: &mut Instance) {
    match track.track_type {
        TrackType::Translation => {
            instance.local_translations[track.joint_index] = Vec3::from_slice(&values[offset..offset+3]);
        },
        TrackType::Rotation => {
            instance.local_rotations[track.joint_index] = Quat::from_slice(&values[offset..offset+4]);
        },
        TrackType::Scale => {
            instance.local_scales[track.joint_index] = Vec3::from_slice(&values[offset..offset+3]);
        },
    }
}
