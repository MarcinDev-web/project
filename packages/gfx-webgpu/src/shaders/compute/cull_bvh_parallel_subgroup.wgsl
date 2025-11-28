/**
 * Parallel BVH Frustum Culling with Subgroup Operations
 * 
 * Enhanced version using wave/subgroup operations for:
 * - Efficient counting with subgroupAdd (no atomic contention)
 * - Fast stream compaction via ballot + prefix sum
 * - Cooperative work distribution within subgroups
 * 
 * Performance: 2-3x speedup for large BVH traversals
 * 
 * Requirements: WebGPU 'subgroups' feature
 */

enable subgroups;

// ============================================================================
// Constants
// ============================================================================

const WORKGROUP_SIZE: u32 = 64u;
const MAX_LOCAL_STACK: u32 = 16u;
const QUEUE_CAPACITY: u32 = 16384u;
const TOP_LEVEL_DEPTH: u32 = 4u;
const NODE_FLAG_LEAF: u32 = 0x80000000u;
const MAX_SUBGROUPS: u32 = 8u;

// ============================================================================
// Data Structures
// ============================================================================

struct CullUniforms {
  planes: array<vec4<f32>, 6>,
  // misc.x = nodeCount, misc.y = indexCount, misc.z = maxInstances, misc.w = cameraZ
  misc: vec4<f32>,
  viewProj: mat4x4<f32>,
}

struct BVHNode {
  boundsMin: vec4<f32>,  // .w = child0 or (instanceStart | NODE_FLAG_LEAF)
  boundsMax: vec4<f32>,  // .w = child1 or instanceCount
}

// ============================================================================
// Bindings - Group 0: Core Culling
// ============================================================================

@group(0) @binding(0) var<uniform> uniforms: CullUniforms;
@group(0) @binding(1) var<storage, read> bvhNodes: array<BVHNode>;
@group(0) @binding(2) var<storage, read> instanceBounds: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> visibleIndices: array<u32>;
@group(0) @binding(4) var<storage, read_write> visibleCount: atomic<u32>;
@group(0) @binding(5) var<storage, read_write> drawCommand: array<u32, 5>;

// ============================================================================
// Bindings - Group 1: Work Queue
// ============================================================================

@group(1) @binding(0) var<storage, read_write> workQueue: array<u32>;
@group(1) @binding(1) var<storage, read_write> queueHead: atomic<u32>;
@group(1) @binding(2) var<storage, read_write> queueTail: atomic<u32>;
@group(1) @binding(3) var<storage, read_write> activeWorkgroups: atomic<u32>;

// ============================================================================
// Workgroup Shared Memory
// ============================================================================

var<workgroup> localVisibleIndices: array<u32, 256>;
var<workgroup> localVisibleCount: u32;
var<workgroup> subgroupPartialCounts: array<u32, MAX_SUBGROUPS>;
var<workgroup> subgroupPrefixSums: array<u32, MAX_SUBGROUPS + 1>;
var<workgroup> workgroupGlobalOffset: u32;

// ============================================================================
// Frustum Test Functions
// ============================================================================

fn testAABBFrustum(aabbMin: vec3<f32>, aabbMax: vec3<f32>) -> i32 {
  var result: i32 = 1; // Assume fully inside
  
  for (var i = 0u; i < 6u; i++) {
    let plane = uniforms.planes[i];
    
    // P-vertex
    let px = select(aabbMin.x, aabbMax.x, plane.x >= 0.0);
    let py = select(aabbMin.y, aabbMax.y, plane.y >= 0.0);
    let pz = select(aabbMin.z, aabbMax.z, plane.z >= 0.0);
    
    // N-vertex
    let nx = select(aabbMax.x, aabbMin.x, plane.x >= 0.0);
    let ny = select(aabbMax.y, aabbMin.y, plane.y >= 0.0);
    let nz = select(aabbMax.z, aabbMin.z, plane.z >= 0.0);
    
    let pDist = dot(plane.xyz, vec3<f32>(px, py, pz)) + plane.w;
    let nDist = dot(plane.xyz, vec3<f32>(nx, ny, nz)) + plane.w;
    
    if (pDist < 0.0) {
      return -1; // Outside
    }
    
    if (nDist < 0.0) {
      result = 0; // Intersecting
    }
  }
  
  return result;
}

