/**
 * SDF Generation Compute Shader using Jump Flooding Algorithm (JFA)
 * 
 * Generates a 3D Signed Distance Field from seed points (scene geometry).
 * The JFA is an efficient parallel algorithm that runs in O(log n) passes.
 * 
 * Process:
 * 1. Initialize seeds from geometry (particles, voxels, or mesh samples)
 * 2. Run JFA passes with decreasing step sizes: n/2, n/4, ..., 1
 * 3. Compute final signed distances
 */

// ============================================================================
// Constants
// ============================================================================

const WORKGROUP_SIZE: u32 = 4u;  // 4x4x4 = 64 threads per workgroup
const INVALID_COORD: vec3<i32> = vec3<i32>(-999999);
const MAX_DISTANCE: f32 = 1e10;

// ============================================================================
// Structures
// ============================================================================

struct SDFUniforms {
    resolution: vec3<u32>,    // SDF volume resolution
    _pad0: u32,
    boundsMin: vec3<f32>,     // World-space bounds minimum
    _pad1: f32,
    boundsMax: vec3<f32>,     // World-space bounds maximum
    _pad2: f32,
    stepSize: i32,            // Current JFA step size
    passIndex: u32,           // Current pass index (for ping-pong)
    signMode: u32,            // 0 = unsigned, 1 = signed (requires inside/outside)
    _pad3: u32,
}

// Seed point for JFA (stores nearest seed coordinate)
// We use i32 to allow -1 for "no seed" sentinel
struct SeedPoint {
    coord: vec3<i32>,         // Voxel coordinate of nearest seed, or INVALID_COORD
    inside: i32,              // 1 if inside geometry, 0 if outside (for signed)
}

// ============================================================================
// Bindings
// ============================================================================

@group(0) @binding(0) var<uniform> uniforms: SDFUniforms;

// Ping-pong buffers for JFA
@group(0) @binding(1) var<storage, read> seedsIn: array<SeedPoint>;
@group(0) @binding(2) var<storage, read_write> seedsOut: array<SeedPoint>;

// Final SDF output (r32float texture or storage buffer)
@group(0) @binding(3) var sdfOutput: texture_storage_3d<r32float, write>;

// Input geometry (for seeding)
@group(0) @binding(4) var<storage, read> geometryPoints: array<vec4<f32>>; // xyz = position, w = inside flag
@group(0) @binding(5) var<uniform> geometryCount: u32;

// ============================================================================
// Helper Functions
// ============================================================================

fn voxelToIndex(coord: vec3<u32>) -> u32 {
    return coord.z * uniforms.resolution.x * uniforms.resolution.y +
           coord.y * uniforms.resolution.x +
           coord.x;
}

fn indexToVoxel(index: u32) -> vec3<u32> {
    let z = index / (uniforms.resolution.x * uniforms.resolution.y);
    let rem = index % (uniforms.resolution.x * uniforms.resolution.y);
    let y = rem / uniforms.resolution.x;
    let x = rem % uniforms.resolution.x;
    return vec3<u32>(x, y, z);
}

fn worldToVoxel(worldPos: vec3<f32>) -> vec3<i32> {
    let normalized = (worldPos - uniforms.boundsMin) / (uniforms.boundsMax - uniforms.boundsMin);
    let voxelF = normalized * vec3<f32>(uniforms.resolution);
    return vec3<i32>(floor(voxelF));
}

fn voxelToWorld(voxel: vec3<u32>) -> vec3<f32> {
    let normalized = (vec3<f32>(voxel) + 0.5) / vec3<f32>(uniforms.resolution);
    return uniforms.boundsMin + normalized * (uniforms.boundsMax - uniforms.boundsMin);
}

fn isValidVoxel(coord: vec3<i32>) -> bool {
    return coord.x >= 0 && coord.y >= 0 && coord.z >= 0 &&
           u32(coord.x) < uniforms.resolution.x &&
           u32(coord.y) < uniforms.resolution.y &&
           u32(coord.z) < uniforms.resolution.z;
}

fn distanceSquared(a: vec3<i32>, b: vec3<i32>) -> f32 {
    let d = vec3<f32>(a - b);
    return dot(d, d);
}

