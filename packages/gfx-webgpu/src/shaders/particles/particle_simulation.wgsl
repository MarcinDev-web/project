// Particle Simulation Compute Shader - SoA Layout
// Optimized for memory coalescing: adjacent threads access contiguous memory

// ============================================================================
// Simulation Parameters
// ============================================================================

struct SimulationParams {
    deltaTime: f32,
    time: f32,
    seed: f32,
    emitCount: u32,
    maxParticles: u32,
    _pad0: u32,
    _pad1: u32,
    _pad2: u32,
};

struct Emitter {
    position: vec3<f32>,
    _pad0: f32,
    range: vec3<f32>,
    _pad1: f32,
    velocityMin: vec3<f32>,
    _pad2: f32,
    velocityMax: vec3<f32>,
    _pad3: f32,
    colorStart: vec4<f32>,
    colorEnd: vec4<f32>,
    sizeMin: f32,
    sizeMax: f32,
    lifeMin: f32,
    lifeMax: f32,
    gravity: vec3<f32>,
    drag: f32,
};

// ============================================================================
// SoA Particle Data Bindings
// Each binding is a contiguous array of one attribute type
// This maximizes GPU cache efficiency when all threads access same attribute
// ============================================================================

@group(0) @binding(0) var<uniform> params : SimulationParams;
@group(0) @binding(1) var<uniform> emitter : Emitter;

// SoA buffers - each thread in a warp accesses adjacent memory locations
@group(0) @binding(2) var<storage, read_write> positions : array<vec4<f32>>;      // xyz=position, w=unused
@group(0) @binding(3) var<storage, read_write> velocities : array<vec4<f32>>;     // xyz=velocity, w=life
@group(0) @binding(4) var<storage, read_write> colors : array<vec4<f32>>;         // rgba color
@group(0) @binding(5) var<storage, read_write> sizeRotation : array<vec4<f32>>;   // x=size, y=rotation, z=angularVel, w=flags

// Dead particle stack
@group(0) @binding(6) var<storage, read_write> deadList : array<u32>;
@group(0) @binding(7) var<storage, read_write> counter : atomic<u32>;

// ============================================================================
// Pseudo-random number generation
// ============================================================================

fn rand(seed: f32) -> f32 {
    return fract(sin(seed * 12.9898) * 43758.5453);
}

fn rand3(seed: vec3<f32>) -> f32 {
    return fract(sin(dot(seed, vec3<f32>(12.9898, 78.233, 45.5432))) * 43758.5453);
}

// PCG hash for better distribution
fn pcg(v: u32) -> u32 {
    var state = v * 747796405u + 2891336453u;
    let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

fn pcgFloat(seed: u32) -> f32 {
    return f32(pcg(seed)) / 4294967295.0;
}

// ============================================================================
// Main Simulation Kernel
// Optimized memory access: all threads read/write same attribute in sequence
// ============================================================================

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    let index = GlobalInvocationID.x;
    if (index >= params.maxParticles) {
        return;
    }

    // Read life first - most common early-out condition
    // All 64 threads read adjacent f32 values (velocities[idx].w)
    let velocityData = velocities[index];
    var life = velocityData.w;

    if (life <= 0.0) {
        return; // Dead particle, skip entirely
    }

    // Decrement life
    life -= params.deltaTime;

    if (life <= 0.0) {
        // Particle just died - mark as dead and add to dead list
        velocities[index] = vec4<f32>(velocityData.xyz, -1.0);
        let deadIndex = atomicAdd(&counter, 1u);
        deadList[deadIndex] = index;
        return;
    }

    // ========================================
    // Physics update - coalesced reads
    // ========================================
    
    // Read position (all threads read adjacent vec4s)
    var pos = positions[index].xyz;
    
    // Velocity already read above, extract xyz
    var vel = velocityData.xyz;
    
    // Apply gravity and drag
    vel += emitter.gravity * params.deltaTime;
    vel *= (1.0 - emitter.drag * params.deltaTime);
    
    // Integrate position
    pos += vel * params.deltaTime;

    // ========================================
    // Rotation update
    // ========================================
    
    let sizeRotData = sizeRotation[index];
    let size = sizeRotData.x;
    var rotation = sizeRotData.y;
    let angularVel = sizeRotData.z;
    let flags = sizeRotData.w;
    
    rotation += angularVel * params.deltaTime;

    // ========================================
    // Color fade based on life
    // ========================================
    
    var color = colors[index];
    color.a = saturate(life / emitter.lifeMax); // Fade alpha over lifetime

    // ========================================
    // Coalesced writes - all threads write same attribute type
    // ========================================
    
    positions[index] = vec4<f32>(pos, 0.0);
    velocities[index] = vec4<f32>(vel, life);
    colors[index] = color;
    sizeRotation[index] = vec4<f32>(size, rotation, angularVel, flags);
}