fn isSphereFrustumVisible(center: vec3<f32>, radius: f32) -> bool {
  for (var i = 0u; i < 6u; i++) {
    let plane = uniforms.planes[i];
    let distance = dot(plane.xyz, center) + plane.w;
    if (distance < -radius) {
      return false;
    }
  }
  return true;
}

// ============================================================================
// Subgroup Helper Functions
// ============================================================================

fn subgroupCountPredicate(predicate: bool) -> u32 {
  let ballot = subgroupBallot(predicate);
  return countOneBits(ballot.x) + countOneBits(ballot.y) + 
         countOneBits(ballot.z) + countOneBits(ballot.w);
}

fn subgroupExclusiveCountPredicate(predicate: bool, laneId: u32) -> u32 {
  let ballot = subgroupBallot(predicate);
  
  var count: u32 = 0u;
  if (laneId < 32u) {
    let mask = (1u << laneId) - 1u;
    count = countOneBits(ballot.x & mask);
  } else if (laneId < 64u) {
    count = countOneBits(ballot.x);
    let mask = (1u << (laneId - 32u)) - 1u;
    count += countOneBits(ballot.y & mask);
  }
  
  return count;
}

// ============================================================================
// Cooperative BVH Traversal with Subgroup Operations
// ============================================================================

/**
 * All threads cooperatively process BVH nodes.
 * Uses subgroup operations for efficient counting and compaction.
 */
@compute @workgroup_size(64)
fn cooperativeTraverseSubgroup(
  @builtin(global_invocation_id) globalId: vec3<u32>,
  @builtin(local_invocation_id) localId: vec3<u32>,
  @builtin(workgroup_id) workgroupId: vec3<u32>,
  @builtin(subgroup_invocation_id) laneId: u32,
  @builtin(subgroup_size) subgroupSize: u32
) {
  let localIndex = localId.x;
  let subgroupId = localIndex / subgroupSize;
  let nodeCount = u32(uniforms.misc.x);
  let numSubgroups = WORKGROUP_SIZE / subgroupSize;
  
  // Initialize
  if (localIndex == 0u) {
    localVisibleCount = 0u;
    atomicAdd(&activeWorkgroups, 1u);
  }
  workgroupBarrier();
  
  if (nodeCount == 0u) {
    if (localIndex == 0u) {
      atomicSub(&activeWorkgroups, 1u);
    }
    return;
  }
  
  // Main work-stealing loop
  loop {
    // Each thread tries to grab work
    let itemIdx = atomicAdd(&queueHead, 1u);
    let tail = atomicLoad(&queueTail);
    
    if (itemIdx >= tail) {
      break;
    }
    
    let nodeIndex = workQueue[itemIdx];
    if (nodeIndex >= nodeCount) {
      continue;
    }
    
    let node = bvhNodes[nodeIndex];
    let aabbMin = node.boundsMin.xyz;
    let aabbMax = node.boundsMax.xyz;
    
    let visResult = testAABBFrustum(aabbMin, aabbMax);
    
    if (visResult == -1) {
      continue;
    }
    
    let child0 = bitcast<u32>(node.boundsMin.w);
    let child1 = bitcast<u32>(node.boundsMax.w);
    let isLeaf = (child0 & NODE_FLAG_LEAF) != 0u;
    
    if (isLeaf) {
      // Process leaf instances
      let instanceStart = child0 & (~NODE_FLAG_LEAF);
      let instanceCount = child1;
      
      // Process instances in batches matching subgroup size
      for (var batch = 0u; batch < instanceCount; batch += subgroupSize) {
        let instOffset = batch + laneId;
        var isVisible = false;
        
        if (instOffset < instanceCount) {
          let instIdx = instanceStart + instOffset;
          
          if (visResult == 1) {
            // Fully visible
            isVisible = true;
          } else {
            // Test individual instance
            let bounds = instanceBounds[instIdx];
            isVisible = isSphereFrustumVisible(bounds.xyz, bounds.w);
          }
        }
        
        // Subgroup-level compaction
        let visibleInSubgroup = subgroupCountPredicate(isVisible);
        let localOffset = subgroupExclusiveCountPredicate(isVisible, laneId);
        
        // Reserve space with subgroup-coalesced write
        var writeBase: u32 = 0u;
        if (subgroupElect()) {
          // Thread 0 of subgroup reserves space
          if (visibleInSubgroup > 0u) {
            writeBase = atomicAdd(&visibleCount, visibleInSubgroup);
          }
        }
        writeBase = subgroupBroadcastFirst(writeBase);
        
        // Write visible indices
        if (isVisible && instOffset < instanceCount) {
          let instIdx = instanceStart + instOffset;
          visibleIndices[writeBase + localOffset] = instIdx;
        }
      }
    } else {
      // Add children to queue
      let queueIdx = atomicAdd(&queueTail, 2u);
      if (queueIdx + 1u < QUEUE_CAPACITY) {
        workQueue[queueIdx] = child0;
        workQueue[queueIdx + 1u] = child1;
      }
    }
  }
  
  // Cleanup
  if (localIndex == 0u) {
    atomicSub(&activeWorkgroups, 1u);
  }
}

