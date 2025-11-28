/**
 * Particle Simulation with SDF Collision - Extended Version
 * 
 * Integrates SDF-based collision detection with the particle simulation.
 * Use this shader when collision detection is needed.
 */

// ============================================================================
// Simulation Parameters (same as particle_simulation.wgsl)
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
}

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
}

// ============================================================================
// Collision Parameters
// ============================================================================

struct CollisionParams {
    boundsMin: vec3<f32>,
    _pad0: f32,
    boundsMax: vec3<f32>,
    _pad1: f32,
    resolution: vec3<f32>,
    _pad2: f32,
    restitution: f32,
    friction: f32,
    collisionMode: u32,
    particleRadius: f32,
    collisionEnabled: u32,
    groundPlaneY: f32,
    useGroundPlane: u32,
    _pad3: u32,
}

// ============================================================================
// Bindings
// ============================================================================

@group(0) @binding(0) var<uniform> params : SimulationParams;
@group(0) @binding(1) var<uniform> emitter : Emitter;

// Particle SoA buffers
@group(0) @binding(2) var<storage, read_write> positions : array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> velocities : array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> colors : array<vec4<f32>>;
@group(0) @binding(5) var<storage, read_write> sizeRotation : array<vec4<f32>>;

// Dead particle management
@group(0) @binding(6) var<storage, read_write> deadList : array<u32>;
@group(0) @binding(7) var<storage, read_write> counter : atomic<u32>;

// Collision bindings
@group(1) @binding(0) var sdfVolume : texture_3d<f32>;
@group(1) @binding(1) var sdfSampler : sampler;
@group(1) @binding(2) var<uniform> collision : CollisionParams;

// ============================================================================
// Constants
// ============================================================================

const COLLISION_MODE_BOUNCE: u32 = 0u;
const COLLISION_MODE_SLIDE: u32 = 1u;
const COLLISION_MODE_KILL: u32 = 2u;
const COLLISION_MODE_STICK: u32 = 3u;

const SDF_GRADIENT_EPS: f32 = 0.02;

// ============================================================================
// Random Number Generation
// ============================================================================

