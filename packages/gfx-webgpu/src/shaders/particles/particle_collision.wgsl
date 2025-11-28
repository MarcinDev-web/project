/**
 * Particle Collision Detection using SDF
 * 
 * Samples SDF volume to detect and respond to collisions.
 * Supports multiple collision response modes:
 * - Bounce: reflect velocity with restitution
 * - Slide: project velocity onto surface
 * - Kill: mark particle as dead on collision
 * - Stick: zero velocity and stop at surface
 */

// ============================================================================
// Constants
// ============================================================================

const COLLISION_MODE_BOUNCE: u32 = 0u;
const COLLISION_MODE_SLIDE: u32 = 1u;
const COLLISION_MODE_KILL: u32 = 2u;
const COLLISION_MODE_STICK: u32 = 3u;

const SDF_GRADIENT_EPS: f32 = 0.01;

// ============================================================================
// Structures
// ============================================================================

struct CollisionParams {
    boundsMin: vec3<f32>,
    _pad0: f32,
    boundsMax: vec3<f32>,
    _pad1: f32,
    resolution: vec3<f32>,
    _pad2: f32,
    restitution: f32,     // Bounce coefficient (0 = no bounce, 1 = perfect bounce)
    friction: f32,        // Surface friction (0 = frictionless, 1 = full friction)
    collisionMode: u32,   // COLLISION_MODE_*
    particleRadius: f32,  // Particle collision radius
}

struct CollisionResult {
    newPos: vec3<f32>,
    newVel: vec3<f32>,
    collided: bool,
    shouldKill: bool,
}

// ============================================================================
// Bindings (imported by particle_simulation.wgsl)
// ============================================================================

// SDF texture and sampler are bound in group 1
// @group(1) @binding(0) var sdfVolume: texture_3d<f32>;
// @group(1) @binding(1) var sdfSampler: sampler;
// @group(1) @binding(2) var<uniform> collisionParams: CollisionParams;

// ============================================================================
// SDF Sampling Functions
// ============================================================================

/**
 * Converts world position to normalized SDF coordinates [0, 1]
 */
fn worldToSDFCoord(worldPos: vec3<f32>, params: CollisionParams) -> vec3<f32> {
    return (worldPos - params.boundsMin) / (params.boundsMax - params.boundsMin);
}

/**
 * Checks if a position is within SDF bounds
 */
fn isInSDFBounds(worldPos: vec3<f32>, params: CollisionParams) -> bool {
    let uvw = worldToSDFCoord(worldPos, params);
    return all(uvw >= vec3<f32>(0.0)) && all(uvw <= vec3<f32>(1.0));
}

/**
 * Samples the SDF at a world position using trilinear interpolation
 */
fn sampleSDF(
    sdfTexture: texture_3d<f32>,
    sdfSampler_: sampler,
    worldPos: vec3<f32>,
    params: CollisionParams
) -> f32 {
    let uvw = worldToSDFCoord(worldPos, params);
    
    // Clamp to valid range to avoid edge artifacts
    let clampedUVW = clamp(uvw, vec3<f32>(0.001), vec3<f32>(0.999));
    
    return textureSampleLevel(sdfTexture, sdfSampler_, clampedUVW, 0.0).r;
}

/**
 * Computes the SDF gradient (surface normal) using central differences
 */
