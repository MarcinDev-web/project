/**
 * Subgroup (Wave) Operations Utility Library
 * 
 * Provides efficient parallel primitives using hardware subgroup operations:
 * - Prefix Sum (Exclusive/Inclusive Scan) for stream compaction
 * - Reduction operations for counting and aggregation
 * - Ballot operations for predicate evaluation
 * 
 * Performance benefits:
 * - Subgroup operations execute in single cycle (vs. multiple cycles for shared memory)
 * - No synchronization barriers required within subgroup
 * - Reduced register pressure and shared memory usage
 * 
 * Usage: Enable 'subgroups' feature when requesting WebGPU device
 * Compatible with: NVIDIA (warp=32), AMD (wave=32/64), Intel (subgroup=8-32), Apple (simdgroup=32)
 */

// ============================================================================
// Constants
// ============================================================================

// Typical subgroup sizes by vendor:
// - NVIDIA: 32 (warp)
// - AMD: 32 or 64 (wave)
// - Intel: 8, 16, or 32 (subgroup)
// - Apple: 32 (simdgroup)
// Use subgroup_size builtin to query at runtime
const ASSUMED_SUBGROUP_SIZE: u32 = 32u;

// ============================================================================
// Ballot Operations - Predicate Evaluation
// ============================================================================

/**
 * Counts the number of active lanes in the subgroup where predicate is true.
 * Equivalent to __popc(__ballot_sync(mask, predicate)) in CUDA.
 * 
 * @param predicate Boolean condition to evaluate
 * @return Number of lanes with predicate == true
 */
fn subgroupCountTrue(predicate: bool) -> u32 {
  let ballot = subgroupBallot(predicate);
  // Count bits set in the ballot (vec4<u32>)
  return countOneBits(ballot.x) + countOneBits(ballot.y) + 
         countOneBits(ballot.z) + countOneBits(ballot.w);
}

/**
 * Returns the exclusive prefix count - how many lanes before this one have predicate true.
 * Essential for stream compaction: this gives the write index for each lane.
 * 
 * @param predicate Boolean condition to evaluate
 * @param laneId Current lane index within subgroup (0 to subgroup_size-1)
 * @return Number of lanes before this one with predicate == true
 */
fn subgroupExclusiveCountTrue(predicate: bool, laneId: u32) -> u32 {
  let ballot = subgroupBallot(predicate);
  
  // Create mask for lanes before this one
  // For laneId < 32: mask lower bits of ballot.x
  // For laneId >= 32: include all of ballot.x plus masked ballot.y, etc.
  var count: u32 = 0u;
  
  if (laneId < 32u) {
    let mask = (1u << laneId) - 1u;
    count = countOneBits(ballot.x & mask);
  } else if (laneId < 64u) {
    count = countOneBits(ballot.x);
    let mask = (1u << (laneId - 32u)) - 1u;
    count += countOneBits(ballot.y & mask);
  } else if (laneId < 96u) {
    count = countOneBits(ballot.x) + countOneBits(ballot.y);
    let mask = (1u << (laneId - 64u)) - 1u;
    count += countOneBits(ballot.z & mask);
  } else {
    count = countOneBits(ballot.x) + countOneBits(ballot.y) + countOneBits(ballot.z);
    let mask = (1u << (laneId - 96u)) - 1u;
    count += countOneBits(ballot.w & mask);
  }
  
  return count;
}

/**
 * Stream compaction helper: gets write offset for this lane if predicate is true.
 * Combines ballot + prefix count + global atomic in one operation.
 * 
 * @param predicate Whether this lane has valid data to write
 * @param laneId Current lane index
 * @param globalCount Pointer to global atomic counter
 * @return Write offset in output buffer (valid only if predicate is true)
 */
