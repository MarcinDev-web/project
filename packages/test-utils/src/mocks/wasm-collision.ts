/**
 * Mock implementation of @engine/wasm-collision for testing.
 * Provides stub implementations of collision detection functions.
 */
import type {
  WasmCollision,
  ObbFlat,
  ObbFlatArray,
  Trs,
  TrsArray,
  CollisionWorld,
  CollisionContact,
} from '@engine/wasm-collision';

/**
 * Simple AABB collision check for testing (no rotation support).
 */
function simpleAabbCheck(
  aCenter: Float32Array,
  aHalf: Float32Array,
  bCenter: Float32Array,
  bHalf: Float32Array
): boolean {
  for (let i = 0; i < 3; i++) {
    const dist = Math.abs(aCenter[i] - bCenter[i]);
    const sumHalf = aHalf[i] + bHalf[i];
    if (dist > sumHalf) return false;
  }
  return true;
}

/**
 * Create a mock CollisionWorld instance
 */
function createMockCollisionWorld(): CollisionWorld {
  let count = 0;
  const positions = new Float32Array(0);
  const rotations = new Float32Array(0);
  const scales = new Float32Array(0);

  return {
    free: () => {},
    resize: (n: number) => {
      count = n;
    },
    clear: () => {
      count = 0;
    },
    get_positions_ptr: () => 0,
    get_rotations_ptr: () => 0,
    get_scales_ptr: () => 0,
    check_collisions: () => new Uint32Array(0),
    query_frustum: () => new Uint32Array(0),
    init_occlusion_culling: () => {},
    clear_occlusion_buffer: () => {},
    rasterize_occluders: () => {},
  };
}

/**
 * Create a mock CollisionContact result
 */
function createMockContact(hasCollision: boolean): CollisionContact {
  return {
    has_collision: hasCollision,
    depth: hasCollision ? 0.1 : 0,
    normal_x: hasCollision ? 1 : 0,
    normal_y: 0,
    normal_z: 0,
    point_x: 0,
    point_y: 0,
    point_z: 0,
    get_normal: () => new Float32Array([hasCollision ? 1 : 0, 0, 0]),
    get_point: () => new Float32Array([0, 0, 0]),
  };
}

/**
 * Mock WasmCollision implementation for testing.
 */
