/**
 * GPU BVH Construction using LBVH (Linear BVH)
 * 
 * Algorithm:
 * 1. computeMortonCodes: Calculate 30-bit Morton code for each instance
 * 2. radixSortLocal: Local workgroup radix sort
 * 3. radixSortGlobal: Global prefix sum and scatter
 * 4. buildRadixTree: Construct binary radix tree from sorted Morton codes
 * 5. computeNodeBounds: Bottom-up AABB calculation
 * 
 * Reference: "Maximizing Parallelism in the Construction of BVHs, Octrees, 
 *            and k-d Trees" - Karras 2012
 */

// ============================================================================
// Constants
// ============================================================================

const WORKGROUP_SIZE: u32 = 256u;
const RADIX_BITS: u32 = 4u;
const RADIX_BUCKETS: u32 = 16u;  // 2^RADIX_BITS
const MORTON_BITS: u32 = 30u;
const NODE_FLAG_LEAF: u32 = 0x80000000u;

// ============================================================================
// Data Structures
// ============================================================================

struct BuildUniforms {
  instanceCount: u32,
  sceneMinX: f32,
  sceneMinY: f32,
  sceneMinZ: f32,
  sceneExtentX: f32,
  sceneExtentY: f32,
  sceneExtentZ: f32,
  currentRadixPass: u32,
}

// Linearized BVH node (same format as cull shaders)
struct BVHNode {
  boundsMin: vec4<f32>,  // xyz=min, w=child0/instanceStart
  boundsMax: vec4<f32>,  // xyz=max, w=child1/instanceCount
}

// Morton code with original index
struct MortonPair {
  code: u32,
  index: u32,
}

// ============================================================================
// Bindings
// ============================================================================

@group(0) @binding(0) var<uniform> uniforms: BuildUniforms;
@group(0) @binding(1) var<storage, read> instanceBounds: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> mortonCodes: array<MortonPair>;
@group(0) @binding(3) var<storage, read_write> mortonCodesTemp: array<MortonPair>;
@group(0) @binding(4) var<storage, read_write> bvhNodes: array<BVHNode>;
@group(0) @binding(5) var<storage, read_write> nodeParents: array<i32>;

// Radix sort auxiliary buffers
@group(1) @binding(0) var<storage, read_write> histograms: array<u32>;
@group(1) @binding(1) var<storage, read_write> prefixSums: array<u32>;

// ============================================================================
// Workgroup Shared Memory
// ============================================================================

var<workgroup> localHistogram: array<atomic<u32>, RADIX_BUCKETS>;
var<workgroup> localPrefixSum: array<u32, RADIX_BUCKETS>;
var<workgroup> localMortonCodes: array<MortonPair, WORKGROUP_SIZE>;

// ============================================================================
// Morton Code Functions
// ============================================================================

/**
 * Expands a 10-bit value to 30 bits by inserting two zeros between each bit.
 * Used for interleaving x, y, z coordinates into Morton code.
 */
fn expandBits(v: u32) -> u32 {
  var x = v & 0x3FFu;  // 10 bits
  x = (x | (x << 16u)) & 0x030000FFu;
  x = (x | (x << 8u))  & 0x0300F00Fu;
  x = (x | (x << 4u))  & 0x030C30C3u;
  x = (x | (x << 2u))  & 0x09249249u;
  return x;
}

/**
 * Computes 30-bit Morton code from 3D position.
 * Position is normalized to [0,1] range based on scene bounds.
 */
fn computeMorton(pos: vec3<f32>) -> u32 {
  let sceneMin = vec3<f32>(uniforms.sceneMinX, uniforms.sceneMinY, uniforms.sceneMinZ);
  let sceneExtent = vec3<f32>(uniforms.sceneExtentX, uniforms.sceneExtentY, uniforms.sceneExtentZ);
  
  // Normalize to [0, 1]
  let normalized = clamp((pos - sceneMin) / sceneExtent, vec3<f32>(0.0), vec3<f32>(1.0));
  
  // Quantize to 10 bits per axis (0-1023)
  let quantized = vec3<u32>(normalized * 1023.0);
  
  // Interleave bits: x, y, z -> xyzxyzxyz...
  return expandBits(quantized.x) | (expandBits(quantized.y) << 1u) | (expandBits(quantized.z) << 2u);
}

