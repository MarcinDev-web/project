// Particle Structures - SoA (Structure of Arrays) Layout
// Optimized for GPU memory coalescing: when threads in a warp access
// the same attribute for different particles, they hit contiguous memory.

// ============================================================================
// SoA Particle Data Bindings
// Instead of array<Particle>, we use separate arrays per attribute.
// This provides ~2-3x better memory bandwidth on modern GPUs.
// ============================================================================

// Usage in shaders:
// @group(X) @binding(0) var<storage, read_write> positions: array<vec4<f32>>;     // xyz=pos, w=padding
// @group(X) @binding(1) var<storage, read_write> velocities: array<vec4<f32>>;    // xyz=vel, w=life
// @group(X) @binding(2) var<storage, read_write> colors: array<vec4<f32>>;        // rgba
// @group(X) @binding(3) var<storage, read_write> sizeRotation: array<vec4<f32>>; // x=size, y=rotation, z=angularVel, w=flags

// Note: We pack related data into vec4 to maximize throughput:
// - positions: xyz + padding (could store extra data)
// - velocities: xyz + life (packed for natural update grouping)
// - colors: rgba (natural fit)
// - sizeRotation: size + rotation + angularVelocity + flags (misc data packed)

// ============================================================================
// Helper accessors for SoA data
// ============================================================================

fn getPosition(positions: ptr<storage, array<vec4<f32>>, read_write>, index: u32) -> vec3<f32> {
    return (*positions)[index].xyz;
}

fn setPosition(positions: ptr<storage, array<vec4<f32>>, read_write>, index: u32, pos: vec3<f32>) {
    (*positions)[index] = vec4<f32>(pos, (*positions)[index].w);
}

fn getVelocity(velocities: ptr<storage, array<vec4<f32>>, read_write>, index: u32) -> vec3<f32> {
    return (*velocities)[index].xyz;
}

fn setVelocity(velocities: ptr<storage, array<vec4<f32>>, read_write>, index: u32, vel: vec3<f32>) {
    (*velocities)[index] = vec4<f32>(vel, (*velocities)[index].w);
}

fn getLife(velocities: ptr<storage, array<vec4<f32>>, read_write>, index: u32) -> f32 {
    return (*velocities)[index].w;
}

fn setLife(velocities: ptr<storage, array<vec4<f32>>, read_write>, index: u32, life: f32) {
    let v = (*velocities)[index];
    (*velocities)[index] = vec4<f32>(v.xyz, life);
}

fn getColor(colors: ptr<storage, array<vec4<f32>>, read_write>, index: u32) -> vec4<f32> {
    return (*colors)[index];
}

fn setColor(colors: ptr<storage, array<vec4<f32>>, read_write>, index: u32, color: vec4<f32>) {
    (*colors)[index] = color;
}

fn getSize(sizeRotation: ptr<storage, array<vec4<f32>>, read_write>, index: u32) -> f32 {
    return (*sizeRotation)[index].x;
}

fn getRotation(sizeRotation: ptr<storage, array<vec4<f32>>, read_write>, index: u32) -> f32 {
    return (*sizeRotation)[index].y;
}

fn getAngularVelocity(sizeRotation: ptr<storage, array<vec4<f32>>, read_write>, index: u32) -> f32 {
    return (*sizeRotation)[index].z;
}

fn setSizeRotation(
    sizeRotation: ptr<storage, array<vec4<f32>>, read_write>, 
    index: u32, 
    size: f32, 
    rotation: f32, 
    angularVel: f32,
    flags: f32
) {
    (*sizeRotation)[index] = vec4<f32>(size, rotation, angularVel, flags);
}

// ============================================================================
// Constants for particle flags (stored in sizeRotation.w)
// ============================================================================

const PARTICLE_FLAG_NONE: u32 = 0u;
const PARTICLE_FLAG_ADDITIVE: u32 = 1u;
const PARTICLE_FLAG_SOFT: u32 = 2u;
const PARTICLE_FLAG_STRETCHED: u32 = 4u;

// ============================================================================
// System Parameters (unchanged)
// ============================================================================

struct ParticleSystemParams {
    deltaTime: f32,
    time: f32,
    maxParticles: u32,
    emitterPosition: vec3<f32>,
    emitterRange: vec3<f32>,
    gravity: vec3<f32>,
    drag: f32,
    emissionRate: f32,
    seed: f32,
};

