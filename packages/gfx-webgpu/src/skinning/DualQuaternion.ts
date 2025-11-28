/**
 * Dual Quaternion math utilities for GPU skinning.
 * Dual quaternions provide better interpolation than matrices for skeletal animation,
 * eliminating the "candy wrapper" artifact at extreme joint rotations.
 */

/**
 * A dual quaternion represented as two vec4s: real and dual parts.
 * Real part: rotation quaternion (x, y, z, w)
 * Dual part: encodes translation combined with rotation
 */
export interface DualQuaternion {
  real: Float32Array; // [x, y, z, w] - rotation
  dual: Float32Array; // [x, y, z, w] - translation encoding
}

/**
 * Creates a dual quaternion from a 4x4 transformation matrix.
 * The matrix is assumed to be a rigid transform (rotation + translation, no scale).
 */
export function mat4ToDualQuat(mat: Float32Array, out?: DualQuaternion): DualQuaternion {
  const result = out ?? {
    real: new Float32Array(4),
    dual: new Float32Array(4),
  };

  // Extract rotation quaternion from upper-left 3x3
  const m00 = mat[0]!, m01 = mat[1]!, m02 = mat[2]!;
  const m10 = mat[4]!, m11 = mat[5]!, m12 = mat[6]!;
  const m20 = mat[8]!, m21 = mat[9]!, m22 = mat[10]!;

  // Translation
  const tx = mat[12]!;
  const ty = mat[13]!;
  const tz = mat[14]!;

  // Matrix to quaternion (Shepperd's method for numerical stability)
  const trace = m00 + m11 + m22;
  let qx: number, qy: number, qz: number, qw: number;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    qw = 0.25 / s;
    qx = (m21 - m12) * s;
    qy = (m02 - m20) * s;
    qz = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    qw = (m21 - m12) / s;
    qx = 0.25 * s;
    qy = (m01 + m10) / s;
    qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    qw = (m02 - m20) / s;
    qx = (m01 + m10) / s;
    qy = 0.25 * s;
    qz = (m12 + m21) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    qw = (m10 - m01) / s;
    qx = (m02 + m20) / s;
    qy = (m12 + m21) / s;
    qz = 0.25 * s;
  }

  // Normalize rotation quaternion
  const len = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
  const invLen = len > 0.000001 ? 1.0 / len : 0;
  qx *= invLen;
  qy *= invLen;
  qz *= invLen;
  qw *= invLen;

  result.real[0] = qx;
  result.real[1] = qy;
  result.real[2] = qz;
  result.real[3] = qw;

  // Dual part: d = 0.5 * t * r (where t is pure quaternion [tx, ty, tz, 0])
  result.dual[0] = 0.5 * (tx * qw + ty * qz - tz * qy);
  result.dual[1] = 0.5 * (-tx * qz + ty * qw + tz * qx);
  result.dual[2] = 0.5 * (tx * qy - ty * qx + tz * qw);
  result.dual[3] = 0.5 * (-tx * qx - ty * qy - tz * qz);

  return result;
}

/**
 * Converts an array of mat4x4 joint matrices to dual quaternion format.
 * Output is packed as [real0, dual0, real1, dual1, ...] for GPU consumption.
 */
export function jointMatricesToDualQuats(
  matrices: Float32Array,
  jointCount: number,
  out?: Float32Array
): Float32Array {
  const result = out ?? new Float32Array(jointCount * 8); // 8 floats per DQ (2 x vec4)
  const tempDQ: DualQuaternion = {
    real: new Float32Array(4),
    dual: new Float32Array(4),
  };

  for (let i = 0; i < jointCount; i++) {
    const matOffset = i * 16;
    const dqOffset = i * 8;
    
    mat4ToDualQuat(matrices.subarray(matOffset, matOffset + 16), tempDQ);
    
    // Pack real then dual
    result[dqOffset + 0] = tempDQ.real[0]!;
    result[dqOffset + 1] = tempDQ.real[1]!;
    result[dqOffset + 2] = tempDQ.real[2]!;
    result[dqOffset + 3] = tempDQ.real[3]!;
    result[dqOffset + 4] = tempDQ.dual[0]!;
    result[dqOffset + 5] = tempDQ.dual[1]!;
    result[dqOffset + 6] = tempDQ.dual[2]!;
    result[dqOffset + 7] = tempDQ.dual[3]!;
  }

  return result;
}

/**
 * Normalizes a dual quaternion in-place.
 */
export function normalizeDualQuat(dq: DualQuaternion): void {
  const r = dq.real;
  const d = dq.dual;
  
  const mag = Math.sqrt(r[0]! * r[0]! + r[1]! * r[1]! + r[2]! * r[2]! + r[3]! * r[3]!);
  if (mag < 0.000001) return;
  
  const invMag = 1.0 / mag;
  r[0]! *= invMag;
  r[1]! *= invMag;
  r[2]! *= invMag;
  r[3]! *= invMag;
  d[0]! *= invMag;
  d[1]! *= invMag;
  d[2]! *= invMag;
  d[3]! *= invMag;
}

/**
 * Blends multiple dual quaternions with weights.
 * Uses DLB (Dual quaternion Linear Blending) with proper sign correction.
 */
export function blendDualQuats(
  dqs: DualQuaternion[],
  weights: number[],
  out?: DualQuaternion
): DualQuaternion {
  const result = out ?? {
    real: new Float32Array(4),
    dual: new Float32Array(4),
  };

  result.real.fill(0);
  result.dual.fill(0);

  if (dqs.length === 0 || weights.length === 0) {
    result.real[3] = 1; // Identity
    return result;
  }

  // Reference quaternion for sign correction (first non-zero weighted)
  let refIdx = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i]! > 0.0001) {
      refIdx = i;
      break;
    }
  }
  const ref = dqs[refIdx]!;

  for (let i = 0; i < dqs.length && i < weights.length; i++) {
    const w = weights[i]!;
    if (w < 0.0001) continue;

    const dq = dqs[i]!;
    
    // Sign correction: ensure quaternions are in same hemisphere
    const dot = ref.real[0]! * dq.real[0]! + ref.real[1]! * dq.real[1]! +
                ref.real[2]! * dq.real[2]! + ref.real[3]! * dq.real[3]!;
    const sign = dot < 0 ? -1 : 1;
    
    result.real[0] = result.real[0]! + w * sign * dq.real[0]!;
    result.real[1] = result.real[1]! + w * sign * dq.real[1]!;
    result.real[2] = result.real[2]! + w * sign * dq.real[2]!;
    result.real[3] = result.real[3]! + w * sign * dq.real[3]!;
    result.dual[0] = result.dual[0]! + w * sign * dq.dual[0]!;
    result.dual[1] = result.dual[1]! + w * sign * dq.dual[1]!;
    result.dual[2] = result.dual[2]! + w * sign * dq.dual[2]!;
    result.dual[3] = result.dual[3]! + w * sign * dq.dual[3]!;
  }

  normalizeDualQuat(result);
  return result;
}

