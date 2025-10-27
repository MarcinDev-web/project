import { describe, it } from 'vitest';
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

// Disabled by default; enable locally to measure
describe.skip('Collision batch micro-bench', () => {
  it('compares TS vs WASM batch', async () => {
    const wasm = await initWasm();
    const N = 500;

    const preview = obbFromTRS([0, 0, 0], [0.1, 0.2, -0.3, 1], [1, 1, 1]);
    const others: OBB[] = [];
    for (let i = 0; i < N; i++) {
      others.push(
        obbFromTRS(
          [rand(-5, 5), rand(-5, 5), rand(-5, 5)],
          [rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(-1, 1)],
          [rand(0.3, 1.5), rand(0.3, 1.5), rand(0.3, 1.5)]
        )
      );
    }

    const t0 = performance.now();
    let cts = 0;
    for (let i = 0; i < N; i++) {
      if (CollisionDetector.obbIntersect(preview, others[i]!)) cts++;
    }
    const t1 = performance.now();

    const pf = flattenObb(preview);
    const centers = new Float32Array(N * 3);
    const axes = new Float32Array(N * 9);
    const halves = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const o = others[i]!;
      centers.set([o.center[0], o.center[1], o.center[2]], i * 3);
      axes.set([
        o.axes[0][0], o.axes[0][1], o.axes[0][2],
        o.axes[1][0], o.axes[1][1], o.axes[1][2],
        o.axes[2][0], o.axes[2][1], o.axes[2][2],
      ], i * 9);
      halves.set([o.halfSizes[0], o.halfSizes[1], o.halfSizes[2]], i * 3);
    }

    const t2 = performance.now();
    const idx = wasm.batchCheck(pf as any, { centers, axes, halves } as any);
    const cw = idx.length;
    const t3 = performance.now();

    // eslint-disable-next-line no-console
    console.log({ tsMs: (t1 - t0).toFixed(2), wasmMs: (t3 - t2).toFixed(2), cts, cw });
  });
});


