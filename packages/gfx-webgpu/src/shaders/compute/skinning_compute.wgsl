/**
 * GPU Compute Skinning Shader
 * 
 * Supports both Linear Blend Skinning (LBS) and Dual Quaternion Skinning (DQS).
 * Pre-transforms vertices in compute shader for reuse across render passes (main, shadow, etc.)
 */

// ============================================================================
// Constants and Structures
// ============================================================================

const WORKGROUP_SIZE: u32 = 64u;
const MAX_INFLUENCES: u32 = 4u;

// Skinning mode flags
const SKINNING_MODE_LBS: u32 = 0u;  // Linear Blend Skinning (matrices)
const SKINNING_MODE_DQS: u32 = 1u;  // Dual Quaternion Skinning

struct SkinningUniforms {
    vertexCount: u32,
    jointCount: u32,
    skinningMode: u32,  // 0 = LBS, 1 = DQS
    _pad0: u32,
}

// Dual quaternion: real (rotation) + dual (translation encoding)
struct DualQuat {
    real: vec4<f32>,  // rotation quaternion (x, y, z, w)
    dual: vec4<f32>,  // dual part
}

// Input vertex data
struct InputVertex {
    position: vec4<f32>,   // xyz position, w unused
    normal: vec4<f32>,     // xyz normal, w unused
    jointIndices: vec4<u32>, // up to 4 joint influences
    jointWeights: vec4<f32>, // corresponding weights (should sum to 1)
}

// Output skinned vertex
struct OutputVertex {
    position: vec4<f32>,
    normal: vec4<f32>,
}

// ============================================================================
// Bindings
// ============================================================================

@group(0) @binding(0) var<uniform> uniforms: SkinningUniforms;
@group(0) @binding(1) var<storage, read> inputVertices: array<InputVertex>;
@group(0) @binding(2) var<storage, read_write> outputVertices: array<OutputVertex>;

// Joint transforms - either matrices or dual quaternions based on mode
@group(0) @binding(3) var<storage, read> jointMatrices: array<mat4x4<f32>>;
@group(0) @binding(4) var<storage, read> jointDualQuats: array<DualQuat>;

// ============================================================================
// Dual Quaternion Math
// ============================================================================

fn dqMultiply(a: DualQuat, b: DualQuat) -> DualQuat {
    var result: DualQuat;
    
    // Real part: quaternion multiply
    result.real = vec4<f32>(
        a.real.w * b.real.x + a.real.x * b.real.w + a.real.y * b.real.z - a.real.z * b.real.y,
        a.real.w * b.real.y - a.real.x * b.real.z + a.real.y * b.real.w + a.real.z * b.real.x,
        a.real.w * b.real.z + a.real.x * b.real.y - a.real.y * b.real.x + a.real.z * b.real.w,
        a.real.w * b.real.w - a.real.x * b.real.x - a.real.y * b.real.y - a.real.z * b.real.z
    );
    
    // Dual part: r1*d2 + d1*r2
    result.dual = vec4<f32>(
        a.real.w * b.dual.x + a.real.x * b.dual.w + a.real.y * b.dual.z - a.real.z * b.dual.y +
        a.dual.w * b.real.x + a.dual.x * b.real.w + a.dual.y * b.real.z - a.dual.z * b.real.y,
        
        a.real.w * b.dual.y - a.real.x * b.dual.z + a.real.y * b.dual.w + a.real.z * b.dual.x +
        a.dual.w * b.real.y - a.dual.x * b.real.z + a.dual.y * b.real.w + a.dual.z * b.real.x,
        
        a.real.w * b.dual.z + a.real.x * b.dual.y - a.real.y * b.dual.x + a.real.z * b.dual.w +
        a.dual.w * b.real.z + a.dual.x * b.real.y - a.dual.y * b.real.x + a.dual.z * b.real.w,
        
        a.real.w * b.dual.w - a.real.x * b.dual.x - a.real.y * b.dual.y - a.real.z * b.dual.z +
        a.dual.w * b.real.w - a.dual.x * b.real.x - a.dual.y * b.real.y - a.dual.z * b.real.z
    );
    
    return result;
}

fn dqNormalize(dq: DualQuat) -> DualQuat {
    var result: DualQuat;
    let mag = length(dq.real);
    if (mag < 0.000001) {
        result.real = vec4<f32>(0.0, 0.0, 0.0, 1.0);
        result.dual = vec4<f32>(0.0);
        return result;
    }
    let invMag = 1.0 / mag;
    result.real = dq.real * invMag;
    result.dual = dq.dual * invMag;
    return result;
}

fn dqConjugate(dq: DualQuat) -> DualQuat {
    var result: DualQuat;
    result.real = vec4<f32>(-dq.real.xyz, dq.real.w);
    result.dual = vec4<f32>(-dq.dual.xyz, dq.dual.w);
    return result;
}

// Rotate a vector by quaternion: q * v * q^-1
fn quatRotate(q: vec4<f32>, v: vec3<f32>) -> vec3<f32> {
    let qv = q.xyz;
    let uv = cross(qv, v);
    let uuv = cross(qv, uv);
    return v + ((uv * q.w) + uuv) * 2.0;
}

