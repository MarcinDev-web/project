/**
 * Dual Quaternion math utilities for GPU skinning.
 * Dual quaternions provide better interpolation than matrices for skeletal animation,
 * eliminating the "candy wrapper" artifact at extreme joint rotations.
 * 
 * This module supports optional WASM acceleration for batch conversion.
 * When WASM is initialized, `jointMatricesToDualQuats` uses SIMD-optimized Rust code.
 * Otherwise, it falls back to pure TypeScript implementation.
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

// ============================================================================
// WASM Acceleration Support
// ============================================================================

/**
 * Interface for the WASM DualQuaternionConverter from @engine/wasm-animation.
 * This allows loose coupling without requiring the WASM module at compile time.
 */
interface WasmDualQuatConverter {
  convert(matrices: Float32Array, jointCount: number): number;
  get_output_ptr(): number;
  get_output_len(): number;
  free(): void;
}

interface WasmAnimationModule {
  memory: WebAssembly.Memory;
  batch_mat4_to_dual_quat(matrices: Float32Array, jointCount: number): Float32Array;
  DualQuaternionConverter: new (maxJoints: number) => WasmDualQuatConverter;
}

// WASM module state (lazy initialized)
let wasmModule: WasmAnimationModule | null = null;
let wasmMemory: WebAssembly.Memory | null = null;

/**
 * Initializes WASM acceleration for dual quaternion conversion.
 * Call this once during application startup if WASM is available.
 * 
 * @param wasm - The initialized WASM animation module from @engine/wasm-animation
 * @param memory - The WASM linear memory
 * 
 * @example
 * ```ts
 * import { init } from '@engine/wasm-animation';
 * import { initDualQuatWasm } from '@engine/gfx-webgpu';
 * 
 * const wasmInit = await init();
 * initDualQuatWasm(wasmInit, wasmInit.memory);
 * ```
 */
export function initDualQuatWasm(wasm: WasmAnimationModule, memory: WebAssembly.Memory): void {
  wasmModule = wasm;
  wasmMemory = memory;
}

/**
 * Returns whether WASM acceleration is available.
 */
export function isDualQuatWasmReady(): boolean {
  return wasmModule !== null && wasmMemory !== null;
}

/**
 * Clears WASM acceleration state (useful for testing).
 */
