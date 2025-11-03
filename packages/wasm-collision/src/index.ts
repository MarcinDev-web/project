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

export interface WasmCollision {
  obbIntersect(a: ObbFlat, b: ObbFlat): boolean;
  batchCheck(preview: ObbFlat, others: ObbFlatArray): Uint32Array;
  batchCheckTrs(preview: Trs, others: TrsArray): Uint32Array;
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

  const api: WasmCollision = {
    obbIntersect: (a, b) => {
      try {
        return obb_intersect(a.center, a.axes, a.half, b.center, b.axes, b.half);
      } catch (error) {
        // Log error for debugging
        console.error('[wasm-collision] obbIntersect error:', error);
        // Re-throw to allow caller to fallback to TypeScript implementation
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
    dispose: () => {
      // No explicit deinit required; allow GC to reclaim module when unused.
      isReady = false;
      initPromise = null;
    },
  };

  return api;
}

export { getTrsBuffers, releaseTrsBuffers, type TrsBuffers } from './pool';
