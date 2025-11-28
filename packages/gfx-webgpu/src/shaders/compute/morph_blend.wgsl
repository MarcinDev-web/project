/**
 * Compute-based Morph Target Blending Shader
 * 
 * Blends multiple morph target deltas with arbitrary weights.
 * Supports up to MAX_MORPH_TARGETS simultaneous blend targets.
 * 
 * Memory Layout:
 * - Base positions: array<vec4<f32>> - original mesh positions
 * - Base normals: array<vec4<f32>> - original mesh normals  
 * - Morph deltas: array<vec4<f32>> - packed as [target0_v0, target0_v1, ..., target1_v0, ...]
 * - Weights: uniform array - blend weight per morph target
 */

// ============================================================================
// Constants
// ============================================================================

const WORKGROUP_SIZE: u32 = 64u;
const MAX_MORPH_TARGETS: u32 = 16u;

// ============================================================================
// Structures
// ============================================================================

struct MorphUniforms {
    vertexCount: u32,
    targetCount: u32,       // Number of active morph targets
    hasNormalDeltas: u32,   // Whether normal deltas are provided
    _pad0: u32,
    weights: array<vec4<f32>, 4>, // MAX_MORPH_TARGETS / 4 = 4 vec4s
}

// ============================================================================
// Bindings
// ============================================================================

@group(0) @binding(0) var<uniform> uniforms: MorphUniforms;

// Base mesh data (read-only)
@group(0) @binding(1) var<storage, read> basePositions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> baseNormals: array<vec4<f32>>;

// Morph target deltas: packed [target0_positions, target1_positions, ...]
// Layout: morphPositionDeltas[targetIdx * vertexCount + vertexIdx]
@group(0) @binding(3) var<storage, read> morphPositionDeltas: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read> morphNormalDeltas: array<vec4<f32>>;

// Output (morphed vertices)
@group(0) @binding(5) var<storage, read_write> outPositions: array<vec4<f32>>;
@group(0) @binding(6) var<storage, read_write> outNormals: array<vec4<f32>>;

// ============================================================================
// Helper Functions
// ============================================================================

fn getWeight(targetIdx: u32) -> f32 {
    let vecIdx = targetIdx / 4u;
    let compIdx = targetIdx % 4u;
    return uniforms.weights[vecIdx][compIdx];
}

// ============================================================================
// Main Morph Blending Kernel
// ============================================================================

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let vertexIdx = globalId.x;
    
    if (vertexIdx >= uniforms.vertexCount) {
        return;
    }
    
    // Start with base mesh
    var blendedPos = basePositions[vertexIdx].xyz;
    var blendedNormal = baseNormals[vertexIdx].xyz;
    
    let vertCount = uniforms.vertexCount;
    let targetCount = min(uniforms.targetCount, MAX_MORPH_TARGETS);
    
    // Accumulate weighted morph deltas
    for (var t = 0u; t < targetCount; t++) {
        let weight = getWeight(t);
        
        // Skip targets with negligible weight
        if (abs(weight) < 0.0001) {
            continue;
        }
        
        // Sample position delta
        let deltaIdx = t * vertCount + vertexIdx;
        let posDelta = morphPositionDeltas[deltaIdx].xyz;
        blendedPos += posDelta * weight;
        
        // Sample normal delta if available
        if (uniforms.hasNormalDeltas > 0u) {
            let normalDelta = morphNormalDeltas[deltaIdx].xyz;
            blendedNormal += normalDelta * weight;
        }
    }
    
    // Renormalize normal (deltas may have denormalized it)
    let normalLen = length(blendedNormal);
    if (normalLen > 0.0001) {
        blendedNormal = blendedNormal / normalLen;
    }
    
    // Write output
    outPositions[vertexIdx] = vec4<f32>(blendedPos, 1.0);
    outNormals[vertexIdx] = vec4<f32>(blendedNormal, 0.0);
}

// ============================================================================
// Combined Morph + Skinning Kernel
// For efficiency when both morph and skinning are needed
// ============================================================================

struct DualQuat {
    real: vec4<f32>,
    dual: vec4<f32>,
}

struct SkinningInput {
    jointIndices: vec4<u32>,
    jointWeights: vec4<f32>,
}

@group(1) @binding(0) var<storage, read> skinningInputs: array<SkinningInput>;
@group(1) @binding(1) var<storage, read> jointDualQuats: array<DualQuat>;
@group(1) @binding(2) var<uniform> jointCount: u32;
@group(1) @binding(3) var<uniform> skinningEnabled: u32;

