export interface WasmMeshProcessor {
  computeNormals(positions: Float32Array, indices: Uint32Array): Float32Array;
  computeNormalsU16(positions: Float32Array, indices: Uint16Array): Float32Array;
  computeUvsBox(positions: Float32Array, normals: Float32Array): Float32Array;
  computeUvsPlanar(positions: Float32Array, normal: Float32Array, scale: number): Float32Array;
  
  memory: WebAssembly.Memory;
  dispose(): void;
}

let initPromise: Promise<void> | null = null;
let isReady = false;

async function ensureInit(): Promise<void> {
  if (isReady) return;
  if (!initPromise) {
    initPromise = (async () => {
      // Dynamic import to avoid hard dependency at app startup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('../pkg/mesh_processor.js');
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

export async function init(): Promise<WasmMeshProcessor> {
  await ensureInit().catch(() => {
    // Propagate error to caller if desired, but by default fall through
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('../pkg/mesh_processor.js');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (typeof mod.init_panic_hook === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mod.init_panic_hook();
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const compute_normals = mod.compute_normals as (positions: Float32Array, indices: Uint32Array) => Float32Array;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const compute_normals_u16 = mod.compute_normals_u16 as (positions: Float32Array, indices: Uint16Array) => Float32Array;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const compute_uvs_box = mod.compute_uvs_box as (positions: Float32Array, normals: Float32Array) => Float32Array;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const compute_uvs_planar = mod.compute_uvs_planar as (positions: Float32Array, normal: Float32Array, scale: number) => Float32Array;

  // Capture memory buffer
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const wasmMemory = mod.initSync 
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ? mod.wasm.memory 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (await (window as any).wasm_bindgen).memory;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const memory = mod.memory || wasmMemory;

  return {
    computeNormals: (positions, indices) => {
      return compute_normals(positions, indices);
    },
    computeNormalsU16: (positions, indices) => {
      return compute_normals_u16(positions, indices);
    },
    computeUvsBox: (positions, normals) => {
      return compute_uvs_box(positions, normals);
    },
    computeUvsPlanar: (positions, normal, scale) => {
      return compute_uvs_planar(positions, normal, scale);
    },
    memory: memory as WebAssembly.Memory,
    dispose: () => {
      isReady = false;
      initPromise = null;
    },
  };
}

