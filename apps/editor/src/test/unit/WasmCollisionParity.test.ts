import { describe, it, expect } from 'vitest';
import type { Quat, Vec3 } from '@engine/core/math';
import { CollisionDetector, type OBB } from '../../editor/placement/CollisionDetector';
import { init as initWasm } from '@engine/wasm-collision';

function quatNormalize(q: Quat): Quat {
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

function obbFromTRS(center: Vec3, rotation: Quat, scale: Vec3): OBB {
  const rot = quatNormalize(rotation);
  const x = rot[0], y = rot[1], z = rot[2], w = rot[3];
  const m00 = 1 - 2 * (y * y + z * z);
  const m01 = 2 * (x * y - z * w);
  const m02 = 2 * (x * z + y * w);
  const m10 = 2 * (x * y + z * w);
  const m11 = 1 - 2 * (x * x + z * z);
  const m12 = 2 * (y * z - x * w);
  const m20 = 2 * (x * z - y * w);
  const m21 = 2 * (y * z + x * w);
  const m22 = 1 - 2 * (x * x + y * y);
  const u0: Vec3 = [m00, m10, m20];
  const u1: Vec3 = [m01, m11, m21];
  const u2: Vec3 = [m02, m12, m22];
  const half: Vec3 = [Math.max(Math.abs(scale[0]) / 2, 0.001), Math.max(Math.abs(scale[1]) / 2, 0.001), Math.max(Math.abs(scale[2]) / 2, 0.001)];
  return { center: [center[0], center[1], center[2]], axes: [u0, u1, u2], halfSizes: half };
}

function flattenObb(o: OBB) {
  return {
    center: new Float32Array([o.center[0], o.center[1], o.center[2]]),
    axes: new Float32Array([
      o.axes[0][0], o.axes[0][1], o.axes[0][2],
      o.axes[1][0], o.axes[1][1], o.axes[1][2],
      o.axes[2][0], o.axes[2][1], o.axes[2][2],
    ]),
    half: new Float32Array([o.halfSizes[0], o.halfSizes[1], o.halfSizes[2]]),
  } as const;
}

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }

describe.skip('WASM vs TS OBB intersect parity', () => {
  it('matches results over randomized cases', async () => {
    let wasm: Awaited<ReturnType<typeof initWasm>> | null = null;
    try {
      wasm = await initWasm();
    } catch {
      // Skip test gracefully if wasm init fails (e.g., wasm not built on dev machine)
      return;
    }

    for (let i = 0; i < 100; i++) {
      const a = obbFromTRS(
        [rand(-2, 2), rand(-2, 2), rand(-2, 2)],
        [rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(-1, 1)],
        [rand(0.2, 1.5), rand(0.2, 1.5), rand(0.2, 1.5)]
      );
      const b = obbFromTRS(
        [rand(-2, 2), rand(-2, 2), rand(-2, 2)],
        [rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(-1, 1)],
        [rand(0.2, 1.5), rand(0.2, 1.5), rand(0.2, 1.5)]
      );

      const ts = CollisionDetector.obbIntersect(a, b);
      const wa = wasm!.obbIntersect(flattenObb(a) as any, flattenObb(b) as any);
      expect(wa).toBe(ts);
    }
  });

  it('matches results for deterministic edge cases', async () => {
    let wasm: Awaited<ReturnType<typeof initWasm>> | null = null;
    try {
      wasm = await initWasm();
    } catch {
      return;
    }

    const cases: Array<{
      a: OBB;
      b: OBB;
    }> = [];

    // Extremely thin vs aligned box
    cases.push({
      a: obbFromTRS([0, 0, 0], [0, 0, 0, 1], [0.002, 10, 10]),
      b: obbFromTRS([0.001, 0, 0], [0, 0, 0, 1], [2, 2, 2]),
    });

    // Very large scales with rotation near 180 degrees
    cases.push({
      a: obbFromTRS([1000, -500, 200], [0.01, 0.99, 0.01, -0.02], [4000, 8000, 2000]),
      b: obbFromTRS([999.5, -500.5, 199.8], [0.02, -0.98, 0.12, 0.15], [3900, 7800, 2100]),
    });

    // One degenerate (zero scale on one axis) vs regular box
    cases.push({
      a: obbFromTRS([2, 2, 2], [0, 0, 0, 1], [2, 2, 0.0001]),
      b: obbFromTRS([2, 2, 2.001], [0.1, 0.1, 0.1, 0.97], [1, 1, 1]),
    });

    // Parallel but just-separated boxes to test epsilon boundaries
    cases.push({
      a: obbFromTRS([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]),
      b: obbFromTRS([1.0001, 0, 0], [0, 0, 0, 1], [1, 1, 1]),
    });

    // Highly skewed rotations
    cases.push({
      a: obbFromTRS([5, -3, 8], [0.3, 0.4, 0.5, 0.7], [0.3, 10, 0.2]),
      b: obbFromTRS([5.15, -2.5, 8.4], [-0.6, 0.1, 0.2, 0.75], [6, 0.4, 12]),
    });

    for (const { a, b } of cases) {
      const ts = CollisionDetector.obbIntersect(a, b);
      const wa = wasm!.obbIntersect(flattenObb(a) as any, flattenObb(b) as any);
      expect(wa).toBe(ts);
    }
  });
});



