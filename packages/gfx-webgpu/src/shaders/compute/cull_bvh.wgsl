/**
 * GPU BVH Frustum Culling Compute Shader
 * 
 * Hierarchical culling using a linearized BVH structure.
 * Optimal for large scenes (10k+ instances) where hierarchical early-out
 * provides significant performance gains.
 * 
 * Algorithm:
 * 1. Traverse BVH nodes using stack-based iteration
 * 2. Skip entire subtrees when parent node fails frustum test
 * 3. When reaching leaf nodes, mark instances as visible
 * 
 * BVH Structure (linearized):
 * - Internal nodes: bounds + left/right child indices
 * - Leaf nodes: bounds + instance index + count
 */

// ============================================================================
// Constants
// ============================================================================

const WORKGROUP_SIZE: u32 = 64u;
const MAX_STACK_DEPTH: u32 = 32u;  // Max BVH depth (supports 2^32 instances)

// Node flags
const NODE_FLAG_LEAF: u32 = 0x80000000u;

// ============================================================================
// Data Structures
// ============================================================================

struct CullUniforms {
  planes: array<vec4<f32>, 6>,
  // misc.x = nodeCount, misc.y = indexCount, misc.z = flags, misc.w = reserved
  misc: vec4<f32>,
  // Camera position for distance-based child ordering (frustum-coherent traversal)
  cameraPos: vec4<f32>,
}

// Stack entry with frustum mask for optimized traversal
struct StackEntry {
  nodeIndex: u32,
  frustumMask: u32,  // Bitmask of planes still needing test (0x3F = all 6 planes)
}

// Linearized BVH node (32 bytes, cache-friendly)
struct BVHNode {
  // Bounding box min (xyz) + child0/instanceStart (w as u32)
  boundsMin: vec4<f32>,
  // Bounding box max (xyz) + child1/instanceCount (w as u32)
  boundsMax: vec4<f32>,
}

// Instance bounds (can be different from BVH node bounds for precision)
struct InstanceData {
  bounds: vec4<f32>,  // xyz = center, w = radius
}

// ============================================================================
// Bindings
// ============================================================================

@group(0) @binding(0) var<uniform> uniforms: CullUniforms;
@group(0) @binding(1) var<storage, read> bvhNodes: array<BVHNode>;
@group(0) @binding(2) var<storage, read> instanceBounds: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> visibleIndices: array<u32>;
@group(0) @binding(4) var<storage, read_write> visibleCount: atomic<u32>;
@group(0) @binding(5) var<storage, read_write> drawCommand: array<u32, 5>;

// ============================================================================
// Workgroup Shared Memory
// ============================================================================

// Local visibility buffer for workgroup
var<workgroup> localVisibleIndices: array<u32, 256>;  // Max visible per workgroup
var<workgroup> localVisibleCount: atomic<u32>;

// Shared node stack for cooperative traversal
var<workgroup> sharedNodeStack: array<u32, 64>;
var<workgroup> sharedStackSize: atomic<u32>;

// ============================================================================
// Frustum Test Functions
// ============================================================================

/**
 * Tests AABB against frustum using separating axis theorem.
 * Returns: -1 = outside, 0 = intersecting, 1 = fully inside
 */
fn testAABBFrustum(aabbMin: vec3<f32>, aabbMax: vec3<f32>) -> i32 {
  var result: i32 = 1;  // Assume fully inside
  
  for (var i = 0u; i < 6u; i++) {
    let plane = uniforms.planes[i];
    
    // P-vertex (farthest point in direction of normal)
    let px = select(aabbMin.x, aabbMax.x, plane.x >= 0.0);
    let py = select(aabbMin.y, aabbMax.y, plane.y >= 0.0);
    let pz = select(aabbMin.z, aabbMax.z, plane.z >= 0.0);
    
    // N-vertex (closest point in direction of normal)  
    let nx = select(aabbMax.x, aabbMin.x, plane.x >= 0.0);
    let ny = select(aabbMax.y, aabbMin.y, plane.y >= 0.0);
    let nz = select(aabbMax.z, aabbMin.z, plane.z >= 0.0);
    
    let pDist = dot(plane.xyz, vec3<f32>(px, py, pz)) + plane.w;
    let nDist = dot(plane.xyz, vec3<f32>(nx, ny, nz)) + plane.w;
    
    // P-vertex outside means completely outside
    if (pDist < 0.0) {
      return -1;
    }
    
    // N-vertex outside means intersecting (not fully inside)
    if (nDist < 0.0) {
      result = 0;
    }
  }
  
  return result;
}

