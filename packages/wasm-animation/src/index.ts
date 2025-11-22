import init, { AnimationWorld } from '../pkg/animation.js';

export { init, AnimationWorld };

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