// ============================================================================
// Seed Initialization Kernel
// Places seed points from geometry into the SDF volume
// ============================================================================

@compute @workgroup_size(64)
fn initSeeds(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let index = globalId.x;
    let totalVoxels = uniforms.resolution.x * uniforms.resolution.y * uniforms.resolution.z;
    
    if (index >= totalVoxels) {
        return;
    }
    
    // Initialize to invalid (no seed)
    var seed: SeedPoint;
    seed.coord = INVALID_COORD;
    seed.inside = 0;
    
    seedsOut[index] = seed;
}

@compute @workgroup_size(64)
fn seedFromGeometry(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let geoIndex = globalId.x;
    
    if (geoIndex >= geometryCount) {
        return;
    }
    
    let point = geometryPoints[geoIndex];
    let worldPos = point.xyz;
    let inside = i32(point.w > 0.5);
    
    // Convert to voxel coordinate
    let voxel = worldToVoxel(worldPos);
    
    if (!isValidVoxel(voxel)) {
        return;
    }
    
    let voxelU = vec3<u32>(voxel);
    let index = voxelToIndex(voxelU);
    
    // Set this voxel as a seed (self-referential)
    var seed: SeedPoint;
    seed.coord = voxel;
    seed.inside = inside;
    
    seedsOut[index] = seed;
}

// ============================================================================
// Jump Flooding Algorithm Pass
// ============================================================================

@compute @workgroup_size(WORKGROUP_SIZE, WORKGROUP_SIZE, WORKGROUP_SIZE)
fn jfaPass(@builtin(global_invocation_id) globalId: vec3<u32>) {
    // Check bounds
    if (globalId.x >= uniforms.resolution.x ||
        globalId.y >= uniforms.resolution.y ||
        globalId.z >= uniforms.resolution.z) {
        return;
    }
    
    let currentCoord = vec3<i32>(globalId);
    let currentIndex = voxelToIndex(globalId);
    let step = uniforms.stepSize;
    
    // Read current best seed
    var bestSeed = seedsIn[currentIndex];
    var bestDist = MAX_DISTANCE;
    
    if (bestSeed.coord.x != INVALID_COORD.x) {
        bestDist = distanceSquared(currentCoord, bestSeed.coord);
    }
    
    // Check 26 neighbors at current step size (3x3x3 - 1)
    for (var dz = -1; dz <= 1; dz++) {
        for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
                if (dx == 0 && dy == 0 && dz == 0) {
                    continue;
                }
                
                let neighborCoord = currentCoord + vec3<i32>(dx, dy, dz) * step;
                
                if (!isValidVoxel(neighborCoord)) {
                    continue;
                }
                
                let neighborIndex = voxelToIndex(vec3<u32>(neighborCoord));
                let neighborSeed = seedsIn[neighborIndex];
                
                if (neighborSeed.coord.x == INVALID_COORD.x) {
                    continue;
                }
                
                let dist = distanceSquared(currentCoord, neighborSeed.coord);
                
                if (dist < bestDist) {
                    bestDist = dist;
                    bestSeed = neighborSeed;
                }
            }
        }
    }
    
    seedsOut[currentIndex] = bestSeed;
}

// ============================================================================
// Final Distance Computation
// Converts seed coordinates to actual distances
// ============================================================================

@compute @workgroup_size(WORKGROUP_SIZE, WORKGROUP_SIZE, WORKGROUP_SIZE)
fn computeDistances(@builtin(global_invocation_id) globalId: vec3<u32>) {
    if (globalId.x >= uniforms.resolution.x ||
        globalId.y >= uniforms.resolution.y ||
        globalId.z >= uniforms.resolution.z) {
        return;
    }
    
    let currentIndex = voxelToIndex(globalId);
    let seed = seedsIn[currentIndex];
    
    var distance: f32;
    
    if (seed.coord.x == INVALID_COORD.x) {
        // No seed found - use maximum distance
        distance = MAX_DISTANCE;
    } else {
        // Compute Euclidean distance in voxel space
        let voxelDist = sqrt(distanceSquared(vec3<i32>(globalId), seed.coord));
        
        // Convert to world-space distance
        let voxelSize = (uniforms.boundsMax - uniforms.boundsMin) / vec3<f32>(uniforms.resolution);
        let avgVoxelSize = (voxelSize.x + voxelSize.y + voxelSize.z) / 3.0;
        distance = voxelDist * avgVoxelSize;
        
        // Apply sign if signed mode is enabled
        if (uniforms.signMode > 0u && seed.inside > 0) {
            distance = -distance;
        }
    }
    
    textureStore(sdfOutput, globalId, vec4<f32>(distance, 0.0, 0.0, 0.0));
}