// ============================================================================
// Pass 1: Compute Morton Codes
// ============================================================================

@compute @workgroup_size(256)
fn computeMortonCodes(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let instanceIndex = globalId.x;
  let instanceCount = uniforms.instanceCount;
  
  if (instanceIndex >= instanceCount) {
    return;
  }
  
  // Get instance center from bounds (xyz=center, w=radius)
  let bounds = instanceBounds[instanceIndex];
  let center = bounds.xyz;
  
  // Compute Morton code
  let mortonCode = computeMorton(center);
  
  // Store Morton code with original index
  mortonCodes[instanceIndex] = MortonPair(mortonCode, instanceIndex);
}

// ============================================================================
// Pass 2-9: Radix Sort (Local + Global)
// ============================================================================

/**
 * Extracts 4-bit digit from Morton code at given pass.
 */
fn getRadixDigit(code: u32, pass: u32) -> u32 {
  return (code >> (pass * RADIX_BITS)) & (RADIX_BUCKETS - 1u);
}

/**
 * Local radix sort histogram computation.
 * Each workgroup computes histogram for its portion of data.
 */
@compute @workgroup_size(256)
fn radixHistogram(@builtin(global_invocation_id) globalId: vec3<u32>,
                  @builtin(local_invocation_id) localId: vec3<u32>,
                  @builtin(workgroup_id) workgroupId: vec3<u32>) {
  let instanceIndex = globalId.x;
  let localIndex = localId.x;
  let instanceCount = uniforms.instanceCount;
  let pass = uniforms.currentRadixPass;
  
  // Initialize local histogram
  if (localIndex < RADIX_BUCKETS) {
    atomicStore(&localHistogram[localIndex], 0u);
  }
  workgroupBarrier();
  
  // Count digits in this workgroup
  if (instanceIndex < instanceCount) {
    let code = mortonCodes[instanceIndex].code;
    let digit = getRadixDigit(code, pass);
    atomicAdd(&localHistogram[digit], 1u);
  }
  workgroupBarrier();
  
  // Store workgroup histogram to global memory
  if (localIndex < RADIX_BUCKETS) {
    let histOffset = workgroupId.x * RADIX_BUCKETS + localIndex;
    histograms[histOffset] = atomicLoad(&localHistogram[localIndex]);
  }
}

/**
 * Prefix sum over all workgroup histograms.
 * Computes global offsets for each bucket.
 */
@compute @workgroup_size(256)
fn radixPrefixSum(@builtin(global_invocation_id) globalId: vec3<u32>,
                  @builtin(local_invocation_id) localId: vec3<u32>) {
  let index = globalId.x;
  let localIndex = localId.x;
  let instanceCount = uniforms.instanceCount;
  let numWorkgroups = (instanceCount + WORKGROUP_SIZE - 1u) / WORKGROUP_SIZE;
  let totalHistEntries = numWorkgroups * RADIX_BUCKETS;
  
  // Simple sequential prefix sum (can be parallelized further)
  if (index == 0u) {
    var sum = 0u;
    for (var i = 0u; i < totalHistEntries; i++) {
      let val = histograms[i];
      prefixSums[i] = sum;
      sum += val;
    }
  }
}

/**
 * Scatter elements to sorted positions.
 */
@compute @workgroup_size(256)
fn radixScatter(@builtin(global_invocation_id) globalId: vec3<u32>,
                @builtin(local_invocation_id) localId: vec3<u32>,
                @builtin(workgroup_id) workgroupId: vec3<u32>) {
  let instanceIndex = globalId.x;
  let localIndex = localId.x;
  let instanceCount = uniforms.instanceCount;
  let pass = uniforms.currentRadixPass;
  
  // Initialize local counts
  if (localIndex < RADIX_BUCKETS) {
    atomicStore(&localHistogram[localIndex], 0u);
    localPrefixSum[localIndex] = prefixSums[workgroupId.x * RADIX_BUCKETS + localIndex];
  }
  workgroupBarrier();
  
  if (instanceIndex >= instanceCount) {
    return;
  }
  
  // Load Morton pair
  let pair = mortonCodes[instanceIndex];
  let digit = getRadixDigit(pair.code, pass);
  
  // Get local offset within bucket
  let localOffset = atomicAdd(&localHistogram[digit], 1u);
  
  workgroupBarrier();
  
  // Compute global output position
  let globalOffset = localPrefixSum[digit] + localOffset;
  
  // Write to temp buffer
  mortonCodesTemp[globalOffset] = pair;
}