/**
 * Tests AABB against frustum with plane mask optimization.
 * Only tests planes indicated by inputMask.
 * Returns: (visResult, outputMask) where:
 *   visResult: -1 = outside, 0 = intersecting, 1 = fully inside
 *   outputMask: Planes that still need testing for children
 */
fn testAABBFrustumMasked(aabbMin: vec3<f32>, aabbMax: vec3<f32>, inputMask: u32) -> vec2<i32> {
  var result: i32 = 1;  // Assume fully inside
  var outputMask: u32 = 0u;
  
  for (var i = 0u; i < 6u; i++) {
    // Skip planes already satisfied by parent
    if ((inputMask & (1u << i)) == 0u) {
      continue;
    }
    
    let plane = uniforms.planes[i];
    
    // P-vertex (farthest point in direction of normal)
    let px = select(aabbMin.x, aabbMax.x, plane.x >= 0.0);
    let py = select(aabbMin.y, aabbMax.y, plane.y >= 0.0);
    let pz = select(aabbMin.z, aabbMax.z, plane.z >= 0.0);
    
    // N-vertex (closest point in direction of normal)  
    let nx = select(aabbMax.x, aabbMin.x, plane.x >= 0.0);
    let ny = select(aabbMax.y, aabbMin.y, plane.y >= 0.0);
    let nz = select(aabbMax.z, aabbMin.z, plane.z >= 0.0);
    
    let pDist = dot(plane.xyz, vec3<f32>(px, py, pz)) + plane.w;
    let nDist = dot(plane.xyz, vec3<f32>(nx, ny, nz)) + plane.w;
    
    // P-vertex outside means completely outside
    if (pDist < 0.0) {
      return vec2<i32>(-1, 0);
    }
    
    // N-vertex outside means intersecting, children still need this plane test
    if (nDist < 0.0) {
      result = 0;
      outputMask = outputMask | (1u << i);
    }
    // If both P and N vertices inside, plane is satisfied for all children
  }
  
  return vec2<i32>(result, i32(outputMask));
}

/**
 * Computes distance from camera to AABB center.
 * Used for frustum-coherent child ordering.
 */
fn distanceToAABB(aabbMin: vec3<f32>, aabbMax: vec3<f32>) -> f32 {
  let center = (aabbMin + aabbMax) * 0.5;
  return distance(uniforms.cameraPos.xyz, center);
}

/**
 * Simple visibility test for bounding sphere.
 */
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
// BVH Traversal - Per-Thread Stack
// ============================================================================

/**
 * Traverses BVH using per-thread stack.
 * Each thread handles a different starting subtree for parallelism.
 */