fn computeSDFGradient(
    sdfTexture: texture_3d<f32>,
    sdfSampler_: sampler,
    worldPos: vec3<f32>,
    params: CollisionParams
) -> vec3<f32> {
    let eps = SDF_GRADIENT_EPS;
    
    let dx = sampleSDF(sdfTexture, sdfSampler_, worldPos + vec3<f32>(eps, 0.0, 0.0), params) -
             sampleSDF(sdfTexture, sdfSampler_, worldPos - vec3<f32>(eps, 0.0, 0.0), params);
    let dy = sampleSDF(sdfTexture, sdfSampler_, worldPos + vec3<f32>(0.0, eps, 0.0), params) -
             sampleSDF(sdfTexture, sdfSampler_, worldPos - vec3<f32>(0.0, eps, 0.0), params);
    let dz = sampleSDF(sdfTexture, sdfSampler_, worldPos + vec3<f32>(0.0, 0.0, eps), params) -
             sampleSDF(sdfTexture, sdfSampler_, worldPos - vec3<f32>(0.0, 0.0, eps), params);
    
    let gradient = vec3<f32>(dx, dy, dz);
    let len = length(gradient);
    
    if (len < 0.0001) {
        return vec3<f32>(0.0, 1.0, 0.0); // Default to up if gradient is zero
    }
    
    return gradient / len;
}

// ============================================================================
// Collision Response Functions
// ============================================================================

/**
 * Bounce response: reflect velocity with restitution
 */
fn bounceResponse(
    pos: vec3<f32>,
    vel: vec3<f32>,
    normal: vec3<f32>,
    distance: f32,
    params: CollisionParams
) -> CollisionResult {
    var result: CollisionResult;
    
    // Push particle out of surface
    let penetration = params.particleRadius - distance;
    result.newPos = pos + normal * penetration;
    
    // Reflect velocity
    let normalVel = dot(vel, normal);
    let tangentVel = vel - normal * normalVel;
    
    // Apply restitution to normal component (bounce)
    let reflectedNormalVel = -normalVel * params.restitution;
    
    // Apply friction to tangent component
    let frictionFactor = 1.0 - params.friction;
    let dampedTangentVel = tangentVel * frictionFactor;
    
    result.newVel = normal * reflectedNormalVel + dampedTangentVel;
    result.collided = true;
    result.shouldKill = false;
    
    return result;
}

/**
 * Slide response: project velocity onto surface plane
 */
fn slideResponse(
    pos: vec3<f32>,
    vel: vec3<f32>,
    normal: vec3<f32>,
    distance: f32,
    params: CollisionParams
) -> CollisionResult {
    var result: CollisionResult;
    
    // Push particle to surface
    let penetration = params.particleRadius - distance;
    result.newPos = pos + normal * penetration;
    
    // Project velocity onto surface (remove normal component)
    let normalVel = dot(vel, normal);
    result.newVel = vel - normal * normalVel;
    
    // Apply friction
    result.newVel = result.newVel * (1.0 - params.friction);
    
    result.collided = true;
    result.shouldKill = false;
    
    return result;
}

/**
 * Kill response: mark particle for removal
 */
fn killResponse(
    pos: vec3<f32>,
    vel: vec3<f32>,
    normal: vec3<f32>,
    distance: f32,
    params: CollisionParams
) -> CollisionResult {
    var result: CollisionResult;
    result.newPos = pos;
    result.newVel = vec3<f32>(0.0);
    result.collided = true;
    result.shouldKill = true;
    return result;
}

/**
 * Stick response: stop particle at surface
 */
fn stickResponse(
    pos: vec3<f32>,
    vel: vec3<f32>,
    normal: vec3<f32>,
    distance: f32,
    params: CollisionParams
) -> CollisionResult {
    var result: CollisionResult;
    
    // Push to surface
    let penetration = params.particleRadius - distance;
    result.newPos = pos + normal * penetration;
    
    // Zero velocity
    result.newVel = vec3<f32>(0.0);
    
    result.collided = true;
    result.shouldKill = false;
    
    return result;
}

// ============================================================================
// Main Collision Detection Function
// ============================================================================

/**
 * Performs collision detection and response for a single particle
 */
