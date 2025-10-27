import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CollisionDetector, type OBB } from '../../editor/placement/CollisionDetector';
import { init as initWasm, type Trs, type TrsArray } from '@engine/wasm-collision';

function obbFromTRS(cd: CollisionDetector, pos: [number,number,number], rot: [number,number,number,number], scl: [number,number,number]): OBB {
  const entity = { transform: { getWorldPosition: () => pos, rotation: rot, scale: scl } } as any;
  return cd.getOBB(entity);
}

describe('Property: TRS batch equals TS SAT', () => {
  it('random TRS arrays', async () => {
    let wasm: Awaited<ReturnType<typeof initWasm>>;
    try { wasm = await initWasm(); } catch { return; }
    const cd = new CollisionDetector({ getActiveEntities: () => [] } as any);

    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(
          fc.tuple(fc.double({ min: -3, max: 3 }), fc.double({ min: -3, max: 3 }), fc.double({ min: -3, max: 3 })),
          fc.tuple(fc.double({ min: -1, max: 1 }), fc.double({ min: -1, max: 1 }), fc.double({ min: -1, max: 1 }), fc.double({ min: -1, max: 1 })),
          fc.tuple(fc.double({ min: 0.3, max: 1.5 }), fc.double({ min: 0.3, max: 1.5 }), fc.double({ min: 0.3, max: 1.5 }))
        ), { minLength: 10, maxLength: 60 }),
        fc.tuple(
          fc.tuple(fc.double({ min: -3, max: 3 }), fc.double({ min: -3, max: 3 }), fc.double({ min: -3, max: 3 })),
          fc.tuple(fc.double({ min: -1, max: 1 }), fc.double({ min: -1, max: 1 }), fc.double({ min: -1, max: 1 }), fc.double({ min: -1, max: 1 })),
          fc.tuple(fc.double({ min: 0.3, max: 1.5 }), fc.double({ min: 0.3, max: 1.5 }), fc.double({ min: 0.3, max: 1.5 }))
        ),
        async (others, preview) => {
          const positions = new Float32Array(others.length * 3);
          const rotations = new Float32Array(others.length * 4);
          const scales = new Float32Array(others.length * 3);
          const cdOthers: OBB[] = [];
          for (let i = 0; i < others.length; i++) {
            const [p, r, s] = others[i]! as any;
            positions.set(p, i * 3);
            rotations.set(r, i * 4);
            scales.set(s, i * 3);
            cdOthers.push(obbFromTRS(cd, p as any, r as any, s as any));
          }

          const [pp, pr, ps] = preview as any;
          const idx = wasm.batchCheckTrs(
            { pos: new Float32Array(pp), rot: new Float32Array(pr), scl: new Float32Array(ps) } as Trs,
            { positions, rotations, scales } as TrsArray
          );

          const previewObb = obbFromTRS(cd, pp as any, pr as any, ps as any);
          const tsIdx: number[] = [];
          cdOthers.forEach((o, i) => {
            if (CollisionDetector.obbIntersect(previewObb, o)) tsIdx.push(i);
          });

          expect(Array.from(idx)).toEqual(tsIdx);
        }
      ),
      { numRuns: 30 }
    );
  });
});


