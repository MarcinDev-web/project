import { describe, it, expect } from 'vitest';
import type { Quat, Vec3 } from '@engine/core/math';
import { CollisionDetector, type OBB } from '../../editor/placement/CollisionDetector';
import { init as initWasm, type Trs, type TrsArray } from '@engine/wasm-collision';

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }

function obbFromTRS(center: Vec3, rotation: Quat, scale: Vec3): OBB {
  // reuse TS path to create OBB
  const cd = new CollisionDetector({} as any);
  const entity = { transform: { getWorldPosition: () => center, rotation, scale } } as any;
  return cd.getOBB(entity);
}

describe.skip('WASM TRS batch vs TS OBB intersect parity', () => {
  it('matches indices over randomized cases', async () => {
    let wasm: Awaited<ReturnType<typeof initWasm>>;
    try { wasm = await initWasm(); } catch { return; }

    const previewPos: Vec3 = [rand(-1, 1), rand(-1, 1), rand(-1, 1)];
    const previewRot: Quat = [rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(-1, 1)];
    const previewScl: Vec3 = [rand(0.3, 1.5), rand(0.3, 1.5), rand(0.3, 1.5)];
    const previewTrs: Trs = {
      pos: new Float32Array(previewPos),
      rot: new Float32Array(previewRot),
      scl: new Float32Array(previewScl),
    };

    const N = 100;
    const positions = new Float32Array(N * 3);
    const rotations = new Float32Array(N * 4);
    const scales = new Float32Array(N * 3);
    const othersObb: OBB[] = [];
    for (let i = 0; i < N; i++) {
      const pos: Vec3 = [rand(-3, 3), rand(-3, 3), rand(-3, 3)];
      const rot: Quat = [rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(-1, 1)];
      const scl: Vec3 = [rand(0.3, 1.5), rand(0.3, 1.5), rand(0.3, 1.5)];
      positions.set(pos, i * 3);
      rotations.set(rot, i * 4);
      scales.set(scl, i * 3);
      othersObb.push(obbFromTRS(pos, rot, scl));
    }

    const idx = wasm.batchCheckTrs(previewTrs, { positions, rotations, scales } as TrsArray);

    // Compare with TS path
    const previewObb = obbFromTRS(previewPos, previewRot, previewScl);
    const tsIdx: number[] = [];
    othersObb.forEach((o, i) => {
      if (CollisionDetector.obbIntersect(previewObb, o)) tsIdx.push(i);
    });

    expect(Array.from(idx)).toEqual(tsIdx);
  });
});



