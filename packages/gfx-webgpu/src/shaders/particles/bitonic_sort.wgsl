// Bitonic Sort Compute Shader for Particles - SoA Compatible
// Sorts particle indices by distance to camera for correct alpha blending

// ============================================================================
// Sort Parameters
// ============================================================================

struct SortParams {
    numElements: u32,
    blockHeight: u32,      // Current block size being merged
    stepIndex: u32,        // Current step within the block
    cameraZ: f32,          // Camera position for distance calc (or pass full pos)
};

struct SortUniforms {
    cameraPos: vec3<f32>,
    maxParticles: u32,
};

// ============================================================================
// Particle reference for sorting
// ============================================================================

struct ParticleRef {
    distance: f32,
    index: u32,
};

// ============================================================================
// Bindings
// ============================================================================

@group(0) @binding(0) var<uniform> params : SortParams;
@group(0) @binding(1) var<storage, read_write> sortKeys : array<ParticleRef>;

// SoA particle data (read-only for distance calculation)
@group(1) @binding(0) var<uniform> sortUniforms : SortUniforms;
@group(1) @binding(1) var<storage, read> positions : array<vec4<f32>>;      // xyz=position
@group(1) @binding(2) var<storage, read> velocities : array<vec4<f32>>;     // w=life (to filter dead)

// Workgroup shared memory for local sorting
var<workgroup> localKeys : array<ParticleRef, 256>;

// ============================================================================
// Distance Calculation - reads from SoA position array
// ============================================================================

fn computeDistance(particleIndex: u32, cameraPos: vec3<f32>) -> f32 {
    let pos = positions[particleIndex].xyz;
    let diff = pos - cameraPos;
    return dot(diff, diff); // Squared distance (avoid sqrt, we just need ordering)
}

fn isAlive(particleIndex: u32) -> bool {
    return velocities[particleIndex].w > 0.0;
}

// ============================================================================
// Initialize Sort Keys - Generate distance values for all particles
// ============================================================================

@compute @workgroup_size(64)
fn initSortKeys(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    let index = GlobalInvocationID.x;
    if (index >= sortUniforms.maxParticles) {
        return;
    }

    var ref: ParticleRef;
    ref.index = index;
    
    // Dead particles get maximum distance (sort to end)
    if (isAlive(index)) {
        ref.distance = computeDistance(index, sortUniforms.cameraPos);
    } else {
        ref.distance = 3.402823e+38; // FLT_MAX - dead particles sorted last
    }
    
    sortKeys[index] = ref;
}

// ============================================================================
// Bitonic Sort - Global Phase
// Compares and swaps elements across workgroups
// ============================================================================

@compute @workgroup_size(256)
fn bitonicSortGlobal(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    let index = GlobalInvocationID.x;
    let halfN = params.numElements / 2u;
    
    if (index >= halfN) {
        return;
    }

    let blockHeight = params.blockHeight;
    let step = params.stepIndex;

    // Calculate which pair to compare
    // Bitonic pattern: within each block, compare elements at distance 'step' apart
    let blockIdx = index / (blockHeight / 2u);
    let posInBlock = index % (blockHeight / 2u);
    
    // Ascending or descending sort for this block?
    let ascending = (blockIdx & 1u) == 0u;
    
    // Calculate the two indices to compare
    let pairDistance = step;
    let baseIdx = (index / pairDistance) * pairDistance * 2u + (index % pairDistance);
    let idx1 = baseIdx;
    let idx2 = baseIdx + pairDistance;
    
    if (idx2 >= params.numElements) {
        return;
    }

    let a = sortKeys[idx1];
    let b = sortKeys[idx2];

    // Compare and swap based on sort direction
    // For back-to-front (descending distance), swap if a.distance < b.distance
    let needSwap = select(a.distance > b.distance, a.distance < b.distance, ascending);
    
    if (needSwap) {
        sortKeys[idx1] = b;
        sortKeys[idx2] = a;
    }
}

// ============================================================================
// Bitonic Sort - Local Phase (Within Workgroup)
// Uses shared memory for fast sorting of small blocks
// ============================================================================

@compute @workgroup_size(256)
fn bitonicSortLocal(
    @builtin(global_invocation_id) GlobalInvocationID : vec3<u32>,
    @builtin(local_invocation_id) LocalInvocationID : vec3<u32>,
    @builtin(workgroup_id) WorkgroupID : vec3<u32>
) {
    let localIdx = LocalInvocationID.x;
    let globalIdx = GlobalInvocationID.x;
    let workgroupOffset = WorkgroupID.x * 256u;

    // Load into shared memory
    if (globalIdx < params.numElements) {
        localKeys[localIdx] = sortKeys[globalIdx];
    } else {
        localKeys[localIdx] = ParticleRef(3.402823e+38, 0u); // Padding
    }
    workgroupBarrier();

    // Perform local bitonic sort within workgroup
    // 256 elements = 8 stages (2^8 = 256)
    for (var k = 2u; k <= 256u; k *= 2u) {
        for (var j = k / 2u; j > 0u; j /= 2u) {
            let ixj = localIdx ^ j;
            
            if (ixj > localIdx) {
                let a = localKeys[localIdx];
                let b = localKeys[ixj];
                
                // Sort direction based on position within block
                let ascending = ((localIdx & k) == 0u);
                let needSwap = select(a.distance > b.distance, a.distance < b.distance, ascending);
                
                if (needSwap) {
                    localKeys[localIdx] = b;
                    localKeys[ixj] = a;
                }
            }
            workgroupBarrier();
        }
    }

    // Write back to global memory
    if (globalIdx < params.numElements) {
        sortKeys[globalIdx] = localKeys[localIdx];
    }
}

// ============================================================================
// Extract Sorted Indices - Copy sorted indices to output buffer
// ============================================================================

@group(2) @binding(0) var<storage, read_write> sortedIndices : array<u32>;

@compute @workgroup_size(64)
fn extractIndices(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    let index = GlobalInvocationID.x;
    if (index >= params.numElements) {
        return;
    }
    
    sortedIndices[index] = sortKeys[index].index;
}

// ============================================================================
// Simple Bitonic Merge Step (Alternative single-pass approach)
// For use with CPU-driven dispatch loop
// ============================================================================

@compute @workgroup_size(256)
fn bitonicMergeStep(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
    let index = GlobalInvocationID.x;
    let n = params.numElements;
    
    if (index >= n / 2u) {
        return;
    }

    let h = params.blockHeight;  // 2, 4, 8, 16, ...
    let s = params.stepIndex;    // h/2, h/4, ..., 1

    // Compute pair indices using standard bitonic formula
    let blockSize = h;
    let halfBlock = s;
    
    // Which element in the "virtual" array of pairs?
    let i = index;
    
    // Compute actual array indices
    let groupIdx = i / halfBlock;
    let posInGroup = i % halfBlock;
    let idx1 = groupIdx * blockSize + posInGroup;
    let idx2 = idx1 + halfBlock;
    
    if (idx2 >= n) {
        return;
    }

    let a = sortKeys[idx1];
    let b = sortKeys[idx2];

    // Ascending in first half of each "h" block, descending in second half
    let blockNum = idx1 / blockSize;
    let ascending = (blockNum & 1u) == 0u;
    
    // For back-to-front rendering (descending), we want largest distances first
    // So we invert the comparison
    let compareAsc = a.distance < b.distance;
    let shouldSwap = select(!compareAsc, compareAsc, ascending);
    
    if (shouldSwap) {
        sortKeys[idx1] = b;
        sortKeys[idx2] = a;
    }
}