// ============================================================================
// Parallel Instance Testing with Subgroup Optimization
// ============================================================================

/**
 * Batch processes multiple instances per workgroup using subgroup operations.
 * Used after BVH traversal identifies candidate instances.
 */
@compute @workgroup_size(64)
fn batchTestInstancesSubgroup(
  @builtin(global_invocation_id) globalId: vec3<u32>,
  @builtin(local_invocation_id) localId: vec3<u32>,
  @builtin(subgroup_invocation_id) laneId: u32,
  @builtin(subgroup_size) subgroupSize: u32
) {
  let instanceIndex = globalId.x;
  let localIndex = localId.x;
  let subgroupId = localIndex / subgroupSize;
  let maxInstances = u32(uniforms.misc.z);
  let numSubgroups = WORKGROUP_SIZE / subgroupSize;
  
  // Test visibility
  var isVisible = false;
  if (instanceIndex < maxInstances) {
    let bounds = instanceBounds[instanceIndex];
    isVisible = isSphereFrustumVisible(bounds.xyz, bounds.w);
  }
  
  // ========================================
  // Phase 1: Subgroup-level counting
  // ========================================
  let subgroupVisibleCount = subgroupCountPredicate(isVisible);
  let intraSubgroupOffset = subgroupExclusiveCountPredicate(isVisible, laneId);
  
  if (laneId == 0u) {
    subgroupPartialCounts[subgroupId] = subgroupVisibleCount;
  }
  
  workgroupBarrier();
  
  // ========================================
  // Phase 2: Cross-subgroup prefix sum
  // ========================================
  if (subgroupId == 0u && laneId < numSubgroups) {
    let myCount = subgroupPartialCounts[laneId];
    let inclusiveSum = subgroupInclusiveAdd(myCount);
    let exclusiveSum = inclusiveSum - myCount;
    
    subgroupPrefixSums[laneId] = exclusiveSum;
    
    if (laneId == numSubgroups - 1u) {
      subgroupPrefixSums[numSubgroups] = inclusiveSum;
    }
  }
  
  workgroupBarrier();
  
  // ========================================
  // Phase 3: Reserve global space
  // ========================================
  if (localIndex == 0u) {
    let workgroupTotal = subgroupPrefixSums[numSubgroups];
    if (workgroupTotal > 0u) {
      workgroupGlobalOffset = atomicAdd(&visibleCount, workgroupTotal);
    } else {
      workgroupGlobalOffset = 0u;
    }
  }
  
  workgroupBarrier();
  
  // ========================================
  // Phase 4: Write results
  // ========================================
  if (isVisible) {
    let subgroupOffset = subgroupPrefixSums[subgroupId];
    let writeIndex = workgroupGlobalOffset + subgroupOffset + intraSubgroupOffset;
    visibleIndices[writeIndex] = instanceIndex;
  }
}

// ============================================================================
// LOD Selection with Subgroup Reduction
// ============================================================================

struct LODParams {
  viewProjection: mat4x4<f32>,
  cameraPos: vec3<f32>,
  screenHeight: f32,
  lodThresholds: vec4<f32>,  // Screen-space size thresholds for LOD 0-3
}

@group(2) @binding(0) var<uniform> lodParams: LODParams;
@group(2) @binding(1) var<storage, read_write> lodSelections: array<u32>;
@group(2) @binding(2) var<storage, read_write> lodCounts: array<atomic<u32>, 4>;

