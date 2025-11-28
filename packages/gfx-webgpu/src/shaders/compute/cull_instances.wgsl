/**
 * GPU Frustum Culling Compute Shader (Enhanced)
 * 
 * Features:
 * - Per-instance bounding spheres (vec4: xyz=center, w=radius)
 * - Workgroup-local counting to reduce atomic contention
 * - Optimized plane tests using sphere-plane distance
 * - Support for indirect draw command generation
 */

// ============================================================================
// Data Structures
// ============================================================================

struct FrustumPlane {
  // xyz = normal, w = distance from origin
  data: vec4<f32>,
}

struct CullUniforms {
  planes: array<vec4<f32>, 6>,
  // misc.x = maxInstances, misc.y = indexCount, misc.z = flags, misc.w = reserved
  misc: vec4<f32>,
}

// Extended uniforms for Hi-Z occlusion culling
struct CullUniformsExtended {
  planes: array<vec4<f32>, 6>,
  misc: vec4<f32>,
  // viewProj matrix for screen-space projection
  viewProj: mat4x4<f32>,
  // Screen dimensions and Hi-Z info
  // screenInfo.xy = screenSize, screenInfo.z = hiZMipLevels, screenInfo.w = hiZEnabled
  screenInfo: vec4<f32>,
}

// ============================================================================
// Bindings
// ============================================================================

@group(0) @binding(0) var<uniform> uniforms: CullUniforms;
// Per-instance bounds: vec4(centerX, centerY, centerZ, radius)
@group(0) @binding(1) var<storage, read> instanceBounds: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> visibleIndices: array<u32>;
@group(0) @binding(3) var<storage, read_write> visibleCount: atomic<u32>;
@group(0) @binding(4) var<storage, read_write> drawCommand: array<u32, 5>;

// Hi-Z occlusion culling bindings (optional, group 1)
@group(1) @binding(0) var<uniform> uniformsExt: CullUniformsExtended;
@group(1) @binding(1) var hiZTexture: texture_2d<f32>;
@group(1) @binding(2) var hiZSampler: sampler;

// ============================================================================
// Workgroup Shared Memory - Parallel Prefix Sum Stream Compaction
// ============================================================================

const WORKGROUP_SIZE: u32 = 64u;

// Shared memory for parallel prefix sum (Hillis-Steele algorithm)
var<workgroup> localVisibleFlags: array<u32, WORKGROUP_SIZE>;    // 1 if visible, 0 otherwise
var<workgroup> localPrefixSum: array<u32, WORKGROUP_SIZE>;       // Exclusive prefix sum
var<workgroup> localInstanceIndices: array<u32, WORKGROUP_SIZE>; // Instance indices to write
var<workgroup> sharedTotalCount: u32;                            // Total visible in workgroup
var<workgroup> sharedGlobalOffset: u32;                          // Global write offset

// ============================================================================
// Parallel Prefix Sum (Exclusive) - Hillis-Steele Algorithm
// Computes write offsets in O(log n) steps instead of O(n) serial
// ============================================================================

fn workgroupPrefixSum(localIndex: u32) {
  // Hillis-Steele parallel prefix sum (log2(64) = 6 steps)
  for (var offset = 1u; offset < WORKGROUP_SIZE; offset *= 2u) {
    workgroupBarrier();
    let val = localPrefixSum[localIndex];
    workgroupBarrier();
    if (localIndex >= offset) {
      localPrefixSum[localIndex] = val + localPrefixSum[localIndex - offset];
    }
  }
  workgroupBarrier();
  
  // Convert to exclusive prefix sum and extract total
  if (localIndex == 0u) {
    sharedTotalCount = localPrefixSum[WORKGROUP_SIZE - 1u];
  }
  workgroupBarrier();
  
  let inclusiveSum = localPrefixSum[localIndex];
  workgroupBarrier();
  
  if (localIndex == 0u) {
    localPrefixSum[0] = 0u;
  } else {
    localPrefixSum[localIndex] = localPrefixSum[localIndex - 1u];
  }
  workgroupBarrier();
}

// ============================================================================
// Frustum Culling Functions
// ============================================================================

/**
 * Tests a bounding sphere against a frustum plane.
 * Returns true if sphere is on the positive side (visible side) of the plane.
 */
fn testSphereAgainstPlane(center: vec3<f32>, radius: f32, plane: vec4<f32>) -> bool {
  // Signed distance from center to plane
  let distance = dot(plane.xyz, center) + plane.w;
  // Sphere is visible if center is within radius of the positive half-space
  return distance >= -radius;
}