fn subgroupCompactOffset(
  predicate: bool,
  laneId: u32,
  globalCount: ptr<storage, atomic<u32>, read_write>
) -> u32 {
  // Count how many lanes have valid data
  let subgroupValidCount = subgroupCountTrue(predicate);
  
  // Exclusive prefix - how many valid lanes before this one
  let localOffset = subgroupExclusiveCountTrue(predicate, laneId);
  
  // First active lane atomically reserves space for entire subgroup
  var globalOffset: u32 = 0u;
  if (subgroupElect()) {
    globalOffset = atomicAdd(globalCount, subgroupValidCount);
  }
  
  // Broadcast global offset to all lanes
  globalOffset = subgroupBroadcastFirst(globalOffset);
  
  return globalOffset + localOffset;
}

// ============================================================================
// Reduction Operations - Aggregation
// ============================================================================

/**
 * Subgroup-wide sum reduction.
 * All lanes get the same result.
 * 
 * @param value Value to sum across subgroup
 * @return Sum of all active lane values
 */
fn subgroupReduceSum(value: u32) -> u32 {
  return subgroupAdd(value);
}

/**
 * Subgroup-wide sum reduction for floating point.
 */
fn subgroupReduceSumF32(value: f32) -> f32 {
  return subgroupAdd(value);
}

/**
 * Subgroup-wide maximum reduction.
 */
fn subgroupReduceMax(value: u32) -> u32 {
  return subgroupMax(value);
}

/**
 * Subgroup-wide minimum reduction.
 */
fn subgroupReduceMin(value: u32) -> u32 {
  return subgroupMin(value);
}

/**
 * Subgroup-wide AND reduction (all true).
 */
fn subgroupReduceAnd(value: bool) -> bool {
  return subgroupAll(value);
}

/**
 * Subgroup-wide OR reduction (any true).
 */
fn subgroupReduceOr(value: bool) -> bool {
  return subgroupAny(value);
}

// ============================================================================
// Prefix Sum (Scan) Operations - Essential for Parallel Algorithms
// ============================================================================

/**
 * Inclusive prefix sum within subgroup.
 * Lane i gets sum of values from lanes 0..i (inclusive).
 * 
 * @param value Input value
 * @return Inclusive prefix sum
 */
fn subgroupInclusiveScan(value: u32) -> u32 {
  return subgroupInclusiveAdd(value);
}

/**
 * Exclusive prefix sum within subgroup.
 * Lane i gets sum of values from lanes 0..i-1 (lane 0 gets 0).
 * 
 * @param value Input value
 * @return Exclusive prefix sum
 */
fn subgroupExclusiveScan(value: u32) -> u32 {
  return subgroupExclusiveAdd(value);
}

/**
 * Inclusive prefix sum for floating point.
 */
fn subgroupInclusiveScanF32(value: f32) -> f32 {
  return subgroupInclusiveAdd(value);
}

/**
 * Exclusive prefix sum for floating point.
 */
fn subgroupExclusiveScanF32(value: f32) -> f32 {
  return subgroupExclusiveAdd(value);
}

// ============================================================================
// Shuffle Operations - Data Exchange
// ============================================================================

/**
 * Shuffle XOR - exchange data between paired lanes.
 * Useful for bitonic sort within subgroup.
 * 
 * @param value Value to shuffle
 * @param mask XOR mask for lane selection
 * @return Value from lane (current_lane XOR mask)
 */
fn subgroupShuffleXorU32(value: u32, mask: u32) -> u32 {
  return subgroupShuffleXor(value, mask);
}

/**
 * Shuffle down - get value from higher-indexed lane.
 * 
 * @param value Value to shuffle
 * @param delta Lane offset
 * @return Value from lane (current_lane + delta)
 */
fn subgroupShuffleDownU32(value: u32, delta: u32) -> u32 {
  return subgroupShuffleDown(value, delta);
}

/**
 * Shuffle up - get value from lower-indexed lane.
 * 
 * @param value Value to shuffle
 * @param delta Lane offset
 * @return Value from lane (current_lane - delta)
 */
fn subgroupShuffleUpU32(value: u32, delta: u32) -> u32 {
  return subgroupShuffleUp(value, delta);
}

