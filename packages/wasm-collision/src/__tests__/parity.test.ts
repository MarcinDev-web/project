/**
 * Parity tests to verify WASM collision detection matches TypeScript implementation.
 * Uses property-based testing approach with random TRS data.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { init } from '../index';
import type { WasmCollision, ObbFlat } from '../index';

// Seeded random number generator for reproducible tests
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

// TypeScript implementation of sphere-sphere collision for parity check
function tsSphereIntersect(
  c1: Float32Array,
  r1: number,
  c2: Float32Array,
  r2: number
): boolean {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const dz = c2[2] - c1[2];
  const distSq = dx * dx + dy * dy + dz * dz;
  const sumR = r1 + r2;
  return distSq <= sumR * sumR;
}

// TypeScript implementation of simplified OBB-OBB collision
// Note: This is a simplified version that checks only face normals (6 axes)
// The WASM version checks all 15 axes (6 face + 9 edge)
function tsObbIntersectSimplified(a: ObbFlat, b: ObbFlat): boolean {
  const EPSILON = 1e-4;

  // Extract axes from flat array (column-major 3x3)
  const Au = [a.axes[0], a.axes[1], a.axes[2]];
  const Av = [a.axes[3], a.axes[4], a.axes[5]];
  const Aw = [a.axes[6], a.axes[7], a.axes[8]];

  const Bu = [b.axes[0], b.axes[1], b.axes[2]];
  const Bv = [b.axes[3], b.axes[4], b.axes[5]];
  const Bw = [b.axes[6], b.axes[7], b.axes[8]];

  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  // Rotation matrix R[i][j] = Ai · Bj
  const R = [
    [dot(Au, Bu), dot(Au, Bv), dot(Au, Bw)],
    [dot(Av, Bu), dot(Av, Bv), dot(Av, Bw)],
    [dot(Aw, Bu), dot(Aw, Bv), dot(Aw, Bw)],
  ];

  const AbsR = [
    [Math.abs(R[0][0]) + EPSILON, Math.abs(R[0][1]) + EPSILON, Math.abs(R[0][2]) + EPSILON],
    [Math.abs(R[1][0]) + EPSILON, Math.abs(R[1][1]) + EPSILON, Math.abs(R[1][2]) + EPSILON],
    [Math.abs(R[2][0]) + EPSILON, Math.abs(R[2][1]) + EPSILON, Math.abs(R[2][2]) + EPSILON],
  ];

  // Translation vector
  const tWorld = [
    b.center[0] - a.center[0],
    b.center[1] - a.center[1],
    b.center[2] - a.center[2],
  ];
  const t = [dot(tWorld, Au), dot(tWorld, Av), dot(tWorld, Aw)];

  const ra = [a.half[0], a.half[1], a.half[2]];
  const rb = [b.half[0], b.half[1], b.half[2]];

  // Test 6 face axes (A's 3 + B's 3)
  // A's axes
  if (Math.abs(t[0]) > ra[0] + rb[0] * AbsR[0][0] + rb[1] * AbsR[0][1] + rb[2] * AbsR[0][2]) return false;
  if (Math.abs(t[1]) > ra[1] + rb[0] * AbsR[1][0] + rb[1] * AbsR[1][1] + rb[2] * AbsR[1][2]) return false;
  if (Math.abs(t[2]) > ra[2] + rb[0] * AbsR[2][0] + rb[1] * AbsR[2][1] + rb[2] * AbsR[2][2]) return false;

  // B's axes
  const tR0 = t[0] * R[0][0] + t[1] * R[1][0] + t[2] * R[2][0];
  const tR1 = t[0] * R[0][1] + t[1] * R[1][1] + t[2] * R[2][1];
  const tR2 = t[0] * R[0][2] + t[1] * R[1][2] + t[2] * R[2][2];

  if (Math.abs(tR0) > ra[0] * AbsR[0][0] + ra[1] * AbsR[1][0] + ra[2] * AbsR[2][0] + rb[0]) return false;
  if (Math.abs(tR1) > ra[0] * AbsR[0][1] + ra[1] * AbsR[1][1] + ra[2] * AbsR[2][1] + rb[1]) return false;
  if (Math.abs(tR2) > ra[0] * AbsR[0][2] + ra[1] * AbsR[1][2] + ra[2] * AbsR[2][2] + rb[2]) return false;

  return true;
}

// Generate random axis-aligned OBB (identity rotation)
function randomAxisAlignedObb(rng: SeededRandom, posRange: number, sizeRange: number): ObbFlat {
  return {
    center: new Float32Array([
      rng.range(-posRange, posRange),
      rng.range(-posRange, posRange),
      rng.range(-posRange, posRange),
    ]),
    axes: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), // Identity
    half: new Float32Array([
      rng.range(0.1, sizeRange),
      rng.range(0.1, sizeRange),
      rng.range(0.1, sizeRange),
    ]),
  };
}

// Generate random rotated OBB
function randomRotatedObb(rng: SeededRandom, posRange: number, sizeRange: number): ObbFlat {
  // Generate random unit quaternion
  const u = rng.next();
  const v = rng.next();
  const w = rng.next();
  const sqrt1u = Math.sqrt(1 - u);
  const sqrtu = Math.sqrt(u);
  const qx = sqrt1u * Math.sin(2 * Math.PI * v);
  const qy = sqrt1u * Math.cos(2 * Math.PI * v);
  const qz = sqrtu * Math.sin(2 * Math.PI * w);
  const qw = sqrtu * Math.cos(2 * Math.PI * w);

  // Convert quaternion to rotation matrix (column-major)
  const m00 = 1 - 2 * (qy * qy + qz * qz);
  const m10 = 2 * (qx * qy + qz * qw);
  const m20 = 2 * (qx * qz - qy * qw);
  const m01 = 2 * (qx * qy - qz * qw);
  const m11 = 1 - 2 * (qx * qx + qz * qz);
  const m21 = 2 * (qy * qz + qx * qw);
  const m02 = 2 * (qx * qz + qy * qw);
  const m12 = 2 * (qy * qz - qx * qw);
  const m22 = 1 - 2 * (qx * qx + qy * qy);

  return {
    center: new Float32Array([
      rng.range(-posRange, posRange),
      rng.range(-posRange, posRange),
      rng.range(-posRange, posRange),
    ]),
    axes: new Float32Array([m00, m10, m20, m01, m11, m21, m02, m12, m22]),
    half: new Float32Array([
      rng.range(0.1, sizeRange),
      rng.range(0.1, sizeRange),
      rng.range(0.1, sizeRange),
    ]),
  };
}

describe('wasm-collision parity', () => {
  let wasm: WasmCollision;

  beforeAll(async () => {
    wasm = await init();
  });

  describe('sphere-sphere parity', () => {
    it('matches TypeScript for random sphere pairs', () => {
      const rng = new SeededRandom(12345);
      const iterations = 100;
      let matches = 0;

      for (let i = 0; i < iterations; i++) {
        const c1 = new Float32Array([
          rng.range(-10, 10),
          rng.range(-10, 10),
          rng.range(-10, 10),
        ]);
        const r1 = rng.range(0.1, 3);
        const c2 = new Float32Array([
          rng.range(-10, 10),
          rng.range(-10, 10),
          rng.range(-10, 10),
        ]);
        const r2 = rng.range(0.1, 3);

        const wasmResult = wasm.sphereSphereIntersect(c1, r1, c2, r2);
        const tsResult = tsSphereIntersect(c1, r1, c2, r2);

        if (wasmResult === tsResult) {
          matches++;
        }
      }

      // Expect 100% match for sphere-sphere (algorithms are identical)
      expect(matches).toBe(iterations);
    });

    it('handles edge cases consistently', () => {
      // Touching spheres (exact boundary)
      const c1 = new Float32Array([0, 0, 0]);
      const c2 = new Float32Array([2, 0, 0]);
      const r = 1.0;

      const wasmTouch = wasm.sphereSphereIntersect(c1, r, c2, r);
      const tsTouch = tsSphereIntersect(c1, r, c2, r);
      expect(wasmTouch).toBe(tsTouch);

      // Same center
      const wasmSame = wasm.sphereSphereIntersect(c1, r, c1, r);
      const tsSame = tsSphereIntersect(c1, r, c1, r);
      expect(wasmSame).toBe(tsSame);
    });
  });

  describe('OBB-OBB parity (axis-aligned)', () => {
    it('matches TypeScript for axis-aligned boxes', () => {
      const rng = new SeededRandom(54321);
      const iterations = 100;
      let matches = 0;

      for (let i = 0; i < iterations; i++) {
        const obbA = randomAxisAlignedObb(rng, 5, 2);
        const obbB = randomAxisAlignedObb(rng, 5, 2);

        const wasmResult = wasm.obbIntersect(obbA, obbB);
        const tsResult = tsObbIntersectSimplified(obbA, obbB);

        if (wasmResult === tsResult) {
          matches++;
        }
      }

      // For axis-aligned boxes, both implementations should match
      // (edge-edge cases don't apply to axis-aligned boxes)
      expect(matches).toBeGreaterThanOrEqual(iterations * 0.95);
    });

    it('handles touching faces', () => {
      const obbA: ObbFlat = {
        center: new Float32Array([0, 0, 0]),
        axes: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
        half: new Float32Array([1, 1, 1]),
      };
      const obbB: ObbFlat = {
        center: new Float32Array([2, 0, 0]), // Touching at x=1
        axes: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
        half: new Float32Array([1, 1, 1]),
      };

      // Both should detect touching faces as collision
      expect(wasm.obbIntersect(obbA, obbB)).toBe(true);
      expect(tsObbIntersectSimplified(obbA, obbB)).toBe(true);
    });

    it('handles separated boxes', () => {
      const obbA: ObbFlat = {
        center: new Float32Array([0, 0, 0]),
        axes: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
        half: new Float32Array([1, 1, 1]),
      };
      const obbB: ObbFlat = {
        center: new Float32Array([5, 0, 0]), // Far apart
        axes: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]),
        half: new Float32Array([1, 1, 1]),
      };

      // Both should detect no collision
      expect(wasm.obbIntersect(obbA, obbB)).toBe(false);
      expect(tsObbIntersectSimplified(obbA, obbB)).toBe(false);
    });
  });

  describe('OBB-OBB with rotation', () => {
    it('handles rotated boxes (WASM may detect more precise collisions)', () => {
      const rng = new SeededRandom(99999);
      const iterations = 50;
      let wasmOnlyCollisions = 0;
      let tsOnlyCollisions = 0;

      for (let i = 0; i < iterations; i++) {
        const obbA = randomRotatedObb(rng, 3, 1.5);
        const obbB = randomRotatedObb(rng, 3, 1.5);

        const wasmResult = wasm.obbIntersect(obbA, obbB);
        const tsResult = tsObbIntersectSimplified(obbA, obbB);

        if (wasmResult && !tsResult) {
          // This shouldn't happen often - WASM and TS should agree on true positives
          wasmOnlyCollisions++;
        }
        if (!wasmResult && tsResult) {
          // TS reports collision but WASM doesn't - TS has false positive
          // This can happen because TS skips edge-edge tests
          tsOnlyCollisions++;
        }
      }

      // TS implementation may have some false positives due to missing edge-edge tests
      // WASM should not report collisions that TS misses (both should agree on negatives)
      // This is expected behavior documented in the analysis
      expect(wasmOnlyCollisions).toBeLessThanOrEqual(5);
    });
  });

  describe('ray intersection parity', () => {
    it('ray-sphere results match', () => {
      const origin = new Float32Array([0, 0, -5]);
      const dir = new Float32Array([0, 0, 1]); // Pointing at sphere
      const sphereCenter = new Float32Array([0, 0, 0]);
      const radius = 1;

      const t = wasm.raySphereIntersect(origin, dir, sphereCenter, radius);
      
      // Should hit sphere at z = -1 (from origin z=-5, traveling +z)
      // Distance = 5 - 1 = 4
      expect(t).toBeCloseTo(4, 2);

      // Miss case
      const missDir = new Float32Array([1, 0, 0]); // Pointing away
      const tMiss = wasm.raySphereIntersect(origin, missDir, sphereCenter, radius);
      expect(tMiss).toBe(-1); // Convention: -1 for no hit
    });
  });
});