/**
 * Tests a bounding sphere against all 6 frustum planes.
 * Uses early-out optimization - returns false as soon as sphere is outside any plane.
 */
fn isSphereFrustumVisible(bounds: vec4<f32>) -> bool {
  let center = bounds.xyz;
  let radius = bounds.w;
  
  // Early out if radius is invalid (degenerate bounds)
  if (radius <= 0.0) {
    return false;
  }
  
  // Test against all 6 frustum planes with early-out
  for (var i = 0u; i < 6u; i++) {
    if (!testSphereAgainstPlane(center, radius, uniforms.planes[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Tests an AABB against a frustum plane using the P-vertex method.
 * More precise than sphere test but slightly more expensive.
 */
fn testAABBAgainstPlane(aabbMin: vec3<f32>, aabbMax: vec3<f32>, plane: vec4<f32>) -> bool {
  // Select P-vertex (farthest point along plane normal direction)
  let px = select(aabbMin.x, aabbMax.x, plane.x >= 0.0);
  let py = select(aabbMin.y, aabbMax.y, plane.y >= 0.0);
  let pz = select(aabbMin.z, aabbMax.z, plane.z >= 0.0);
  
  let distance = dot(plane.xyz, vec3<f32>(px, py, pz)) + plane.w;
  return distance >= 0.0;
}

/**
 * Tests AABB bounds against all frustum planes.
 * Derives AABB from bounding sphere for more precise culling.
 */
fn isAABBFrustumVisible(bounds: vec4<f32>) -> bool {
  let center = bounds.xyz;
  let radius = bounds.w;
  
  if (radius <= 0.0) {
    return false;
  }
  
  // Derive AABB from bounding sphere
  let halfExtent = vec3<f32>(radius, radius, radius);
  let aabbMin = center - halfExtent;
  let aabbMax = center + halfExtent;
  
  for (var i = 0u; i < 6u; i++) {
    if (!testAABBAgainstPlane(aabbMin, aabbMax, uniforms.planes[i])) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// Main Culling Kernel (with Parallel Prefix Sum Optimization)
// Reduces global atomic contention from O(n) to O(1) per workgroup
// ============================================================================

@compute @workgroup_size(64)
fn main(
  @builtin(global_invocation_id) globalId: vec3<u32>,
  @builtin(local_invocation_id) localId: vec3<u32>,
  @builtin(workgroup_id) workgroupId: vec3<u32>
) {
  let instanceIndex = globalId.x;
  let localIndex = localId.x;
  let maxInstances = u32(uniforms.misc.x);
  
  // ========================================
  // Phase 1: Visibility test + store flags
  // ========================================
  var isVisible = false;
  if (instanceIndex < maxInstances) {
    let bounds = instanceBounds[instanceIndex];
    isVisible = isSphereFrustumVisible(bounds);
  }
  
  // Store visibility flag (1 or 0) for prefix sum
  let visFlag = select(0u, 1u, isVisible);
  localVisibleFlags[localIndex] = visFlag;
  localPrefixSum[localIndex] = visFlag;
  localInstanceIndices[localIndex] = instanceIndex;
  workgroupBarrier();
  
  // ========================================
  // Phase 2: Parallel prefix sum (O(log n) steps)
  // Computes exclusive scan to determine write offsets
  // ========================================
  workgroupPrefixSum(localIndex);
  
  // ========================================
  // Phase 3: Single atomic to reserve global space
  // Only 1 atomic op per workgroup (vs 64 in naive approach)
  // ========================================
  if (localIndex == 0u && sharedTotalCount > 0u) {
    sharedGlobalOffset = atomicAdd(&visibleCount, sharedTotalCount);
  }
  workgroupBarrier();
  
  // ========================================
  // Phase 4: All visible threads write in parallel
  // Each thread knows its exact offset from prefix sum
  // ========================================
  if (isVisible && sharedTotalCount > 0u) {
    let localWriteOffset = localPrefixSum[localIndex];
    let globalWriteOffset = sharedGlobalOffset + localWriteOffset;
    visibleIndices[globalWriteOffset] = instanceIndex;
  }
}

// ============================================================================
// Alternative: Simple Kernel (No Shared Memory - For Comparison/Fallback)
// ============================================================================

@compute @workgroup_size(64)
fn main_simple(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let instanceIndex = globalId.x;
  let maxInstances = u32(uniforms.misc.x);
  
  if (instanceIndex >= maxInstances) {
    return;
  }
  
  let bounds = instanceBounds[instanceIndex];
  if (isSphereFrustumVisible(bounds)) {
    let outputIndex = atomicAdd(&visibleCount, 1u);
    visibleIndices[outputIndex] = instanceIndex;
  }
}

// ============================================================================
// Finalize Pass: Update Indirect Draw Command
// ============================================================================

@compute @workgroup_size(1)
fn finalize() {
  let count = atomicLoad(&visibleCount);
  let indexCount = u32(uniforms.misc.y);
  
  // DrawIndexedIndirect structure:
  // [0] indexCount
  // [1] instanceCount (our visible count)
  // [2] firstIndex
  // [3] baseVertex  
  // [4] firstInstance
  drawCommand[0] = indexCount;
  drawCommand[1] = count;
  drawCommand[2] = 0u;
  drawCommand[3] = 0u;
  drawCommand[4] = 0u;
}

// ============================================================================
// Hi-Z Occlusion Culling Functions
// ============================================================================

/**
 * Projects a 3D point to screen space using viewProj matrix.
 * Returns: vec3(screenX, screenY, depth) in [0,1] range
 */
fn projectToScreen(worldPos: vec3<f32>, viewProj: mat4x4<f32>) -> vec3<f32> {
  let clipPos = viewProj * vec4<f32>(worldPos, 1.0);
  
  // Perspective divide
  let ndcPos = clipPos.xyz / clipPos.w;
  
  // NDC to screen space [0, 1]
  let screenPos = vec3<f32>(
    ndcPos.x * 0.5 + 0.5,
    -ndcPos.y * 0.5 + 0.5,  // Flip Y for texture coordinates
    ndcPos.z  // Depth in [0, 1] (assuming reverse-Z)
  );
  
  return screenPos;
}

/**
 * Projects bounding sphere to screen-space rectangle.
 * Returns: vec4(minX, minY, maxX, maxY) in [0,1] range, and nearZ depth
 */
fn projectBoundsToScreen(center: vec3<f32>, radius: f32, viewProj: mat4x4<f32>) -> vec4<f32> {
  // Project center
  let centerScreen = projectToScreen(center, viewProj);
  
  // Approximate screen-space radius by projecting axis-aligned extents
  let extentX = projectToScreen(center + vec3<f32>(radius, 0.0, 0.0), viewProj);
  let extentY = projectToScreen(center + vec3<f32>(0.0, radius, 0.0), viewProj);
  let extentZ = projectToScreen(center + vec3<f32>(0.0, 0.0, radius), viewProj);
  
  let screenRadiusX = abs(extentX.x - centerScreen.x);
  let screenRadiusY = max(abs(extentY.y - centerScreen.y), abs(extentZ.y - centerScreen.y));
  let screenRadius = max(screenRadiusX, screenRadiusY);
  
  return vec4<f32>(
    clamp(centerScreen.x - screenRadius, 0.0, 1.0),
    clamp(centerScreen.y - screenRadius, 0.0, 1.0),
    clamp(centerScreen.x + screenRadius, 0.0, 1.0),
    clamp(centerScreen.y + screenRadius, 0.0, 1.0)
  );
}

/**
 * Computes the Hi-Z mip level for a given screen-space rect size.
 * Larger objects use lower (more detailed) mip levels.
 */
fn computeHiZMipLevel(screenRect: vec4<f32>, screenSize: vec2<f32>, maxMip: f32) -> f32 {
  let rectSize = (screenRect.zw - screenRect.xy) * screenSize;
  let maxDim = max(rectSize.x, rectSize.y);
  let mipLevel = ceil(log2(max(maxDim, 1.0)));
  return clamp(mipLevel, 0.0, maxMip);
}

/**
 * Tests if a bounding sphere is occluded by sampling Hi-Z buffer.
 * Returns true if the object is OCCLUDED (should be culled).
 */
fn isOccludedByHiZ(center: vec3<f32>, radius: f32) -> bool {
  let viewProj = uniformsExt.viewProj;
  let screenSize = uniformsExt.screenInfo.xy;
  let maxMip = uniformsExt.screenInfo.z;
  
  // Project bounds to screen space
  let centerClip = viewProj * vec4<f32>(center, 1.0);
  
  // Early out: behind camera
  if (centerClip.w <= 0.0) {
    return true;  // Behind camera = occluded/culled
  }
  
  let centerNdc = centerClip.xyz / centerClip.w;
  
  // Early out: outside screen
  if (centerNdc.x < -1.0 || centerNdc.x > 1.0 || 
      centerNdc.y < -1.0 || centerNdc.y > 1.0) {
    return false;  // Outside screen, let frustum culling handle it
  }
  
  // Project to screen rect
  let screenRect = projectBoundsToScreen(center, radius, viewProj);
  
  // Compute appropriate mip level
  let mipLevel = computeHiZMipLevel(screenRect, screenSize, maxMip);
  
  // Compute near depth of bounding sphere (closest point to camera)
  // For reverse-Z: larger depth = closer to camera
  let nearPoint = center - normalize(center) * radius;
  let nearClip = viewProj * vec4<f32>(nearPoint, 1.0);
  let nearDepth = nearClip.z / nearClip.w;
  
  // Sample Hi-Z at the 4 corners of the screen rect (conservative)
  let uvMin = screenRect.xy;
  let uvMax = screenRect.zw;
  let uvCenter = (uvMin + uvMax) * 0.5;
  
  // Sample at center and corners for conservative test
  var maxHiZDepth = textureSampleLevel(hiZTexture, hiZSampler, uvCenter, mipLevel).r;
  maxHiZDepth = max(maxHiZDepth, textureSampleLevel(hiZTexture, hiZSampler, uvMin, mipLevel).r);
  maxHiZDepth = max(maxHiZDepth, textureSampleLevel(hiZTexture, hiZSampler, vec2<f32>(uvMax.x, uvMin.y), mipLevel).r);
  maxHiZDepth = max(maxHiZDepth, textureSampleLevel(hiZTexture, hiZSampler, vec2<f32>(uvMin.x, uvMax.y), mipLevel).r);
  maxHiZDepth = max(maxHiZDepth, textureSampleLevel(hiZTexture, hiZSampler, uvMax, mipLevel).r);
  
  // For reverse-Z: object is occluded if its near depth is less than Hi-Z max depth
  // (smaller depth = farther from camera in reverse-Z)
  return nearDepth < maxHiZDepth;
}

// ============================================================================
// Combined Frustum + Hi-Z Occlusion Culling (with Parallel Prefix Sum)
// ============================================================================

/**
 * Main culling kernel with Hi-Z occlusion testing.
 * Two-stage test: frustum first (cheap), then Hi-Z (more expensive but precise).
 * Uses parallel prefix sum for efficient stream compaction.
 */
@compute @workgroup_size(64)
fn mainWithOcclusion(
  @builtin(global_invocation_id) globalId: vec3<u32>,
  @builtin(local_invocation_id) localId: vec3<u32>
) {
  let instanceIndex = globalId.x;
  let localIndex = localId.x;
  let maxInstances = u32(uniformsExt.misc.x);
  let hiZEnabled = uniformsExt.screenInfo.w > 0.5;
  
  // ========================================
  // Phase 1: Two-stage visibility test
  // ========================================
  var isVisible = false;
  
  if (instanceIndex < maxInstances) {
    let bounds = instanceBounds[instanceIndex];
    let center = bounds.xyz;
    let radius = bounds.w;
    
    // Stage 1: Frustum culling (cheap)
    isVisible = true;
    if (radius <= 0.0) {
      isVisible = false;
    } else {
      for (var i = 0u; i < 6u; i++) {
        let plane = uniformsExt.planes[i];
        let distance = dot(plane.xyz, center) + plane.w;
        if (distance < -radius) {
          isVisible = false;
          break;
        }
      }
    }
    
    // Stage 2: Hi-Z occlusion culling (more expensive, only if visible)
    if (isVisible && hiZEnabled) {
      if (isOccludedByHiZ(center, radius)) {
        isVisible = false;
      }
    }
  }
  
  // ========================================
  // Phase 2: Store flags for prefix sum
  // ========================================
  let visFlag = select(0u, 1u, isVisible);
  localVisibleFlags[localIndex] = visFlag;
  localPrefixSum[localIndex] = visFlag;
  localInstanceIndices[localIndex] = instanceIndex;
  workgroupBarrier();
  
  // ========================================
  // Phase 3: Parallel prefix sum
  // ========================================
  workgroupPrefixSum(localIndex);
  
  // ========================================
  // Phase 4: Reserve global space (single atomic per workgroup)
  // ========================================
  if (localIndex == 0u && sharedTotalCount > 0u) {
    sharedGlobalOffset = atomicAdd(&visibleCount, sharedTotalCount);
  }
  workgroupBarrier();
  
  // ========================================
  // Phase 5: All visible threads write in parallel
  // ========================================
  if (isVisible && sharedTotalCount > 0u) {
    let localWriteOffset = localPrefixSum[localIndex];
    let globalWriteOffset = sharedGlobalOffset + localWriteOffset;
    visibleIndices[globalWriteOffset] = instanceIndex;
  }
}

// ============================================================================
// Reset Pass: Clear counters before culling
// ============================================================================

@compute @workgroup_size(1)
fn reset() {
  atomicStore(&visibleCount, 0u);
}