export function clearDualQuatWasm(): void {
  wasmModule = null;
  wasmMemory = null;
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
 * 
 * When WASM is initialized (via initDualQuatWasm), this uses SIMD-optimized
 * Rust code for ~3-5x speedup on large batches.
 * 
 * @param matrices - Joint matrices as Float32Array (jointCount × 16 floats)
 * @param jointCount - Number of joints to convert
 * @param out - Optional pre-allocated output buffer (jointCount × 8 floats)
 * @returns Dual quaternions packed as Float32Array
 */
export function jointMatricesToDualQuats(
  matrices: Float32Array,
  jointCount: number,
  out?: Float32Array
): Float32Array {
  // Use WASM-accelerated path if available
  if (wasmModule !== null) {
    const wasmResult = wasmModule.batch_mat4_to_dual_quat(matrices, jointCount);
    
    // If caller provided output buffer, copy into it
    if (out) {
      out.set(wasmResult);
      return out;
    }
    return wasmResult;
  }
  
  // Fallback to pure TypeScript implementation
  return jointMatricesToDualQuatsTS(matrices, jointCount, out);
}

/**
 * Pure TypeScript implementation of joint matrix to dual quaternion conversion.
 * Used as fallback when WASM is not available.
 */
function jointMatricesToDualQuatsTS(
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

// ============================================================================
// DualQuaternionAccelerator - Zero-allocation hot-path converter
// ============================================================================

/**
 * High-performance dual quaternion converter for hot-path usage.
 * 
 * This class maintains a persistent WASM DualQuaternionConverter and
 * reusable TypeScript output buffer to minimize per-frame allocations.
 * 
 * Usage:
 * ```ts
 * const accelerator = new DualQuaternionAccelerator(128); // max 128 joints
 * 
 * // In render loop:
 * const dualQuats = accelerator.convert(jointMatrices, jointCount);
 * // Use dualQuats directly (zero-copy view) or upload to GPU
 * 
 * // For GPU upload:
 * accelerator.uploadToGPU(queue, buffer, jointMatrices, jointCount);
 * 
 * // Cleanup
 * accelerator.dispose();
 * ```
 */
export class DualQuaternionAccelerator {
  private wasmConverter: WasmDualQuatConverter | null = null;
  private tsOutputBuffer: Float32Array;
  private maxJoints: number;
  
  // Reusable temp buffer for TS path
  private tempDQ: DualQuaternion;
  
  constructor(maxJoints: number) {
    this.maxJoints = maxJoints;
    this.tsOutputBuffer = new Float32Array(maxJoints * 8);
    this.tempDQ = {
      real: new Float32Array(4),
      dual: new Float32Array(4),
    };
    
    // Create WASM converter if available
    if (wasmModule !== null) {
      this.wasmConverter = new wasmModule.DualQuaternionConverter(maxJoints);
    }
  }
  
  /**
   * Converts joint matrices to dual quaternions.
   * Returns a view into internal buffer - do not store long-term.
   * 
   * @param matrices - Joint matrices (jointCount × 16 floats)
   * @param jointCount - Number of joints
   * @returns Float32Array view of dual quaternions (jointCount × 8 floats)
   */
  convert(matrices: Float32Array, jointCount: number): Float32Array {
    if (jointCount > this.maxJoints) {
      this.resize(jointCount);
    }
    
    if (this.wasmConverter !== null && wasmMemory !== null) {
      // WASM path - convert and return view into WASM memory
      this.wasmConverter.convert(matrices, jointCount);
      const ptr = this.wasmConverter.get_output_ptr();
      return new Float32Array(wasmMemory.buffer, ptr, jointCount * 8);
    }
    
    // TypeScript fallback path
    for (let i = 0; i < jointCount; i++) {
      const matOffset = i * 16;
      const dqOffset = i * 8;
      
      mat4ToDualQuat(matrices.subarray(matOffset, matOffset + 16), this.tempDQ);
      
      this.tsOutputBuffer[dqOffset + 0] = this.tempDQ.real[0]!;
      this.tsOutputBuffer[dqOffset + 1] = this.tempDQ.real[1]!;
      this.tsOutputBuffer[dqOffset + 2] = this.tempDQ.real[2]!;
      this.tsOutputBuffer[dqOffset + 3] = this.tempDQ.real[3]!;
      this.tsOutputBuffer[dqOffset + 4] = this.tempDQ.dual[0]!;
      this.tsOutputBuffer[dqOffset + 5] = this.tempDQ.dual[1]!;
      this.tsOutputBuffer[dqOffset + 6] = this.tempDQ.dual[2]!;
      this.tsOutputBuffer[dqOffset + 7] = this.tempDQ.dual[3]!;
    }
    
    return this.tsOutputBuffer.subarray(0, jointCount * 8);
  }
  
  /**
   * Converts and uploads dual quaternions directly to GPU buffer.
   * This is the most efficient path for GPU skinning.
   * 
   * @param queue - WebGPU queue
   * @param buffer - Target GPU buffer
   * @param matrices - Joint matrices (jointCount × 16 floats)
   * @param jointCount - Number of joints
   * @param dstOffset - Byte offset in target buffer (default 0)
   */
  uploadToGPU(
    queue: GPUQueue,
    buffer: GPUBuffer,
    matrices: Float32Array,
    jointCount: number,
    dstOffset = 0
  ): void {
    if (jointCount > this.maxJoints) {
      this.resize(jointCount);
    }
    
    if (this.wasmConverter !== null && wasmMemory !== null) {
      // WASM path - zero-copy upload from WASM linear memory
      this.wasmConverter.convert(matrices, jointCount);
      const ptr = this.wasmConverter.get_output_ptr();
      const byteLength = jointCount * 8 * 4;
      
      queue.writeBuffer(buffer, dstOffset, wasmMemory.buffer, ptr, byteLength);
    } else {
      // TypeScript fallback
      const dualQuats = this.convert(matrices, jointCount);
      queue.writeBuffer(buffer, dstOffset, dualQuats as Float32Array<ArrayBuffer>);
    }
  }
  
  /**
   * Resizes internal buffers to accommodate more joints.
   */
  private resize(newMaxJoints: number): void {
    const newMax = Math.max(newMaxJoints, this.maxJoints * 2);
    this.maxJoints = newMax;
    this.tsOutputBuffer = new Float32Array(newMax * 8);
    
    // Recreate WASM converter with new size
    if (wasmModule !== null) {
      this.wasmConverter?.free();
      this.wasmConverter = new wasmModule.DualQuaternionConverter(newMax);
    }
  }
  
  /**
   * Returns whether WASM acceleration is active.
   */
  get isWasmAccelerated(): boolean {
    return this.wasmConverter !== null;
  }
  
  /**
   * Disposes WASM resources. Call when done with the accelerator.
   */
  dispose(): void {
    this.wasmConverter?.free();
    this.wasmConverter = null;
  }
}