// Quaternion rotation
fn quatRotate(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
    let qv = q.xyz;
    let uv = cross(qv, v);
    let uuv = cross(qv, uv);
    return v + ((uv * q.w) + uuv) * 2.0;
}

// Dual quaternion transform
fn dqTransformPoint(dq: DualQuat, p: vec3<f32>) -> vec3<f32> {
    let rotated = quatRotate(dq.real, p);
    let t = vec3<f32>(
        2.0 * (dq.real.w * dq.dual.x - dq.dual.w * dq.real.x + dq.real.y * dq.dual.z - dq.real.z * dq.dual.y),
        2.0 * (dq.real.w * dq.dual.y - dq.dual.w * dq.real.y + dq.real.z * dq.dual.x - dq.real.x * dq.dual.z),
        2.0 * (dq.real.w * dq.dual.z - dq.dual.w * dq.real.z + dq.real.x * dq.dual.y - dq.real.y * dq.dual.x)
    );
    return rotated + t;
}

fn dqTransformNormal(dq: DualQuat, n: vec3<f32>) -> vec3<f32> {
    return quatRotate(dq.real, n);
}

fn blendDualQuats(indices: vec4<u32>, weights: vec4<f32>) -> DualQuat {
    var result: DualQuat;
    result.real = vec4<f32>(0.0);
    result.dual = vec4<f32>(0.0);
    
    // Reference for sign correction
    var refDQ: DualQuat;
    var hasRef = false;
    
    for (var i = 0u; i < 4u; i++) {
        if (weights[i] > 0.0001 && indices[i] < jointCount) {
            refDQ = jointDualQuats[indices[i]];
            hasRef = true;
            break;
        }
    }
    
    if (!hasRef) {
        result.real.w = 1.0;
        return result;
    }
    
    for (var i = 0u; i < 4u; i++) {
        let w = weights[i];
        if (w < 0.0001) {
            continue;
        }
        let idx = indices[i];
        if (idx >= jointCount) {
            continue;
        }
        
        var dq = jointDualQuats[idx];
        let dotProduct = dot(refDQ.real, dq.real);
        let sign = select(1.0, -1.0, dotProduct < 0.0);
        
        result.real += dq.real * w * sign;
        result.dual += dq.dual * w * sign;
    }
    
    // Normalize
    let mag = length(result.real);
    if (mag > 0.000001) {
        let invMag = 1.0 / mag;
        result.real *= invMag;
        result.dual *= invMag;
    } else {
        result.real = vec4<f32>(0.0, 0.0, 0.0, 1.0);
        result.dual = vec4<f32>(0.0);
    }
    
    return result;
}

@compute @workgroup_size(WORKGROUP_SIZE)
fn mainCombined(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let vertexIdx = globalId.x;
    
    if (vertexIdx >= uniforms.vertexCount) {
        return;
    }
    
    // Step 1: Apply morph blending
    var pos = basePositions[vertexIdx].xyz;
    var normal = baseNormals[vertexIdx].xyz;
    
    let vertCount = uniforms.vertexCount;
    let targetCount = min(uniforms.targetCount, MAX_MORPH_TARGETS);
    
    for (var t = 0u; t < targetCount; t++) {
        let weight = getWeight(t);
        if (abs(weight) < 0.0001) {
            continue;
        }
        
        let deltaIdx = t * vertCount + vertexIdx;
        pos += morphPositionDeltas[deltaIdx].xyz * weight;
        
        if (uniforms.hasNormalDeltas > 0u) {
            normal += morphNormalDeltas[deltaIdx].xyz * weight;
        }
    }
    
    // Step 2: Apply skinning if enabled
    if (skinningEnabled > 0u) {
        let skinInput = skinningInputs[vertexIdx];
        let blendedDQ = blendDualQuats(skinInput.jointIndices, skinInput.jointWeights);
        
        pos = dqTransformPoint(blendedDQ, pos);
        normal = dqTransformNormal(blendedDQ, normal);
    }
    
    // Normalize and output
    let normalLen = length(normal);
    if (normalLen > 0.0001) {
        normal = normal / normalLen;
    }
    
    outPositions[vertexIdx] = vec4<f32>(pos, 1.0);
    outNormals[vertexIdx] = vec4<f32>(normal, 0.0);
}

// ============================================================================
// Reset kernel (copy base to output)
// ============================================================================

@compute @workgroup_size(WORKGROUP_SIZE)
fn reset(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let vertexIdx = globalId.x;
    
    if (vertexIdx >= uniforms.vertexCount) {
        return;
    }
    
    outPositions[vertexIdx] = basePositions[vertexIdx];
    outNormals[vertexIdx] = baseNormals[vertexIdx];
}