// ============================================================================
// Workgroup-Wide Operations (Multi-Subgroup)
// ============================================================================

/**
 * Shared memory for cross-subgroup communication.
 * Size = max workgroup size / min subgroup size = 256 / 8 = 32 subgroups max.
 */
var<workgroup> subgroupPartialSums: array<u32, 32>;
var<workgroup> subgroupScanSync: atomic<u32>;

/**
 * Workgroup-wide inclusive prefix sum using subgroup operations.
 * More efficient than purely shared-memory based scan.
 * 
 * Requires: workgroupBarrier() before and after this function.
 * 
 * @param value Input value
 * @param localIndex Local thread index (0 to workgroup_size-1)
 * @param subgroupId Which subgroup this thread belongs to
 * @param laneId Lane index within subgroup
 * @param subgroupSize Size of subgroup
 * @return Workgroup-wide inclusive prefix sum
 */
fn workgroupInclusiveScan(
  value: u32,
  localIndex: u32,
  subgroupId: u32,
  laneId: u32,
  subgroupSize: u32
) -> u32 {
  // Phase 1: Intra-subgroup inclusive scan
  var localSum = subgroupInclusiveAdd(value);
  
  // Phase 2: Last lane of each subgroup writes partial sum
  if (laneId == subgroupSize - 1u) {
    subgroupPartialSums[subgroupId] = localSum;
  }
  
  workgroupBarrier();
  
  // Phase 3: First subgroup scans the partial sums
  if (subgroupId == 0u && laneId < 32u) {
    let partialSum = select(0u, subgroupPartialSums[laneId], laneId < 32u);
    let scannedPartial = subgroupInclusiveAdd(partialSum);
    if (laneId < 32u) {
      subgroupPartialSums[laneId] = scannedPartial;
    }
  }
  
  workgroupBarrier();
  
  // Phase 4: Add prefix from previous subgroups
  if (subgroupId > 0u) {
    localSum += subgroupPartialSums[subgroupId - 1u];
  }
  
  return localSum;
}

/**
 * Workgroup-wide exclusive prefix sum.
 * 
 * @param value Input value
 * @param localIndex Local thread index
 * @param subgroupId Which subgroup this thread belongs to
 * @param laneId Lane index within subgroup
 * @param subgroupSize Size of subgroup
 * @return Workgroup-wide exclusive prefix sum
 */
fn workgroupExclusiveScan(
  value: u32,
  localIndex: u32,
  subgroupId: u32,
  laneId: u32,
  subgroupSize: u32
) -> u32 {
  // Exclusive scan = inclusive scan - value
  let inclusive = workgroupInclusiveScan(value, localIndex, subgroupId, laneId, subgroupSize);
  return inclusive - value;
}

/**
 * Workgroup-wide reduction (sum).
 * More efficient than atomic-based reduction for large workgroups.
 * 
 * @param value Input value
 * @param subgroupId Which subgroup this thread belongs to
 * @param laneId Lane index within subgroup
 * @return Total sum across workgroup (same value for all threads)
 */
fn workgroupReduceSum(
  value: u32,
  subgroupId: u32,
  laneId: u32
) -> u32 {
  // Phase 1: Intra-subgroup reduction
  let subgroupSum = subgroupAdd(value);
  
  // Phase 2: First lane writes to shared memory
  if (laneId == 0u) {
    subgroupPartialSums[subgroupId] = subgroupSum;
  }
  
  workgroupBarrier();
  
  // Phase 3: First subgroup reduces all partial sums
  var totalSum: u32 = 0u;
  if (subgroupId == 0u) {
    let partialSum = select(0u, subgroupPartialSums[laneId], laneId < 32u);
    totalSum = subgroupAdd(partialSum);
    if (laneId == 0u) {
      subgroupPartialSums[0] = totalSum;
    }
  }
  
  workgroupBarrier();
  
  return subgroupPartialSums[0];
}

