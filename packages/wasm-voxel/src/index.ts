export * from './VoxelChunkMesher';

export interface WasmVoxelEngine {
  generateHeightmap(
    width: number,
    depth: number,
    seed: number,
    scale: number,
    offsetX: number,
    offsetZ: number,
    octaves: number,
    persistence: number,
    lacunarity: number
  ): Float32Array;

  meshChunk(
    voxels: Uint16Array,
    size: number,
    lod?: number
  ): MeshResult;

  memory: WebAssembly.Memory;
  dispose(): void;
}

export interface MeshResult {
  vertices(): Float32Array;
  indices(): Uint32Array;
  normals(): Float32Array;
  uvs(): Float32Array;
  free(): void;
}

let initPromise: Promise<void> | null = null;
let isReady = false;

async function ensureInit(): Promise<void> {
  if (isReady) return;
  if (!initPromise) {
    initPromise = (async () => {
      // Dynamic import to avoid hard dependency at app startup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('../pkg/voxel_engine.js');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const maybeInit = mod && (mod.default || mod.init);
      if (typeof maybeInit === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await maybeInit();
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (typeof mod.init_panic_hook === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        mod.init_panic_hook();
      }
      isReady = true;
    })();
  }
  return initPromise;
}

export async function init(): Promise<WasmVoxelEngine> {
  await ensureInit().catch(() => {
    console.warn('Wasm voxel engine failed to initialize');
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('../pkg/voxel_engine.js');

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const generate_heightmap = mod.generate_heightmap as (
    width: number,
    depth: number,
    seed: number,
    scale: number,
    offsetX: number,
    offsetZ: number,
    octaves: number,
    persistence: number,
    lacunarity: number
  ) => Float32Array;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const mesh_chunk = mod.mesh_chunk as (
    voxels: Uint16Array,
    size: number,
    lod: number
  ) => MeshResult;

  // Note: wasm.memory is internal to the generated module and not exported.
  // The memory property is kept for interface compatibility but not used.

  return {
    generateHeightmap: (width, depth, seed, scale, offsetX, offsetZ, octaves, persistence, lacunarity) => {
      return generate_heightmap(width, depth, seed, scale, offsetX, offsetZ, octaves, persistence, lacunarity);
    },
    meshChunk: (voxels, size, lod = 1) => {
      return mesh_chunk(voxels, size, lod);
    },
    // Memory is not directly accessible from wasm-bindgen generated modules
    memory: null as unknown as WebAssembly.Memory,
    dispose: () => {
      isReady = false;
      initPromise = null;
    },
  };
}