fn resolveSDFCollision(
    sdfTexture: texture_3d<f32>,
    sdfSampler_: sampler,
    pos: vec3<f32>,
    vel: vec3<f32>,
    params: CollisionParams
) -> CollisionResult {
    var result: CollisionResult;
    result.newPos = pos;
    result.newVel = vel;
    result.collided = false;
    result.shouldKill = false;
    
    // Check if particle is in SDF bounds
    if (!isInSDFBounds(pos, params)) {
        return result;
    }
    
    // Sample SDF at particle position
    let distance = sampleSDF(sdfTexture, sdfSampler_, pos, params);
    
    // Check for collision (distance < particle radius)
    if (distance >= params.particleRadius) {
        return result;
    }
    
    // Compute surface normal
    let normal = computeSDFGradient(sdfTexture, sdfSampler_, pos, params);
    
    // Apply collision response based on mode
    switch (params.collisionMode) {
        case COLLISION_MODE_BOUNCE: {
            return bounceResponse(pos, vel, normal, distance, params);
        }
        case COLLISION_MODE_SLIDE: {
            return slideResponse(pos, vel, normal, distance, params);
        }
        case COLLISION_MODE_KILL: {
            return killResponse(pos, vel, normal, distance, params);
        }
        case COLLISION_MODE_STICK: {
            return stickResponse(pos, vel, normal, distance, params);
        }
        default: {
            return bounceResponse(pos, vel, normal, distance, params);
        }
    }
}

// ============================================================================
// Simple Ground Plane Collision (fast fallback)
// ============================================================================

/**
 * Simple ground plane collision at y=0
 */
fn resolveGroundCollision(
    pos: vec3<f32>,
    vel: vec3<f32>,
    groundY: f32,
    radius: f32,
    restitution: f32,
    friction: f32
) -> CollisionResult {
    var result: CollisionResult;
    result.newPos = pos;
    result.newVel = vel;
    result.collided = false;
    result.shouldKill = false;
    
    let surfaceY = groundY + radius;
    
    if (pos.y < surfaceY) {
        result.collided = true;
        result.newPos.y = surfaceY;
        
        // Bounce with restitution
        if (vel.y < 0.0) {
            result.newVel.y = -vel.y * restitution;
        }
        
        // Apply friction to horizontal velocity
        result.newVel.x = vel.x * (1.0 - friction);
        result.newVel.z = vel.z * (1.0 - friction);
    }
    
    return result;
}

// ============================================================================
// Box Collision (for bounds checking)
// ============================================================================

/**
 * Collision with axis-aligned bounding box
 */
fn resolveBoxCollision(
    pos: vec3<f32>,
    vel: vec3<f32>,
    boxMin: vec3<f32>,
    boxMax: vec3<f32>,
    radius: f32,
    restitution: f32
) -> CollisionResult {
    var result: CollisionResult;
    result.newPos = pos;
    result.newVel = vel;
    result.collided = false;
    result.shouldKill = false;
    
    let innerMin = boxMin + vec3<f32>(radius);
    let innerMax = boxMax - vec3<f32>(radius);
    
    // Check X bounds
    if (pos.x < innerMin.x) {
        result.newPos.x = innerMin.x;
        result.newVel.x = abs(vel.x) * restitution;
        result.collided = true;
    } else if (pos.x > innerMax.x) {
        result.newPos.x = innerMax.x;
        result.newVel.x = -abs(vel.x) * restitution;
        result.collided = true;
    }
    
    // Check Y bounds
    if (pos.y < innerMin.y) {
        result.newPos.y = innerMin.y;
        result.newVel.y = abs(vel.y) * restitution;
        result.collided = true;
    } else if (pos.y > innerMax.y) {
        result.newPos.y = innerMax.y;
        result.newVel.y = -abs(vel.y) * restitution;
        result.collided = true;
    }
    
    // Check Z bounds
    if (pos.z < innerMin.z) {
        result.newPos.z = innerMin.z;
        result.newVel.z = abs(vel.z) * restitution;
        result.collided = true;
    } else if (pos.z > innerMax.z) {
        result.newPos.z = innerMax.z;
        result.newVel.z = -abs(vel.z) * restitution;
        result.collided = true;
    }
    
    return result;
}

