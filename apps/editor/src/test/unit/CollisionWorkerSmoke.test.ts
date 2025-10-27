import { describe, it, expect } from 'vitest';
import { requestCheckTrs } from '../../wasm/collisionWorkerClient';

// Node test env lacks Worker; keep skipped by default
describe.skip('collision worker smoke', () => {
  it('returns indices array', async () => {
    const indices = await requestCheckTrs(
      {
        pos: new Float32Array([0, 0, 0]),
        rot: new Float32Array([0, 0, 0, 1]),
        scl: new Float32Array([1, 1, 1]),
      },
      {
        positions: new Float32Array([2, 0, 0]),
        rotations: new Float32Array([0, 0, 0, 1]),
        scales: new Float32Array([1, 1, 1]),
      },
      1000
    );
    expect(indices).toBeInstanceOf(Uint32Array);
  });
});