// Transform point by dual quaternion
fn dqTransformPoint(dq: DualQuat, p: vec3<f32>) -> vec3<f32> {
    // Rotation
    let rotated = quatRotate(dq.real, p);
    
    // Translation: t = 2 * dual * conj(real)
    let t = vec3<f32>(
        2.0 * (dq.real.w * dq.dual.x - dq.dual.w * dq.real.x + dq.real.y * dq.dual.z - dq.real.z * dq.dual.y),
        2.0 * (dq.real.w * dq.dual.y - dq.dual.w * dq.real.y + dq.real.z * dq.dual.x - dq.real.x * dq.dual.z),
        2.0 * (dq.real.w * dq.dual.z - dq.dual.w * dq.real.z + dq.real.x * dq.dual.y - dq.real.y * dq.dual.x)
    );
    
    return rotated + t;
}

// Transform normal by dual quaternion (rotation only)
fn dqTransformNormal(dq: DualQuat, n: vec3<f32>) -> vec3<f32> {
    return quatRotate(dq.real, n);
}

// ============================================================================
// Skinning Implementations
// ============================================================================

// Linear Blend Skinning (classic matrix blending)
fn skinLBS(vertex: InputVertex) -> OutputVertex {
    var result: OutputVertex;
    
    var blendedPos = vec3<f32>(0.0);
    var blendedNormal = vec3<f32>(0.0);
    
    let indices = vertex.jointIndices;
    let weights = vertex.jointWeights;
    let pos = vertex.position.xyz;
    let nrm = vertex.normal.xyz;
    
    // Blend up to 4 influences
    for (var i = 0u; i < MAX_INFLUENCES; i++) {
        let w = weights[i];
        if (w < 0.0001) {
            continue;
        }
        
        let jointIdx = indices[i];
        if (jointIdx >= uniforms.jointCount) {
            continue;
        }
        
        let mat = jointMatrices[jointIdx];
        
        // Transform position
        let transformed = (mat * vec4<f32>(pos, 1.0)).xyz;
        blendedPos += transformed * w;
        
        // Transform normal (using upper 3x3, no translation)
        let transformedNormal = normalize((mat * vec4<f32>(nrm, 0.0)).xyz);
        blendedNormal += transformedNormal * w;
    }
    
    result.position = vec4<f32>(blendedPos, 1.0);
    result.normal = vec4<f32>(normalize(blendedNormal), 0.0);
    
    return result;
}

// Dual Quaternion Skinning (better for rotations, no volume loss)
fn skinDQS(vertex: InputVertex) -> OutputVertex {
    var result: OutputVertex;
    
    let indices = vertex.jointIndices;
    let weights = vertex.jointWeights;
    let pos = vertex.position.xyz;
    let nrm = vertex.normal.xyz;
    
    // Accumulate blended dual quaternion
    var blendedDQ: DualQuat;
    blendedDQ.real = vec4<f32>(0.0);
    blendedDQ.dual = vec4<f32>(0.0);
    
    // Get first valid joint DQ for sign correction reference
    var refDQ: DualQuat;
    var hasRef = false;
    for (var i = 0u; i < MAX_INFLUENCES; i++) {
        if (weights[i] > 0.0001 && indices[i] < uniforms.jointCount) {
            refDQ = jointDualQuats[indices[i]];
            hasRef = true;
            break;
        }
    }
    
    if (!hasRef) {
        // No valid joints, return identity transform
        result.position = vec4<f32>(pos, 1.0);
        result.normal = vec4<f32>(nrm, 0.0);
        return result;
    }
    
    // Blend dual quaternions with sign correction
    for (var i = 0u; i < MAX_INFLUENCES; i++) {
        let w = weights[i];
        if (w < 0.0001) {
            continue;
        }
        
        let jointIdx = indices[i];
        if (jointIdx >= uniforms.jointCount) {
            continue;
        }
        
        var dq = jointDualQuats[jointIdx];
        
        // Sign correction: ensure quaternions are in same hemisphere
        let dotProduct = dot(refDQ.real, dq.real);
        let sign = select(1.0, -1.0, dotProduct < 0.0);
        
        blendedDQ.real += dq.real * w * sign;
        blendedDQ.dual += dq.dual * w * sign;
    }
    
    // Normalize the blended dual quaternion
    blendedDQ = dqNormalize(blendedDQ);
    
    // Transform position and normal
    let skinnedPos = dqTransformPoint(blendedDQ, pos);
    let skinnedNormal = dqTransformNormal(blendedDQ, nrm);
    
    result.position = vec4<f32>(skinnedPos, 1.0);
    result.normal = vec4<f32>(normalize(skinnedNormal), 0.0);
    
    return result;
}

// ============================================================================
// Main Compute Kernel
// ============================================================================

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let vertexIdx = globalId.x;
    
    if (vertexIdx >= uniforms.vertexCount) {
        return;
    }
    
    let inputVertex = inputVertices[vertexIdx];
    var outputVertex: OutputVertex;
    
    // Select skinning mode
    if (uniforms.skinningMode == SKINNING_MODE_DQS) {
        outputVertex = skinDQS(inputVertex);
    } else {
        outputVertex = skinLBS(inputVertex);
    }
    
    outputVertices[vertexIdx] = outputVertex;
}

// ============================================================================
// Reset kernel (initialize output to input, useful for debugging)
// ============================================================================

@compute @workgroup_size(WORKGROUP_SIZE)
fn reset(@builtin(global_invocation_id) globalId: vec3<u32>) {
    let vertexIdx = globalId.x;
    
    if (vertexIdx >= uniforms.vertexCount) {
        return;
    }
    
    let input = inputVertices[vertexIdx];
    var output: OutputVertex;
    output.position = input.position;
    output.normal = input.normal;
    outputVertices[vertexIdx] = output;
}