/**
 * Copy sorted results back to main buffer.
 */
@compute @workgroup_size(256)
fn radixCopyBack(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let index = globalId.x;
  let instanceCount = uniforms.instanceCount;
  
  if (index >= instanceCount) {
    return;
  }
  
  mortonCodes[index] = mortonCodesTemp[index];
}

// ============================================================================
// Pass 10: Build Radix Tree (Karras 2012 Algorithm)
// ============================================================================

/**
 * Counts leading zeros in XOR of two Morton codes.
 * Used to find split position in radix tree.
 */
fn commonUpperBits(code1: u32, code2: u32) -> i32 {
  return i32(countLeadingZeros(code1 ^ code2));
}

/**
 * Finds the range of keys covered by an internal node.
 */
fn findSplit(first: i32, last: i32) -> i32 {
  let firstCode = mortonCodes[first].code;
  let lastCode = mortonCodes[last].code;
  
  // Identical codes: split in the middle
  if (firstCode == lastCode) {
    return (first + last) >> 1;
  }
  
  // Find position where codes first differ
  let commonPrefix = commonUpperBits(firstCode, lastCode);
  
  // Binary search for split position
  var split = first;
  var step = last - first;
  
  loop {
    step = (step + 1) >> 1;
    let newSplit = split + step;
    
    if (newSplit < last) {
      let splitCode = mortonCodes[newSplit].code;
      let splitPrefix = commonUpperBits(firstCode, splitCode);
      if (splitPrefix > commonPrefix) {
        split = newSplit;
      }
    }
    
    if (step <= 1) {
      break;
    }
  }
  
  return split;
}

/**
 * Determines the range of keys handled by node i.
 */
fn determineRange(i: i32, n: i32) -> vec2<i32> {
  // Determine direction of the range
  let d = select(-1, 1, commonUpperBits(mortonCodes[i].code, mortonCodes[i + 1].code) > 
                        commonUpperBits(mortonCodes[i].code, mortonCodes[max(i - 1, 0)].code));
  
  // Compute upper bound for the length of the range
  let deltaMin = commonUpperBits(mortonCodes[i].code, mortonCodes[i - d].code);
  var lmax = 2;
  
  loop {
    let idx = i + lmax * d;
    if (idx < 0 || idx >= n) {
      break;
    }
    if (commonUpperBits(mortonCodes[i].code, mortonCodes[idx].code) <= deltaMin) {
      break;
    }
    lmax *= 2;
  }
  
  // Find other end using binary search
  var l = 0;
  var t = lmax >> 1;
  
  loop {
    if (t <= 0) {
      break;
    }
    
    let idx = i + (l + t) * d;
    if (idx >= 0 && idx < n) {
      if (commonUpperBits(mortonCodes[i].code, mortonCodes[idx].code) > deltaMin) {
        l += t;
      }
    }
    t >>= 1;
  }
  
  let j = i + l * d;
  
  return select(vec2<i32>(j, i), vec2<i32>(i, j), d > 0);
}

/**
 * Builds the radix tree structure.
 * Each thread handles one internal node.
 */
@compute @workgroup_size(256)
fn buildRadixTree(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let i = i32(globalId.x);
  let n = i32(uniforms.instanceCount);
  
  // n-1 internal nodes
  if (i >= n - 1) {
    return;
  }
  
  // Determine range for this node
  let range = determineRange(i, n);
  let first = range.x;
  let last = range.y;
  
  // Find split position
  let split = findSplit(first, last);
  
  // Select children
  var childLeft: i32;
  var childRight: i32;
  
  if (split == first) {
    // Left child is a leaf
    childLeft = split + n - 1;  // Leaf nodes start at index n-1
  } else {
    childLeft = split;  // Left child is internal node
  }
  
  if (split + 1 == last) {
    // Right child is a leaf
    childRight = split + 1 + n - 1;
  } else {
    childRight = split + 1;
  }
  
  // Store tree structure in nodes
  // Internal nodes: indices 0 to n-2
  // Leaf nodes: indices n-1 to 2n-2
  let nodeIdx = u32(i);
  
  // Store child pointers (will be converted to bounds later)
  bvhNodes[nodeIdx].boundsMin.w = bitcast<f32>(u32(childLeft));
  bvhNodes[nodeIdx].boundsMax.w = bitcast<f32>(u32(childRight));
  
  // Store parent pointers for bottom-up traversal
  nodeParents[childLeft] = i;
  nodeParents[childRight] = i;
  
  // Root has no parent
  if (i == 0) {
    nodeParents[0] = -1;
  }
}

