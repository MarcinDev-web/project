import init, { 
  AnimationWorld,
  batch_mat4_to_dual_quat,
  batch_mat4_to_dual_quat_inplace,
  DualQuaternionConverter,
  batch_sample_pose,
  blend_poses,
} from '../pkg/animation.js';

export { 
  init, 
  AnimationWorld,
  batch_mat4_to_dual_quat,
  batch_mat4_to_dual_quat_inplace,
  DualQuaternionConverter,
  batch_sample_pose,
  blend_poses,
};

// Re-export types that might be needed
export type { InitOutput } from '../pkg/animation.js';

let wasmMemory: WebAssembly.Memory | undefined;

export async function initAnimationWasm(): Promise<AnimationWorld> {
  const wasm = await init();
  wasmMemory = wasm.memory;
  return new AnimationWorld();
}

export function getWasmMemory(): WebAssembly.Memory {
  if (!wasmMemory) throw new Error('WASM module not initialized');
  return wasmMemory;
}

/**
 * Returns a view into the WASM memory for the output buffer.
 * WARNING: This view is valid only until the WASM memory grows.
 * You should request this view every frame or check for detachment.
 */
export function getOutputBufferView(world: AnimationWorld): Float32Array {
  const memory = getWasmMemory();
  const ptr = world.get_output_buffer_ptr();
  const len = world.get_output_buffer_len();
  return new Float32Array(memory.buffer, ptr, len);
}

/**
 * Uploads the animation output buffer directly to a WebGPU buffer.
 * This avoids copying data to a temporary JS Float32Array.
 */
export function uploadToGPU(
  _device: GPUDevice,
  queue: GPUQueue,
  targetBuffer: GPUBuffer,
  world: AnimationWorld,
  dstOffset = 0
): void {
  const memory = getWasmMemory();
  const ptr = world.get_output_buffer_ptr();
  const len = world.get_output_buffer_len();
  const byteLength = len * 4;

  // Direct upload from WASM linear memory
  queue.writeBuffer(
    targetBuffer,
    dstOffset,
    memory.buffer,
    ptr,
    byteLength
  );
}

// Helper to get view of local transforms for an instance
export function getInstanceLocalTransforms(world: AnimationWorld, instanceId: number): {
  translations: Float32Array | null;
  rotations: Float32Array | null;
  scales: Float32Array | null;
} {
  const memory = getWasmMemory();
  const jointCount = world.get_instance_joint_count(instanceId);
  if (jointCount === 0) {
    return { translations: null, rotations: null, scales: null };
  }

  const tPtr = world.get_instance_local_translations_ptr(instanceId);
  const rPtr = world.get_instance_local_rotations_ptr(instanceId);
  const sPtr = world.get_instance_local_scales_ptr(instanceId);

  // T and S are Vec3 (3 floats), R is Quat (4 floats)
  // Be careful with alignment and strides if they were structs, but in Rust we used Vec<Vec3> which is packed f32
  
  return {
    translations: tPtr ? new Float32Array(memory.buffer, tPtr, jointCount * 3) : null,
    rotations: rPtr ? new Float32Array(memory.buffer, rPtr, jointCount * 4) : null,
    scales: sPtr ? new Float32Array(memory.buffer, sPtr, jointCount * 3) : null,
  };
}

// ============================================================================
// Dual Quaternion Conversion Helpers
// ============================================================================

/**
 * Returns a view into the DualQuaternionConverter's output buffer.
 * WARNING: This view is valid only until the WASM memory grows or the converter is used again.
 * 
 * @param converter - The DualQuaternionConverter instance
 * @param jointCount - Number of joints to view (determines length)
 * @returns Float32Array view into WASM memory
 */
export function getDualQuatConverterView(
  converter: DualQuaternionConverter,
  jointCount: number
): Float32Array {
  const memory = getWasmMemory();
  const ptr = converter.get_output_ptr();
  const len = jointCount * 8; // 8 floats per dual quaternion
  return new Float32Array(memory.buffer, ptr, len);
}

/**
 * Converts joint matrices to dual quaternions and uploads directly to GPU.
 * This is the most efficient path: WASM conversion + zero-copy GPU upload.
 * 
 * @param converter - Persistent DualQuaternionConverter (reused across frames)
 * @param queue - WebGPU queue
 * @param targetBuffer - GPU buffer to write dual quaternions to
 * @param matrices - Joint matrices as Float32Array (N×16 floats)
 * @param jointCount - Number of joints
 * @param dstOffset - Byte offset in target buffer (default 0)
 */
export function convertAndUploadDualQuatsToGPU(
  converter: DualQuaternionConverter,
  queue: GPUQueue,
  targetBuffer: GPUBuffer,
  matrices: Float32Array,
  jointCount: number,
  dstOffset = 0
): void {
  // Convert in WASM
  converter.convert(matrices, jointCount);
  
  // Zero-copy upload from WASM linear memory
  const memory = getWasmMemory();
  const ptr = converter.get_output_ptr();
  const byteLength = jointCount * 8 * 4; // 8 floats * 4 bytes
  
  queue.writeBuffer(
    targetBuffer,
    dstOffset,
    memory.buffer,
    ptr,
    byteLength
  );
}

/**
 * Simple batch conversion without persistent state.
 * Creates a new output array each call - use DualQuaternionConverter for hot paths.
 * 
 * @param matrices - Joint matrices as Float32Array (N×16 floats)
 * @param jointCount - Number of joints
 * @returns Float32Array of dual quaternions (N×8 floats)
 */
export function convertMatricesToDualQuats(
  matrices: Float32Array,
  jointCount: number
): Float32Array {
  // This allocates a new Vec in Rust and copies to JS
  return batch_mat4_to_dual_quat(matrices, jointCount);
}
