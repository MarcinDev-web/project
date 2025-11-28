/**
 * WASM-accelerated animation sampling bridge
 * 
 * Provides high-performance batch pose sampling via Rust/WASM:
 * - Binary search O(log n) for interval finding
 * - Temporal coherence with last-frame hints
 * - Single WASM call per pose sample (reduces JS<->WASM boundary overhead)
 */

import type { AnimationClip, Track } from '../core/AnimationClip';
import type { Pose } from '../core/Pose';

// WASM module interface (loaded dynamically)
interface AnimationWasm {
  batch_sample_pose(
    trackJointIndices: Uint32Array,
    trackTypes: Uint8Array,
    trackInterpolations: Uint8Array,
    trackKeyCounts: Uint32Array,
    allTimes: Float32Array,
    allValues: Float32Array,
    time: number,
    hints: Uint32Array,
    outTranslations: Float32Array,
    outRotations: Float32Array,
    outScales: Float32Array,
  ): void;

  blend_poses(
    outTranslations: Float32Array,
    outRotations: Float32Array,
    outScales: Float32Array,
    aTranslations: Float32Array,
    aRotations: Float32Array,
    aScales: Float32Array,
    bTranslations: Float32Array,
    bRotations: Float32Array,
    bScales: Float32Array,
    weight: number,
    jointCount: number,
  ): void;
}

let wasmModule: AnimationWasm | null = null;
let wasmLoadPromise: Promise<AnimationWasm> | null = null;

/**
 * Initialize WASM module (call once at app start)
 */
export async function initWasmSampler(): Promise<void> {
  if (wasmModule) return;

  if (!wasmLoadPromise) {
    wasmLoadPromise = loadWasmModule();
  }

  wasmModule = await wasmLoadPromise;
}

async function loadWasmModule(): Promise<AnimationWasm> {
  // Dynamic import of WASM package
  try {
    const { init, batch_sample_pose, blend_poses } = await import('@engine/wasm-animation');
    await init();
    return { batch_sample_pose, blend_poses } as AnimationWasm;
  } catch {
    console.warn(
      '[WasmSampler] WASM module not available, falling back to JS implementation',
    );
    throw new Error('WASM module not available');
  }
}

/**
 * Check if WASM sampler is available
 */
export function isWasmAvailable(): boolean {
  return wasmModule !== null;
}

/**
 * Precompiled clip data for fast WASM sampling
 */
export interface CompiledClip {
  readonly clip: AnimationClip;
  readonly trackJointIndices: Uint32Array;
  readonly trackTypes: Uint8Array;
  readonly trackInterpolations: Uint8Array;
  readonly trackKeyCounts: Uint32Array;
  readonly allTimes: Float32Array;
  readonly allValues: Float32Array;
  readonly trackCount: number;
}

/**
 * Per-instance hint state for temporal coherence
 */
export interface SamplerHints {
  hints: Uint32Array;
}

/**
 * Compile an AnimationClip into optimized format for WASM sampling
 */
export function compileClip(clip: AnimationClip): CompiledClip {
  const trackCount = clip.tracks.length;

  // Calculate total sizes
  let totalKeyframes = 0;
  let totalValues = 0;

  for (const track of clip.tracks) {
    totalKeyframes += track.times.length;
    const stride = track.kind === 'rotation' ? 4 : 3;
    totalValues += track.times.length * stride;
  }

  // Allocate arrays
  const trackJointIndices = new Uint32Array(trackCount);
  const trackTypes = new Uint8Array(trackCount);
  const trackInterpolations = new Uint8Array(trackCount);
  const trackKeyCounts = new Uint32Array(trackCount);
  const allTimes = new Float32Array(totalKeyframes);
  const allValues = new Float32Array(totalValues);

  // Fill arrays
  let timesOffset = 0;
  let valuesOffset = 0;

  for (let i = 0; i < trackCount; i++) {
    const track = clip.tracks[i]!;

    trackJointIndices[i] = track.jointIndex;
    trackTypes[i] = trackKindToType(track.kind);
    trackInterpolations[i] = interpolationToCode(track.interpolation);
    trackKeyCounts[i] = track.times.length;

    // Copy times
    allTimes.set(track.times, timesOffset);
    timesOffset += track.times.length;

    // Copy values
    allValues.set(track.values, valuesOffset);
    const stride = track.kind === 'rotation' ? 4 : 3;
    valuesOffset += track.times.length * stride;
  }

  return {
    clip,
    trackJointIndices,
    trackTypes,
    trackInterpolations,
    trackKeyCounts,
    allTimes,
    allValues,
    trackCount,
  };
}

/**
 * Create hint state for an instance (reuse across frames)
 */
export function createHints(trackCount: number): SamplerHints {
  return {
    hints: new Uint32Array(trackCount),
  };
}

/**
 * Reset hints (call when animation loops or changes)
 */
export function resetHints(hints: SamplerHints): void {
  hints.hints.fill(0);
}

/**
 * Sample a compiled clip into a pose using WASM
 */
export function sampleClipWasm(
  compiled: CompiledClip,
  time: number,
  hints: SamplerHints,
  outPose: Pose,
): void {
  if (!wasmModule) {
    throw new Error('WASM sampler not initialized. Call initWasmSampler() first.');
  }

  wasmModule.batch_sample_pose(
    compiled.trackJointIndices,
    compiled.trackTypes,
    compiled.trackInterpolations,
    compiled.trackKeyCounts,
    compiled.allTimes,
    compiled.allValues,
    time,
    hints.hints,
    outPose.localTranslations,
    outPose.localRotations,
    outPose.localScales,
  );
}

/**
 * Blend two poses using WASM (optimized quaternion slerp)
 */
export function blendPosesWasm(
  out: Pose,
  a: Pose,
  b: Pose,
  weight: number,
): void {
  if (!wasmModule) {
    throw new Error('WASM sampler not initialized. Call initWasmSampler() first.');
  }

  wasmModule.blend_poses(
    out.localTranslations,
    out.localRotations,
    out.localScales,
    a.localTranslations,
    a.localRotations,
    a.localScales,
    b.localTranslations,
    b.localRotations,
    b.localScales,
    weight,
    out.jointCount,
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function trackKindToType(kind: Track['kind']): number {
  switch (kind) {
    case 'translation':
      return 0;
    case 'rotation':
      return 1;
    case 'scale':
      return 2;
  }
}

function interpolationToCode(interp: string): number {
  switch (interp) {
    case 'step':
      return 0;
    case 'linear':
      return 1;
    case 'cubic':
      return 2;
    default:
      return 1;
  }
}