// ============================================================================
// Emission Kernel - Spawns new particles from dead list
// ============================================================================

@compute @workgroup_size(64)
fn emit(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    let emitIndex = GlobalInvocationID.x;
    if (emitIndex >= params.emitCount) {
        return;
    }

    // Atomic pop from dead list
    let deadCount = atomicLoad(&counter);
    if (deadCount == 0u) {
        return;
    }

    // Try to claim a dead particle slot
    let claimed = atomicSub(&counter, 1u);
    if (claimed == 0u) {
        // Race condition - restore and exit
        atomicAdd(&counter, 1u);
        return;
    }

    let particleIndex = deadList[claimed - 1u];

    // ========================================
    // Initialize new particle with random values
    // ========================================
    
    // Generate seeds for randomization
    let baseSeed = pcg(emitIndex + u32(params.time * 1000.0) + u32(params.seed * 12345.0));
    
    let r1 = pcgFloat(baseSeed);
    let r2 = pcgFloat(baseSeed + 1u);
    let r3 = pcgFloat(baseSeed + 2u);
    let r4 = pcgFloat(baseSeed + 3u);
    let r5 = pcgFloat(baseSeed + 4u);
    let r6 = pcgFloat(baseSeed + 5u);
    let r7 = pcgFloat(baseSeed + 6u);
    let r8 = pcgFloat(baseSeed + 7u);
    let r9 = pcgFloat(baseSeed + 8u);
    let r10 = pcgFloat(baseSeed + 9u);

    // Random position within emitter range
    let offset = (vec3<f32>(r1, r2, r3) - 0.5) * 2.0 * emitter.range;
    let pos = emitter.position + offset;

    // Random velocity
    let vel = mix(emitter.velocityMin, emitter.velocityMax, vec3<f32>(r4, r5, r6));

    // Random lifetime
    let life = mix(emitter.lifeMin, emitter.lifeMax, r7);

    // Random size
    let size = mix(emitter.sizeMin, emitter.sizeMax, r8);

    // Initial color (start color)
    let color = emitter.colorStart;

    // Random rotation and angular velocity
    let rotation = r9 * 6.28318530718; // 0 to 2π
    let angularVel = (r10 - 0.5) * 4.0; // -2 to +2 radians/sec

    // ========================================
    // Write all attributes (coalesced within workgroup)
    // ========================================
    
    positions[particleIndex] = vec4<f32>(pos, 0.0);
    velocities[particleIndex] = vec4<f32>(vel, life);
    colors[particleIndex] = color;
    sizeRotation[particleIndex] = vec4<f32>(size, rotation, angularVel, 0.0);
}

// ============================================================================
// Reset Kernel - Initialize all particles as dead
// ============================================================================

@compute @workgroup_size(64)
fn reset(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    let index = GlobalInvocationID.x;
    if (index >= params.maxParticles) {
        return;
    }

    // Mark as dead (negative life)
    velocities[index] = vec4<f32>(0.0, 0.0, 0.0, -1.0);
    positions[index] = vec4<f32>(0.0);
    colors[index] = vec4<f32>(0.0);
    sizeRotation[index] = vec4<f32>(0.0);

    // Add to dead list
    deadList[index] = index;
}

// ============================================================================
// Initialize dead list counter
// ============================================================================

@compute @workgroup_size(1)
fn initCounter() {
    atomicStore(&counter, params.maxParticles);
}