// ============================================================================
// SDF from AABB (Axis-Aligned Bounding Box)
// Fast analytical SDF for box colliders
// ============================================================================

struct AABBData {
    min: vec3<f32>,
    _pad0: f32,
    max: vec3<f32>,
    _pad1: f32,
}

@group(1) @binding(0) var<storage, read> aabbList: array<AABBData>;
@group(1) @binding(1) var<uniform> aabbCount: u32;

fn sdAABB(p: vec3<f32>, aabb: AABBData) -> f32 {
    let center = (aabb.min + aabb.max) * 0.5;
    let halfSize = (aabb.max - aabb.min) * 0.5;
    let localP = p - center;
    
    let q = abs(localP) - halfSize;
    return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

@compute @workgroup_size(WORKGROUP_SIZE, WORKGROUP_SIZE, WORKGROUP_SIZE)
fn computeAABBSDF(@builtin(global_invocation_id) globalId: vec3<u32>) {
    if (globalId.x >= uniforms.resolution.x ||
        globalId.y >= uniforms.resolution.y ||
        globalId.z >= uniforms.resolution.z) {
        return;
    }
    
    let worldPos = voxelToWorld(globalId);
    
    // Find minimum distance to any AABB
    var minDist = MAX_DISTANCE;
    
    for (var i = 0u; i < aabbCount; i++) {
        let dist = sdAABB(worldPos, aabbList[i]);
        minDist = min(minDist, dist);
    }
    
    textureStore(sdfOutput, globalId, vec4<f32>(minDist, 0.0, 0.0, 0.0));
}

// ============================================================================
// SDF from Spheres (fast path for particle collision)
// ============================================================================

struct SphereData {
    center: vec3<f32>,
    radius: f32,
}

@group(1) @binding(2) var<storage, read> sphereList: array<SphereData>;
@group(1) @binding(3) var<uniform> sphereCount: u32;

@compute @workgroup_size(WORKGROUP_SIZE, WORKGROUP_SIZE, WORKGROUP_SIZE)
fn computeSphereSDF(@builtin(global_invocation_id) globalId: vec3<u32>) {
    if (globalId.x >= uniforms.resolution.x ||
        globalId.y >= uniforms.resolution.y ||
        globalId.z >= uniforms.resolution.z) {
        return;
    }
    
    let worldPos = voxelToWorld(globalId);
    var minDist = MAX_DISTANCE;
    
    for (var i = 0u; i < sphereCount; i++) {
        let sphere = sphereList[i];
        let dist = length(worldPos - sphere.center) - sphere.radius;
        minDist = min(minDist, dist);
    }
    
    textureStore(sdfOutput, globalId, vec4<f32>(minDist, 0.0, 0.0, 0.0));
}

// ============================================================================
// SDF Union (combine multiple SDF sources)
// ============================================================================

@group(2) @binding(0) var sdfInputA: texture_3d<f32>;
@group(2) @binding(1) var sdfInputB: texture_3d<f32>;

@compute @workgroup_size(WORKGROUP_SIZE, WORKGROUP_SIZE, WORKGROUP_SIZE)
fn unionSDF(@builtin(global_invocation_id) globalId: vec3<u32>) {
    if (globalId.x >= uniforms.resolution.x ||
        globalId.y >= uniforms.resolution.y ||
        globalId.z >= uniforms.resolution.z) {
        return;
    }
    
    let distA = textureLoad(sdfInputA, globalId, 0).r;
    let distB = textureLoad(sdfInputB, globalId, 0).r;
    
    // Union = min distance
    let unionDist = min(distA, distB);
    
    textureStore(sdfOutput, globalId, vec4<f32>(unionDist, 0.0, 0.0, 0.0));
}