fn pcg(v: u32) -> u32 {
    var state = v * 747796405u + 2891336453u;
    let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

fn pcgFloat(seed: u32) -> f32 {
    return f32(pcg(seed)) / 4294967295.0;
}

// ============================================================================
// SDF Collision Functions
// ============================================================================

fn worldToSDFCoord(worldPos: vec3<f32>) -> vec3<f32> {
    return (worldPos - collision.boundsMin) / (collision.boundsMax - collision.boundsMin);
}

fn isInSDFBounds(worldPos: vec3<f32>) -> bool {
    let uvw = worldToSDFCoord(worldPos);
    return all(uvw >= vec3<f32>(0.0)) && all(uvw <= vec3<f32>(1.0));
}

fn sampleSDF(worldPos: vec3<f32>) -> f32 {
    let uvw = clamp(worldToSDFCoord(worldPos), vec3<f32>(0.001), vec3<f32>(0.999));
    return textureSampleLevel(sdfVolume, sdfSampler, uvw, 0.0).r;
}

fn computeSDFNormal(worldPos: vec3<f32>) -> vec3<f32> {
    let eps = SDF_GRADIENT_EPS;
    
    let dx = sampleSDF(worldPos + vec3<f32>(eps, 0.0, 0.0)) -
             sampleSDF(worldPos - vec3<f32>(eps, 0.0, 0.0));
    let dy = sampleSDF(worldPos + vec3<f32>(0.0, eps, 0.0)) -
             sampleSDF(worldPos - vec3<f32>(0.0, eps, 0.0));
    let dz = sampleSDF(worldPos + vec3<f32>(0.0, 0.0, eps)) -
             sampleSDF(worldPos - vec3<f32>(0.0, 0.0, eps));
    
    let gradient = vec3<f32>(dx, dy, dz);
    let len = length(gradient);
    
    if (len < 0.0001) {
        return vec3<f32>(0.0, 1.0, 0.0);
    }
    
    return gradient / len;
}

struct CollisionResult {
    pos: vec3<f32>,
    vel: vec3<f32>,
    kill: bool,
}

fn handleSDFCollision(pos: vec3<f32>, vel: vec3<f32>) -> CollisionResult {
    var result: CollisionResult;
    result.pos = pos;
    result.vel = vel;
    result.kill = false;
    
    if (collision.collisionEnabled == 0u) {
        return result;
    }
    
    if (!isInSDFBounds(pos)) {
        return result;
    }
    
    let distance = sampleSDF(pos);
    let radius = collision.particleRadius;
    
    if (distance >= radius) {
        return result;
    }
    
    // Collision detected
    let normal = computeSDFNormal(pos);
    let penetration = radius - distance;
    
    // Push out of surface
    result.pos = pos + normal * penetration;
    
    switch (collision.collisionMode) {
        case COLLISION_MODE_BOUNCE: {
            let normalVel = dot(vel, normal);
            let tangentVel = vel - normal * normalVel;
            let reflectedNormalVel = -normalVel * collision.restitution;
            let frictionFactor = 1.0 - collision.friction;
            result.vel = normal * reflectedNormalVel + tangentVel * frictionFactor;
        }
        case COLLISION_MODE_SLIDE: {
            let normalVel = dot(vel, normal);
            result.vel = (vel - normal * normalVel) * (1.0 - collision.friction);
        }
        case COLLISION_MODE_KILL: {
            result.kill = true;
            result.vel = vec3<f32>(0.0);
        }
        case COLLISION_MODE_STICK: {
            result.vel = vec3<f32>(0.0);
        }
        default: {
            // Default to bounce
            let normalVel = dot(vel, normal);
            result.vel = vel - normal * normalVel * (1.0 + collision.restitution);
        }
    }
    
    return result;
}

fn handleGroundCollision(pos: vec3<f32>, vel: vec3<f32>) -> CollisionResult {
    var result: CollisionResult;
    result.pos = pos;
    result.vel = vel;
    result.kill = false;
    
    if (collision.useGroundPlane == 0u) {
        return result;
    }
    
    let groundY = collision.groundPlaneY;
    let radius = collision.particleRadius;
    let surfaceY = groundY + radius;
    
    if (pos.y < surfaceY) {
        result.pos.y = surfaceY;
        
        if (vel.y < 0.0) {
            result.vel.y = -vel.y * collision.restitution;
        }
        
        // Apply friction
        result.vel.x = vel.x * (1.0 - collision.friction);
        result.vel.z = vel.z * (1.0 - collision.friction);
    }
    
    return result;
}

// ============================================================================
// Main Simulation Kernel with Collision
// ============================================================================

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    let index = GlobalInvocationID.x;
    if (index >= params.maxParticles) {
        return;
    }

    // Read velocity (includes life in .w)
    let velocityData = velocities[index];
    var life = velocityData.w;

    if (life <= 0.0) {
        return; // Dead particle
    }

    // Decrement life
    life -= params.deltaTime;

    if (life <= 0.0) {
        // Particle died
        velocities[index] = vec4<f32>(velocityData.xyz, -1.0);
        let deadIndex = atomicAdd(&counter, 1u);
        deadList[deadIndex] = index;
        return;
    }

    // Read position
    var pos = positions[index].xyz;
    var vel = velocityData.xyz;
    
    // Apply gravity and drag
    vel += emitter.gravity * params.deltaTime;
    vel *= (1.0 - emitter.drag * params.deltaTime);
    
    // Integrate position
    pos += vel * params.deltaTime;

    // Handle SDF collision
    var collision_result = handleSDFCollision(pos, vel);
    pos = collision_result.pos;
    vel = collision_result.vel;
    
    if (collision_result.kill) {
        velocities[index] = vec4<f32>(0.0, 0.0, 0.0, -1.0);
        let deadIndex = atomicAdd(&counter, 1u);
        deadList[deadIndex] = index;
        return;
    }
    
    // Handle ground plane collision
    collision_result = handleGroundCollision(pos, vel);
    pos = collision_result.pos;
    vel = collision_result.vel;

    // Update rotation
    let sizeRotData = sizeRotation[index];
    let size = sizeRotData.x;
    var rotation = sizeRotData.y;
    let angularVel = sizeRotData.z;
    let flags = sizeRotData.w;
    
    rotation += angularVel * params.deltaTime;

    // Update color (fade over lifetime)
    var color = colors[index];
    color.a = saturate(life / emitter.lifeMax);

    // Write outputs
    positions[index] = vec4<f32>(pos, 0.0);
    velocities[index] = vec4<f32>(vel, life);
    colors[index] = color;
    sizeRotation[index] = vec4<f32>(size, rotation, angularVel, flags);
}

// ============================================================================
// Emit Kernel (same as original)
// ============================================================================

@compute @workgroup_size(64)
fn emit(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    let emitIndex = GlobalInvocationID.x;
    if (emitIndex >= params.emitCount) {
        return;
    }

    let deadCount = atomicLoad(&counter);
    if (deadCount == 0u) {
        return;
    }

    let claimed = atomicSub(&counter, 1u);
    if (claimed == 0u) {
        atomicAdd(&counter, 1u);
        return;
    }

    let particleIndex = deadList[claimed - 1u];

    // Generate random values
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

    // Initial color
    let color = emitter.colorStart;

    // Random rotation and angular velocity
    let rotation = r9 * 6.28318530718;
    let angularVel = (r10 - 0.5) * 4.0;

    // Write particle data
    positions[particleIndex] = vec4<f32>(pos, 0.0);
    velocities[particleIndex] = vec4<f32>(vel, life);
    colors[particleIndex] = color;
    sizeRotation[particleIndex] = vec4<f32>(size, rotation, angularVel, 0.0);
}

// ============================================================================
// Reset Kernel
// ============================================================================

@compute @workgroup_size(64)
fn reset(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    let index = GlobalInvocationID.x;
    if (index >= params.maxParticles) {
        return;
    }

    velocities[index] = vec4<f32>(0.0, 0.0, 0.0, -1.0);
    positions[index] = vec4<f32>(0.0);
    colors[index] = vec4<f32>(0.0);
    sizeRotation[index] = vec4<f32>(0.0);
    deadList[index] = index;
}

@compute @workgroup_size(1)
fn initCounter() {
    atomicStore(&counter, params.maxParticles);
}

