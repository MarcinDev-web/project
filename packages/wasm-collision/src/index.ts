export interface ObbFlat {
  center: Float32Array; // length 3
  axes: Float32Array; // length 9 (u, v, w columns)
  half: Float32Array; // length 3
}

export interface ObbFlatArray {
  centers: Float32Array; // length 3 * N
  axes: Float32Array; // length 9 * N
  halves: Float32Array; // length 3 * N
}

export interface Trs {
  pos: Float32Array; // length 3
  rot: Float32Array; // length 4 (x,y,z,w)
  scl: Float32Array; // length 3
}

export interface TrsArray {
  positions: Float32Array; // length 3 * N
  rotations: Float32Array; // length 4 * N
  scales: Float32Array; // length 3 * N
}

export interface CollisionWorld {
  free(): void;
  resize(count: number): void;
  get_positions_ptr(): number;
  get_rotations_ptr(): number;
  get_scales_ptr(): number;
  check_collisions(): Uint32Array;
}

export interface WasmCollision {
  obbIntersect(a: ObbFlat, b: ObbFlat): boolean;
  sphereSphereIntersect(aCenter: Float32Array, aRadius: number, bCenter: Float32Array, bRadius: number): boolean;
  sphereObbIntersect(sCenter: Float32Array, sRadius: number, bCenter: Float32Array, bAxes: Float32Array, bHalf: Float32Array): boolean;
  capsuleSphereIntersect(cBase: Float32Array, cTip: Float32Array, cRadius: number, sCenter: Float32Array, sRadius: number): boolean;
  capsuleObbIntersect(cBase: Float32Array, cTip: Float32Array, cRadius: number, bCenter: Float32Array, bAxes: Float32Array, bHalf: Float32Array): boolean;
  capsuleCapsuleIntersect(aBase: Float32Array, aTip: Float32Array, aRadius: number, bBase: Float32Array, bTip: Float32Array, bRadius: number): boolean;
  raySphereIntersect(rayOrigin: Float32Array, rayDir: Float32Array, sCenter: Float32Array, sRadius: number): number;
  rayObbIntersect(rayOrigin: Float32Array, rayDir: Float32Array, bCenter: Float32Array, bAxes: Float32Array, bHalf: Float32Array): number;
  batchCheck(preview: ObbFlat, others: ObbFlatArray): Uint32Array;
  batchCheckTrs(preview: Trs, others: TrsArray): Uint32Array;
  batchCheckAll(others: TrsArray): Uint32Array;
  computeSceneBounds(worldMatrices: Float32Array, halfExtents: Float32Array): Float32Array | null;
  