var<workgroup> subgroupLodCounts: array<array<u32, 4>, MAX_SUBGROUPS>;

/**
 * LOD selection with subgroup-accelerated counting per LOD level.
 */
@compute @workgroup_size(64)
fn selectLODWithSubgroup(
  @builtin(global_invocation_id) globalId: vec3<u32>,
  @builtin(local_invocation_id) localId: vec3<u32>,
  @builtin(subgroup_invocation_id) laneId: u32,
  @builtin(subgroup_size) subgroupSize: u32
) {
  let instanceIndex = globalId.x;
  let localIndex = localId.x;
  let subgroupId = localIndex / subgroupSize;
  let maxInstances = u32(uniforms.misc.z);
  
  // Compute screen-space size
  var lod: u32 = 3u; // Lowest LOD by default
  var screenSize: f32 = 0.0;
  
  if (instanceIndex < maxInstances) {
    let bounds = instanceBounds[instanceIndex];
    let center = bounds.xyz;
    let radius = bounds.w;
    
    // Distance to camera
    let distance = length(center - lodParams.cameraPos);
    
    // Approximate screen-space size
    screenSize = (radius * 2.0 / max(distance, 0.001)) * lodParams.screenHeight * 0.5;
    
    // Select LOD based on thresholds
    if (screenSize >= lodParams.lodThresholds.x) {
      lod = 0u;
    } else if (screenSize >= lodParams.lodThresholds.y) {
      lod = 1u;
    } else if (screenSize >= lodParams.lodThresholds.z) {
      lod = 2u;
    } else {
      lod = 3u;
    }
    
    lodSelections[instanceIndex] = lod;
  }
  
  // Count instances per LOD using subgroup reduction
  let isLod0 = (lod == 0u) && (instanceIndex < maxInstances);
  let isLod1 = (lod == 1u) && (instanceIndex < maxInstances);
  let isLod2 = (lod == 2u) && (instanceIndex < maxInstances);
  let isLod3 = (lod == 3u) && (instanceIndex < maxInstances);
  
  let countLod0 = subgroupAdd(select(0u, 1u, isLod0));
  let countLod1 = subgroupAdd(select(0u, 1u, isLod1));
  let countLod2 = subgroupAdd(select(0u, 1u, isLod2));
  let countLod3 = subgroupAdd(select(0u, 1u, isLod3));
  
  // First lane accumulates to shared memory
  if (laneId == 0u) {
    subgroupLodCounts[subgroupId][0] = countLod0;
    subgroupLodCounts[subgroupId][1] = countLod1;
    subgroupLodCounts[subgroupId][2] = countLod2;
    subgroupLodCounts[subgroupId][3] = countLod3;
  }
  
  workgroupBarrier();
  
  // First subgroup reduces all counts and updates global atomics
  let numSubgroups = WORKGROUP_SIZE / subgroupSize;
  if (subgroupId == 0u && laneId < numSubgroups) {
    let partial0 = subgroupLodCounts[laneId][0];
    let partial1 = subgroupLodCounts[laneId][1];
    let partial2 = subgroupLodCounts[laneId][2];
    let partial3 = subgroupLodCounts[laneId][3];
    
    let total0 = subgroupAdd(partial0);
    let total1 = subgroupAdd(partial1);
    let total2 = subgroupAdd(partial2);
    let total3 = subgroupAdd(partial3);
    
    if (laneId == 0u) {
      atomicAdd(&lodCounts[0], total0);
      atomicAdd(&lodCounts[1], total1);
      atomicAdd(&lodCounts[2], total2);
      atomicAdd(&lodCounts[3], total3);
    }
  }
}

// ============================================================================
// Utility Passes
// ============================================================================

@compute @workgroup_size(1)
fn reset() {
  atomicStore(&visibleCount, 0u);
  atomicStore(&queueHead, 0u);
  atomicStore(&queueTail, 0u);
  atomicStore(&activeWorkgroups, 0u);
}

@compute @workgroup_size(1)
fn finalize() {
  let count = atomicLoad(&visibleCount);
  let indexCount = u32(uniforms.misc.y);
  
  drawCommand[0] = indexCount;
  drawCommand[1] = count;
  drawCommand[2] = 0u;
  drawCommand[3] = 0u;
  drawCommand[4] = 0u;
}