@compute @workgroup_size(64)
fn traverseBVH(
  @builtin(global_invocation_id) globalId: vec3<u32>,
  @builtin(local_invocation_id) localId: vec3<u32>
) {
  let threadId = globalId.x;
  let localIndex = localId.x;
  let nodeCount = u32(uniforms.misc.x);
  
  // Initialize local counter
  if (localIndex == 0u) {
    atomicStore(&localVisibleCount, 0u);
  }
  workgroupBarrier();
  
  // Early exit if no nodes
  if (nodeCount == 0u) {
    return;
  }
  
  // Each workgroup processes a portion of the BVH
  // For very large BVHs, we start from different depths
  var stack: array<u32, MAX_STACK_DEPTH>;
  var stackPtr: u32 = 0u;
  
  // Start from root (node 0)
  if (threadId == 0u) {
    stack[stackPtr] = 0u;
    stackPtr = 1u;
  }
  
  // Simple single-threaded traversal (thread 0 only for correctness)
  // TODO: Implement parallel BVH traversal with work stealing
  if (threadId != 0u) {
    return;
  }
  
  while (stackPtr > 0u) {
    stackPtr -= 1u;
    let nodeIndex = stack[stackPtr];
    
    if (nodeIndex >= nodeCount) {
      continue;
    }
    
    let node = bvhNodes[nodeIndex];
    let aabbMin = node.boundsMin.xyz;
    let aabbMax = node.boundsMax.xyz;
    
    // Test node against frustum
    let visResult = testAABBFrustum(aabbMin, aabbMax);
    
    // Skip if completely outside
    if (visResult == -1) {
      continue;
    }
    
    // Check if leaf node
    let child0 = bitcast<u32>(node.boundsMin.w);
    let child1 = bitcast<u32>(node.boundsMax.w);
    
    let isLeaf = (child0 & NODE_FLAG_LEAF) != 0u;
    
    if (isLeaf) {
      // Leaf node: child0 contains instance index (masked), child1 contains count
      let instanceStart = child0 & (~NODE_FLAG_LEAF);
      let instanceCount = child1;
      
      // If node is fully inside frustum, add all instances without individual tests
      if (visResult == 1) {
        // Fully inside - batch add instances
        for (var i = 0u; i < instanceCount; i++) {
          let instanceIdx = instanceStart + i;
          let writeIdx = atomicAdd(&localVisibleCount, 1u);
          if (writeIdx < 256u) {
            localVisibleIndices[writeIdx] = instanceIdx;
          }
        }
      } else {
        // Intersecting - test individual instances
        for (var i = 0u; i < instanceCount; i++) {
          let instanceIdx = instanceStart + i;
          let bounds = instanceBounds[instanceIdx];
          
          if (isSphereFrustumVisible(bounds.xyz, bounds.w)) {
            let writeIdx = atomicAdd(&localVisibleCount, 1u);
            if (writeIdx < 256u) {
              localVisibleIndices[writeIdx] = instanceIdx;
            }
          }
        }
      }
    } else {
      // Internal node: push children onto stack
      // Push in reverse order so left child is processed first
      if (stackPtr < MAX_STACK_DEPTH - 1u) {
        if (child1 < nodeCount) {
          stack[stackPtr] = child1;
          stackPtr += 1u;
        }
        if (child0 < nodeCount) {
          stack[stackPtr] = child0;
          stackPtr += 1u;
        }
      }
    }
  }
  
  workgroupBarrier();
  
  // Write local results to global buffer
  if (localIndex == 0u) {
    let localCount = min(atomicLoad(&localVisibleCount), 256u);
    if (localCount > 0u) {
      let globalOffset = atomicAdd(&visibleCount, localCount);
      for (var i = 0u; i < localCount; i++) {
        visibleIndices[globalOffset + i] = localVisibleIndices[i];
      }
    }
  }
}

// ============================================================================
// Frustum-Coherent BVH Traversal
// ============================================================================

/**
 * Traverses BVH with frustum-coherent optimizations:
 * 1. Child ordering by distance to camera (process near children first)
 * 2. Frustum mask propagation (skip redundant plane tests)
 * 
 * This improves cache coherence and reduces redundant computations.
 */