  // New API for zero-copy access
  CollisionWorld: new () => CollisionWorld;
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
      // wasm-pack JS has no TypeScript types, require loose import
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('../pkg/collision.js');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const maybeInit = mod && (mod.default || mod.init);
      if (typeof maybeInit === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await maybeInit();
      }
      // Optional: when the crate is built with the `panic-hook` feature,
      // install console_error_panic_hook for clearer stack traces.
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

export async function init(): Promise<WasmCollision> {
  await ensureInit().catch(() => {
    // Propagate error to caller if desired, but by default fall through
    // so apps can catch and fallback to TS implementation.
  });

  // Re-import after init to get bound functions
  // wasm-pack JS has no TypeScript types, require loose import
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import('../pkg/collision.js');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (typeof mod.init_panic_hook === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mod.init_panic_hook();
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const obb_intersect = mod.obb_intersect as (
    a_center: Float32Array,
    a_axes: Float32Array,
    a_half: Float32Array,
    b_center: Float32Array,
    b_axes: Float32Array,
    b_half: Float32Array
  ) => boolean;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const sphere_sphere_intersect = mod.sphere_sphere_intersect as (
    a_center: Float32Array,
    a_radius: number,
    b_center: Float32Array,
    b_radius: number
  ) => boolean;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const sphere_obb_intersect = mod.sphere_obb_intersect as (
    s_center: Float32Array,
    s_radius: number,
    b_center: Float32Array,
    b_axes: Float32Array,
    b_half: Float32Array
  ) => boolean;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const capsule_sphere_intersect = mod.capsule_sphere_intersect as (
    c_base: Float32Array,
    c_tip: Float32Array,
    c_radius: number,
    s_center: Float32Array,
    s_radius: number
  ) => boolean;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const capsule_obb_intersect = mod.capsule_obb_intersect as (
    c_base: Float32Array,
    c_tip: Float32Array,
    c_radius: number,
    b_center: Float32Array,
    b_axes: Float32Array,
    b_half: Float32Array
  ) => boolean;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const capsule_capsule_intersect = mod.capsule_capsule_intersect as (
    a_base: Float32Array,
    a_tip: Float32Array,
    a_radius: number,
    b_base: Float32Array,
    b_tip: Float32Array,
    b_radius: number
  ) => boolean;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const ray_sphere_intersect = mod.ray_sphere_intersect as (
    ray_origin: Float32Array,
    ray_dir: Float32Array,
    s_center: Float32Array,
    s_radius: number
  ) => number;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const ray_obb_intersect = mod.ray_obb_intersect as (
    ray_origin: Float32Array,
    ray_dir: Float32Array,
    b_center: Float32Array,
    b_axes: Float32Array,
    b_half: Float32Array
  ) => number;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const batch_check = mod.batch_check as (
    pre_center: Float32Array,
    pre_axes: Float32Array,
    pre_half: Float32Array,
    others_centers: Float32Array,
    others_axes: Float32Array,
    others_half: Float32Array
  ) => Uint32Array;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const batch_check_trs = mod.batch_check_trs as (
    pre_pos: Float32Array,
    pre_rot: Float32Array,
    pre_scl: Float32Array,
    others_pos: Float32Array,
    others_rot: Float32Array,
    others_scl: Float32Array
  ) => Uint32Array;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const batch_check_all = mod.batch_check_all as (
    pos: Float32Array,
    rot: Float32Array,
    scl: Float32Array
  ) => Uint32Array;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const compute_scene_bounds =
    typeof mod.compute_scene_bounds === 'function'
      ? (mod.compute_scene_bounds as (
          worldMatrices: Float32Array,
          halfExtents: Float32Array
        ) => Float32Array | undefined)
      : null;

  // Capture memory buffer
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const wasmMemory = mod.initSync 
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ? mod.wasm.memory // Bundler might expose `wasm` on the module
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (await (window as any).wasm_bindgen).memory; // Fallback for some targets

  // Ideally, use the memory exported by the module
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const memory = mod.memory || wasmMemory;

  const api: WasmCollision = {
    obbIntersect: (a, b) => {
      return obb_intersect(a.center, a.axes, a.half, b.center, b.axes, b.half);
    },
    sphereSphereIntersect: (aCenter, aRadius, bCenter, bRadius) => {
      return sphere_sphere_intersect(aCenter, aRadius, bCenter, bRadius);
    },
    sphereObbIntersect: (sCenter, sRadius, bCenter, bAxes, bHalf) => {
      return sphere_obb_intersect(sCenter, sRadius, bCenter, bAxes, bHalf);
    },
    capsuleSphereIntersect: (cBase, cTip, cRadius, sCenter, sRadius) => {
      return capsule_sphere_intersect(cBase, cTip, cRadius, sCenter, sRadius);
    },
    capsuleObbIntersect: (cBase, cTip, cRadius, bCenter, bAxes, bHalf) => {
      return capsule_obb_intersect(cBase, cTip, cRadius, bCenter, bAxes, bHalf);
    },
    capsuleCapsuleIntersect: (aBase, aTip, aRadius, bBase, bTip, bRadius) => {
      return capsule_capsule_intersect(aBase, aTip, aRadius, bBase, bTip, bRadius);
    },
    raySphereIntersect: (rayOrigin, rayDir, sCenter, sRadius) => {
      return ray_sphere_intersect(rayOrigin, rayDir, sCenter, sRadius);
    },
    rayObbIntersect: (rayOrigin, rayDir, bCenter, bAxes, bHalf) => {
      return ray_obb_intersect(rayOrigin, rayDir, bCenter, bAxes, bHalf);
    },
    computeSceneBounds: (worldMatrices, halfExtents) => {
      try {
        if (!compute_scene_bounds) return null;
        const bounds = compute_scene_bounds(worldMatrices, halfExtents);
        return bounds ?? null;
      } catch (error) {
        console.error('[wasm-collision] computeSceneBounds error:', error);
        throw error;
      }
    },
    batchCheck: (preview, others) => {
      try {
        return batch_check(
          preview.center,
          preview.axes,
          preview.half,
          others.centers,
          others.axes,
          others.halves
        );
      } catch (error) {
        console.error('[wasm-collision] batchCheck error:', error);
        throw error;
      }
    },
    batchCheckTrs: (preview, others) => {
      try {
        return batch_check_trs(
          preview.pos,
          preview.rot,
          preview.scl,
          others.positions,
          others.rotations,
          others.scales
        );
      } catch (error) {
        console.error('[wasm-collision] batchCheckTrs error:', error);
        throw error;
      }
    },
    batchCheckAll: (others) => {
      try {
        return batch_check_all(others.positions, others.rotations, others.scales);
      } catch (error) {
        console.error('[wasm-collision] batchCheckAll error:', error);
        throw error;
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    CollisionWorld: mod.CollisionWorld,
    memory: memory as WebAssembly.Memory,
    dispose: () => {
      // No explicit deinit required; allow GC to reclaim module when unused.
      isReady = false;
      initPromise = null;
    },
  };

  return api;
}

export { getTrsBuffers, releaseTrsBuffers, type TrsBuffers } from './pool';
