/**
 * @engine/wasm-avatar-builder
 *
 * High-performance avatar mesh generation and skeleton system using Rust/WASM.
 *
 * ## Features
 * - Procedural mesh generation (sphere, capsule, torso) - 5-10x faster than JS
 * - Skeleton joint hierarchy with world matrix computation
 * - GPU skinning matrix computation
 * - Pose blending with SLERP for rotations
 *
 * ## Usage
 * ```ts
 * import { initWasm, generateSphere, AvatarSkeleton } from '@engine/wasm-avatar-builder';
 *
 * // Initialize WASM module (once at startup)
 * await initWasm();
 *
 * // Generate sphere mesh
 * const sphereMesh = generateSphere(16);
 * const vertices = new Float32Array(wasmMemory, sphereMesh.vertices_ptr(), sphereMesh.vertices_len());
 * const indices = new Uint16Array(wasmMemory, sphereMesh.indices_ptr(), sphereMesh.indices_len());
 *
 * // Create skeleton
 * const skeleton = new AvatarSkeleton(10);
 * skeleton.set_parent(1, 0);
 * skeleton.set_translation(0, 0, 1, 0);
 * skeleton.compute_world_matrices();
 * ```
 */

import init, {
  // Mesh generation
  generate_sphere,
  generate_capsule_y,
  generate_heroic_torso,
  SphereParams,
  CapsuleParams,
  TorsoParams,
  MeshData,
  // Skeleton
  AvatarSkeleton,
  batch_set_transforms,
  // Skinning
  compute_skin_matrices,
  compute_skin_matrices_inplace,
  SkinMatrixComputer,
  blend_poses,
} from '../pkg/avatar_builder.js';

// Re-export all types and functions
export {
  // Mesh generation
  generate_sphere,
  generate_capsule_y,
  generate_heroic_torso,
  SphereParams,
  CapsuleParams,
  TorsoParams,
  MeshData,
  // Skeleton
  AvatarSkeleton,
  batch_set_transforms,
  // Skinning
  compute_skin_matrices,
  compute_skin_matrices_inplace,
  SkinMatrixComputer,
  blend_poses,
};

// Convenience aliases
export const generateSphere = generate_sphere;
export const generateCapsuleY = generate_capsule_y;
export const generateHeroicTorso = generate_heroic_torso;
export const computeSkinMatrices = compute_skin_matrices;
export const blendPoses = blend_poses;

let wasmModule: Awaited<ReturnType<typeof init>> | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the WASM module.
 * Must be called before using any WASM functions.
 * Safe to call multiple times - subsequent calls are no-ops.
 */
export async function initWasm(): Promise<void> {
  if (wasmModule) return;

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    wasmModule = await init();
  })();

  await initPromise;
}

/**
 * Check if WASM module is initialized.
 */
export function isInitialized(): boolean {
  return wasmModule !== null;
}

/**
 * Get WASM memory for zero-copy access to buffers.
 * Returns null if WASM is not initialized.
 */
export function getWasmMemory(): WebAssembly.Memory | null {
  // Note: wasm-bindgen doesn't directly expose memory
  // Use the ptr + len methods on MeshData etc. for zero-copy access
  return null;
}

// Type definitions for better TypeScript experience
export interface MeshResult {
  vertices: Float32Array;
  indices: Uint16Array;
  vertexCount: number;
  triangleCount: number;
}

/**
 * Generate a sphere mesh and return typed arrays.
 *
 * @param segments - Number of horizontal/vertical segments (default: 16, min: 3)
 * @returns MeshResult with vertices and indices as typed arrays
 */
export function createSphereMesh(segments = 16): MeshResult {
  const mesh = generate_sphere(segments);
  return extractMeshData(mesh);
}

/**
 * Generate a capsule mesh and return typed arrays.
 *
 * @param radius - Capsule radius (default: 0.5)
 * @param cylinderHeight - Cylinder section height (default: 1.0)
 * @param radialSegments - Radial segments (default: 16)
 * @param hemisphereSegments - Hemisphere segments (default: 8)
 * @returns MeshResult with vertices and indices as typed arrays
 */
export function createCapsuleMesh(
  radius = 0.5,
  cylinderHeight = 1.0,
  radialSegments = 16,
  hemisphereSegments = 8
): MeshResult {
  const params = new CapsuleParams(radius, cylinderHeight, radialSegments, hemisphereSegments);
  const mesh = generate_capsule_y(params);
  return extractMeshData(mesh);
}

/**
 * Generate a heroic torso mesh and return typed arrays.
 *
 * @returns MeshResult with vertices and indices as typed arrays
 */
export function createTorsoMesh(): MeshResult {
  const params = new TorsoParams();
  const mesh = generate_heroic_torso(params);
  return extractMeshData(mesh);
}

/**
 * Extract mesh data from WASM MeshData object into TypeScript arrays.
 * Note: This copies data. For zero-copy, use the ptr methods directly.
 */
function extractMeshData(mesh: MeshData): MeshResult {
  return {
    vertices: new Float32Array(mesh.get_vertices()),
    indices: new Uint16Array(mesh.get_indices()),
    vertexCount: mesh.vertex_count(),
    triangleCount: mesh.triangle_count(),
  };
}