export const mockWasmCollision: WasmCollision = {
  obbIntersect: (a: ObbFlat, b: ObbFlat): boolean => {
    // Simple AABB check for testing (ignores rotation)
    return simpleAabbCheck(a.center, a.half, b.center, b.half);
  },

  obbIntersectWithContact: (a: ObbFlat, b: ObbFlat): CollisionContact => {
    const collides = simpleAabbCheck(a.center, a.half, b.center, b.half);
    return createMockContact(collides);
  },

  sphereSphereIntersect: (
    aCenter: Float32Array,
    aRadius: number,
    bCenter: Float32Array,
    bRadius: number
  ): boolean => {
    const dx = aCenter[0] - bCenter[0];
    const dy = aCenter[1] - bCenter[1];
    const dz = aCenter[2] - bCenter[2];
    const distSq = dx * dx + dy * dy + dz * dz;
    const radiusSum = aRadius + bRadius;
    return distSq <= radiusSum * radiusSum;
  },

  sphereObbIntersect: (
    sCenter: Float32Array,
    sRadius: number,
    bCenter: Float32Array,
    _bAxes: Float32Array,
    bHalf: Float32Array
  ): boolean => {
    // Simplified sphere-AABB check (ignores OBB rotation)
    let sqDist = 0;
    for (let i = 0; i < 3; i++) {
      const min = bCenter[i] - bHalf[i];
      const max = bCenter[i] + bHalf[i];
      const v = sCenter[i];
      if (v < min) sqDist += (min - v) * (min - v);
      if (v > max) sqDist += (v - max) * (v - max);
    }
    return sqDist <= sRadius * sRadius;
  },

  capsuleSphereIntersect: (
    cBase: Float32Array,
    cTip: Float32Array,
    cRadius: number,
    sCenter: Float32Array,
    sRadius: number
  ): boolean => {
    // Simplified: treat capsule as line segment and find closest point
    const dx = cTip[0] - cBase[0];
    const dy = cTip[1] - cBase[1];
    const dz = cTip[2] - cBase[2];
    const lenSq = dx * dx + dy * dy + dz * dz;

    let t = 0;
    if (lenSq > 0) {
      t = Math.max(
        0,
        Math.min(
          1,
          ((sCenter[0] - cBase[0]) * dx +
            (sCenter[1] - cBase[1]) * dy +
            (sCenter[2] - cBase[2]) * dz) /
            lenSq
        )
      );
    }

    const closestX = cBase[0] + t * dx;
    const closestY = cBase[1] + t * dy;
    const closestZ = cBase[2] + t * dz;

    const distX = sCenter[0] - closestX;
    const distY = sCenter[1] - closestY;
    const distZ = sCenter[2] - closestZ;
    const distSq = distX * distX + distY * distY + distZ * distZ;

    const radiusSum = cRadius + sRadius;
    return distSq <= radiusSum * radiusSum;
  },

  capsuleObbIntersect: (
    _cBase: Float32Array,
    _cTip: Float32Array,
    _cRadius: number,
    _bCenter: Float32Array,
    _bAxes: Float32Array,
    _bHalf: Float32Array
  ): boolean => {
    // Simplified: always return false for complex capsule-OBB
    return false;
  },

  capsuleCapsuleIntersect: (
    _aBase: Float32Array,
    _aTip: Float32Array,
    _aRadius: number,
    _bBase: Float32Array,
    _bTip: Float32Array,
    _bRadius: number
  ): boolean => {
    // Simplified: always return false for complex capsule-capsule
    return false;
  },

  raySphereIntersect: (
    rayOrigin: Float32Array,
    rayDir: Float32Array,
    sCenter: Float32Array,
    sRadius: number
  ): number => {
    // Standard ray-sphere intersection
    const ox = rayOrigin[0] - sCenter[0];
    const oy = rayOrigin[1] - sCenter[1];
    const oz = rayOrigin[2] - sCenter[2];

    const a = rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * rayDir[2];
    const b = 2 * (ox * rayDir[0] + oy * rayDir[1] + oz * rayDir[2]);
    const c = ox * ox + oy * oy + oz * oz - sRadius * sRadius;

    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return -1;

    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    return t >= 0 ? t : -1;
  },

  rayObbIntersect: (
    rayOrigin: Float32Array,
    rayDir: Float32Array,
    bCenter: Float32Array,
    _bAxes: Float32Array,
    bHalf: Float32Array
  ): number => {
    // Simplified ray-AABB intersection (ignores OBB rotation)
    let tmin = -Infinity;
    let tmax = Infinity;

    for (let i = 0; i < 3; i++) {
      const min = bCenter[i] - bHalf[i];
      const max = bCenter[i] + bHalf[i];

      if (Math.abs(rayDir[i]) < 1e-8) {
        if (rayOrigin[i] < min || rayOrigin[i] > max) return -1;
      } else {
        let t1 = (min - rayOrigin[i]) / rayDir[i];
        let t2 = (max - rayOrigin[i]) / rayDir[i];
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return -1;
      }
    }

    return tmin >= 0 ? tmin : -1;
  },

  rayCapsuleIntersect: (
    _rayOrigin: Float32Array,
    _rayDir: Float32Array,
    _cBase: Float32Array,
    _cTip: Float32Array,
    _cRadius: number
  ): number => {
    // Simplified: return -1 (no intersection)
    return -1;
  },

  batchCheck: (preview: ObbFlat, others: ObbFlatArray): Uint32Array => {
    const count = others.centers.length / 3;
    const collisions: number[] = [];

    for (let i = 0; i < count; i++) {
      const otherCenter = new Float32Array([
        others.centers[i * 3],
        others.centers[i * 3 + 1],
        others.centers[i * 3 + 2],
      ]);
      const otherHalf = new Float32Array([
        others.halves[i * 3],
        others.halves[i * 3 + 1],
        others.halves[i * 3 + 2],
      ]);

      if (simpleAabbCheck(preview.center, preview.half, otherCenter, otherHalf)) {
        collisions.push(i);
      }
    }

    return new Uint32Array(collisions);
  },

  batchCheckTrs: (preview: Trs, others: TrsArray): Uint32Array => {
    const count = others.positions.length / 3;
    const collisions: number[] = [];

    // Convert TRS to approximate AABB (half = scale * 0.5)
    const previewHalf = new Float32Array([
      preview.scl[0] * 0.5,
      preview.scl[1] * 0.5,
      preview.scl[2] * 0.5,
    ]);

    for (let i = 0; i < count; i++) {
      const otherPos = new Float32Array([
        others.positions[i * 3],
        others.positions[i * 3 + 1],
        others.positions[i * 3 + 2],
      ]);
      const otherHalf = new Float32Array([
        others.scales[i * 3] * 0.5,
        others.scales[i * 3 + 1] * 0.5,
        others.scales[i * 3 + 2] * 0.5,
      ]);

      if (simpleAabbCheck(preview.pos, previewHalf, otherPos, otherHalf)) {
        collisions.push(i);
      }
    }

    return new Uint32Array(collisions);
  },

  batchCheckAll: (others: TrsArray): Uint32Array => {
    const count = others.positions.length / 3;
    const collisions: number[] = [];

    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const posA = new Float32Array([
          others.positions[i * 3],
          others.positions[i * 3 + 1],
          others.positions[i * 3 + 2],
        ]);
        const halfA = new Float32Array([
          others.scales[i * 3] * 0.5,
          others.scales[i * 3 + 1] * 0.5,
          others.scales[i * 3 + 2] * 0.5,
        ]);
        const posB = new Float32Array([
          others.positions[j * 3],
          others.positions[j * 3 + 1],
          others.positions[j * 3 + 2],
        ]);
        const halfB = new Float32Array([
          others.scales[j * 3] * 0.5,
          others.scales[j * 3 + 1] * 0.5,
          others.scales[j * 3 + 2] * 0.5,
        ]);

        if (simpleAabbCheck(posA, halfA, posB, halfB)) {
          collisions.push(i, j);
        }
      }
    }

    return new Uint32Array(collisions);
  },

  computeSceneBounds: (
    worldMatrices: Float32Array,
    halfExtents: Float32Array
  ): Float32Array | null => {
    const count = worldMatrices.length / 16;
    if (count === 0) return null;

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (let i = 0; i < count; i++) {
      // Extract position from world matrix (column 3)
      const base = i * 16;
      const px = worldMatrices[base + 12];
      const py = worldMatrices[base + 13];
      const pz = worldMatrices[base + 14];

      const hx = halfExtents[i * 3];
      const hy = halfExtents[i * 3 + 1];
      const hz = halfExtents[i * 3 + 2];

      minX = Math.min(minX, px - hx);
      minY = Math.min(minY, py - hy);
      minZ = Math.min(minZ, pz - hz);
      maxX = Math.max(maxX, px + hx);
      maxY = Math.max(maxY, py + hy);
      maxZ = Math.max(maxZ, pz + hz);
    }

    return new Float32Array([minX, minY, minZ, maxX, maxY, maxZ]);
  },

  CollisionWorld: class MockCollisionWorld implements CollisionWorld {
    private count = 0;

    free(): void {}

    resize(n: number): void {
      this.count = n;
    }

    clear(): void {
      this.count = 0;
    }

    get_positions_ptr(): number {
      return 0;
    }

    get_rotations_ptr(): number {
      return 0;
    }

    get_scales_ptr(): number {
      return 0;
    }

    check_collisions(): Uint32Array {
      return new Uint32Array(0);
    }

    query_frustum(_viewProj: Float32Array): Uint32Array {
      return new Uint32Array(0);
    }

    init_occlusion_culling(_width: number, _height: number): void {}

    clear_occlusion_buffer(): void {}

    rasterize_occluders(_indices: Uint32Array, _viewProj: Float32Array): void {}
  } as unknown as new () => CollisionWorld,

  memory: new WebAssembly.Memory({ initial: 1 }),

  dispose: () => {},
};

/**
 * Mock init function that returns the mock implementation.
 */
export async function init(): Promise<WasmCollision> {
  return mockWasmCollision;
}

export default mockWasmCollision;