@compute @workgroup_size(64)
fn traverseBVHCoherent(
  @builtin(global_invocation_id) globalId: vec3<u32>,
  @builtin(local_invocation_id) localId: vec3<u32>
) {
  let threadId = globalId.x;
  let localIndex = localId.x;
  let nodeCount = u32(uniforms.misc.x);
  
  // Initialize local counter
  if (localIndex == 0u) {
    atomicStore(&localVisibleCount, 0u);
  }
  workgroupBarrier();
  
  if (nodeCount == 0u || threadId != 0u) {
    return;
  }
  
  // Stack with frustum mask for optimized traversal
  var stack: array<StackEntry, MAX_STACK_DEPTH>;
  var stackPtr: u32 = 1u;
  
  // Start with root, all 6 planes need testing (0x3F = 0b111111)
  stack[0] = StackEntry(0u, 0x3Fu);
  
  while (stackPtr > 0u) {
    stackPtr -= 1u;
    let entry = stack[stackPtr];
    let nodeIndex = entry.nodeIndex;
    let frustumMask = entry.frustumMask;
    
    if (nodeIndex >= nodeCount) {
      continue;
    }
    
    let node = bvhNodes[nodeIndex];
    let aabbMin = node.boundsMin.xyz;
    let aabbMax = node.boundsMax.xyz;
    
    // Test with plane mask propagation
    let testResult = testAABBFrustumMasked(aabbMin, aabbMax, frustumMask);
    let visResult = testResult.x;
    let childMask = u32(testResult.y);
    
    // Skip if completely outside
    if (visResult == -1) {
      continue;
    }
    
    let child0 = bitcast<u32>(node.boundsMin.w);
    let child1 = bitcast<u32>(node.boundsMax.w);
    let isLeaf = (child0 & NODE_FLAG_LEAF) != 0u;
    
    if (isLeaf) {
      // Leaf node processing (same as before)
      let instanceStart = child0 & (~NODE_FLAG_LEAF);
      let instanceCount = child1;
      
      if (visResult == 1) {
        // Fully inside - batch add instances
        for (var i = 0u; i < instanceCount; i++) {
          let instanceIdx = instanceStart + i;
          let writeIdx = atomicAdd(&localVisibleCount, 1u);
          if (writeIdx < 256u) {
            localVisibleIndices[writeIdx] = instanceIdx;
          }
        }
      } else {
        // Intersecting - test individual instances
        for (var i = 0u; i < instanceCount; i++) {
          let instanceIdx = instanceStart + i;
          let bounds = instanceBounds[instanceIdx];
          
          if (isSphereFrustumVisible(bounds.xyz, bounds.w)) {
            let writeIdx = atomicAdd(&localVisibleCount, 1u);
            if (writeIdx < 256u) {
              localVisibleIndices[writeIdx] = instanceIdx;
            }
          }
        }
      }
    } else {
      // Internal node: push children with distance-based ordering
      if (stackPtr < MAX_STACK_DEPTH - 1u) {
        // Get child AABBs for distance comparison
        let child0Node = bvhNodes[child0];
        let child1Node = bvhNodes[child1];
        
        let child0Center = (child0Node.boundsMin.xyz + child0Node.boundsMax.xyz) * 0.5;
        let child1Center = (child1Node.boundsMin.xyz + child1Node.boundsMax.xyz) * 0.5;
        
        let dist0 = distance(uniforms.cameraPos.xyz, child0Center);
        let dist1 = distance(uniforms.cameraPos.xyz, child1Center);
        
        // Push far child first (will be processed last)
        // This processes near-to-far for better cache coherence
        if (dist0 < dist1) {
          // child0 is nearer, process it last (push first)
          if (child1 < nodeCount) {
            stack[stackPtr] = StackEntry(child1, childMask);
            stackPtr += 1u;
          }
          if (child0 < nodeCount) {
            stack[stackPtr] = StackEntry(child0, childMask);
            stackPtr += 1u;
          }
        } else {
          // child1 is nearer, process it last (push first)
          if (child0 < nodeCount) {
            stack[stackPtr] = StackEntry(child0, childMask);
            stackPtr += 1u;
          }
          if (child1 < nodeCount) {
            stack[stackPtr] = StackEntry(child1, childMask);
            stackPtr += 1u;
          }
        }
      }
    }
  }
  
  workgroupBarrier();
  
  // Write local results to global buffer
  if (localIndex == 0u) {
    let localCount = min(atomicLoad(&localVisibleCount), 256u);
    if (localCount > 0u) {
      let globalOffset = atomicAdd(&visibleCount, localCount);
      for (var i = 0u; i < localCount; i++) {
        visibleIndices[globalOffset + i] = localVisibleIndices[i];
      }
    }
  }
}