/**
 * Initialize leaf nodes with instance bounds.
 */
@compute @workgroup_size(256)
fn initializeLeaves(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let leafIdx = globalId.x;
  let n = uniforms.instanceCount;
  
  if (leafIdx >= n) {
    return;
  }
  
  // Get sorted instance index
  let instanceIdx = mortonCodes[leafIdx].index;
  
  // Get instance bounds
  let bounds = instanceBounds[instanceIdx];
  let center = bounds.xyz;
  let radius = bounds.w;
  
  // Leaf node index in BVH array
  let nodeIdx = n - 1u + leafIdx;
  
  // Store AABB
  bvhNodes[nodeIdx].boundsMin = vec4<f32>(center - vec3<f32>(radius), bitcast<f32>(instanceIdx | NODE_FLAG_LEAF));
  bvhNodes[nodeIdx].boundsMax = vec4<f32>(center + vec3<f32>(radius), bitcast<f32>(1u));  // 1 instance per leaf
  
  // Initialize parent counter for bottom-up pass
  nodeParents[nodeIdx] = -2;  // Will be set by buildRadixTree
}

// ============================================================================
// Pass 11: Compute Node Bounds (Bottom-Up)
// ============================================================================

// Atomic counter for bottom-up traversal
@group(2) @binding(0) var<storage, read_write> nodeCounters: array<atomic<u32>>;

/**
 * Bottom-up AABB computation.
 * Each leaf signals its parent, parent computes bounds when both children done.
 */
@compute @workgroup_size(256)
fn computeNodeBounds(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let leafIdx = globalId.x;
  let n = uniforms.instanceCount;
  
  if (leafIdx >= n) {
    return;
  }
  
  // Start from leaf node
  var nodeIdx = i32(n - 1u + leafIdx);
  var parentIdx = nodeParents[nodeIdx];
  
  // Traverse up the tree
  while (parentIdx >= 0) {
    // Atomically increment parent's child counter
    let count = atomicAdd(&nodeCounters[parentIdx], 1u);
    
    // First thread to arrive just waits
    if (count == 0u) {
      return;
    }
    
    // Second thread computes bounds
    let parent = &bvhNodes[parentIdx];
    let leftChild = i32(bitcast<u32>((*parent).boundsMin.w));
    let rightChild = i32(bitcast<u32>((*parent).boundsMax.w));
    
    let leftNode = bvhNodes[leftChild];
    let rightNode = bvhNodes[rightChild];
    
    // Merge AABBs
    let mergedMin = min(leftNode.boundsMin.xyz, rightNode.boundsMin.xyz);
    let mergedMax = max(leftNode.boundsMax.xyz, rightNode.boundsMax.xyz);
    
    (*parent).boundsMin = vec4<f32>(mergedMin, (*parent).boundsMin.w);
    (*parent).boundsMax = vec4<f32>(mergedMax, (*parent).boundsMax.w);
    
    // Move to next level
    nodeIdx = parentIdx;
    parentIdx = nodeParents[nodeIdx];
  }
}

// ============================================================================
// Utility Passes
// ============================================================================

@compute @workgroup_size(256)
fn resetNodeCounters(@builtin(global_invocation_id) globalId: vec3<u32>) {
  let nodeIdx = globalId.x;
  let n = uniforms.instanceCount;
  let numNodes = 2u * n - 1u;
  
  if (nodeIdx >= numNodes) {
    return;
  }
  
  atomicStore(&nodeCounters[nodeIdx], 0u);
}