// ============================================================================
// Parallel BVH Traversal - Work Distribution
// ============================================================================

/**
 * First pass: identify top-level subtrees to distribute across workgroups.
 * This enables better GPU utilization for unbalanced BVHs.
 */
@compute @workgroup_size(1)
fn distributeWork() {
  let nodeCount = u32(uniforms.misc.x);
  if (nodeCount == 0u) {
    return;
  }
  
  // Find subtrees at depth ~4-6 for workgroup distribution
  // Each subtree will be processed by a separate workgroup
  // Implementation depends on BVH structure
}

// ============================================================================
// Two-Level Culling: Coarse (BVH Nodes) + Fine (Instances)
// ============================================================================

/**
 * Coarse culling pass: test BVH nodes and output potentially visible node ranges.
 * Used when BVH is too deep for single-pass traversal.
 */
struct NodeRange {
  nodeIndex: u32,
  visibilityMask: u32,  // Bitmask of which frustum planes node intersects
}

@group(1) @binding(0) var<storage, read_write> visibleNodeRanges: array<NodeRange>;
@group(1) @binding(1) var<storage, read_write> visibleNodeCount: atomic<u32>;

@compute @workgroup_size(64)
fn coarseCull(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let nodeIndex = globalId.x;
  let nodeCount = u32(uniforms.misc.x);
  
  if (nodeIndex >= nodeCount) {
    return;
  }
  
  let node = bvhNodes[nodeIndex];
  
  // Only process leaf nodes in coarse pass
  let child0 = bitcast<u32>(node.boundsMin.w);
  let isLeaf = (child0 & NODE_FLAG_LEAF) != 0u;
  
  if (!isLeaf) {
    return;
  }
  
  let aabbMin = node.boundsMin.xyz;
  let aabbMax = node.boundsMax.xyz;
  
  let visResult = testAABBFrustum(aabbMin, aabbMax);
  
  if (visResult >= 0) {  // Visible or intersecting
    let writeIdx = atomicAdd(&visibleNodeCount, 1u);
    visibleNodeRanges[writeIdx] = NodeRange(
      nodeIndex,
      select(0u, 0xFFFFFFFFu, visResult == 1)  // Full visibility mask if fully inside
    );
  }
}

/**
 * Fine culling pass: test individual instances from visible nodes.
 */
@compute @workgroup_size(64)
fn fineCull(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let rangeIndex = globalId.x;
  let rangeCount = atomicLoad(&visibleNodeCount);
  
  if (rangeIndex >= rangeCount) {
    return;
  }
  
  let nodeRange = visibleNodeRanges[rangeIndex];
  let node = bvhNodes[nodeRange.nodeIndex];
  
  let child0 = bitcast<u32>(node.boundsMin.w);
  let child1 = bitcast<u32>(node.boundsMax.w);
  
  let instanceStart = child0 & (~NODE_FLAG_LEAF);
  let instanceCount = child1;
  
  // If fully visible, add all instances
  if (nodeRange.visibilityMask == 0xFFFFFFFFu) {
    for (var i = 0u; i < instanceCount; i++) {
      let writeIdx = atomicAdd(&visibleCount, 1u);
      visibleIndices[writeIdx] = instanceStart + i;
    }
  } else {
    // Test individual instances
    for (var i = 0u; i < instanceCount; i++) {
      let instanceIdx = instanceStart + i;
      let bounds = instanceBounds[instanceIdx];
      
      if (isSphereFrustumVisible(bounds.xyz, bounds.w)) {
        let writeIdx = atomicAdd(&visibleCount, 1u);
        visibleIndices[writeIdx] = instanceIdx;
      }
    }
  }
}

// ============================================================================
// Finalize Pass
// ============================================================================

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

@compute @workgroup_size(1)
fn reset() {
  atomicStore(&visibleCount, 0u);
  atomicStore(&visibleNodeCount, 0u);
}

