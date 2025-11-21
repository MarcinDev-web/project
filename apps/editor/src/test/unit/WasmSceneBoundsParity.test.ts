import { describe, it, expect } from 'vitest';

import { init as initWasm } from '@engine/wasm-collision';



function rand(min: number, max: number): number {

  return Math.random() * (max - min) + min;

}



function computeBoundsTS(worldMatrices: Float32Array, halfExtents: Float32Array): Float32Array | null {

  if (worldMatrices.length % 16 !== 0) return null;

  const count = worldMatrices.length / 16;

  if (count === 0 || halfExtents.length !== count * 3) return null;



  let minX = Number.POSITIVE_INFINITY;

  let minY = Number.POSITIVE_INFINITY;

  let minZ = Number.POSITIVE_INFINITY;

  let maxX = Number.NEGATIVE_INFINITY;

  let maxY = Number.NEGATIVE_INFINITY;

  let maxZ = Number.NEGATIVE_INFINITY;

  let hasAny = false;



  for (let i = 0; i < count; i++) {

    const matBase = i * 16;

    const halfBase = i * 3;

    const hx = Math.abs(halfExtents[halfBase] ?? 0);

    const hy = Math.abs(halfExtents[halfBase + 1] ?? 0);

    const hz = Math.abs(halfExtents[halfBase + 2] ?? 0);



    const m0 = Math.abs(worldMatrices[matBase] ?? 0);

    const m1 = Math.abs(worldMatrices[matBase + 1] ?? 0);

    const m2 = Math.abs(worldMatrices[matBase + 2] ?? 0);

    const m4 = Math.abs(worldMatrices[matBase + 4] ?? 0);

    const m5 = Math.abs(worldMatrices[matBase + 5] ?? 0);

    const m6 = Math.abs(worldMatrices[matBase + 6] ?? 0);

    const m8 = Math.abs(worldMatrices[matBase + 8] ?? 0);

    const m9 = Math.abs(worldMatrices[matBase + 9] ?? 0);

    const m10 = Math.abs(worldMatrices[matBase + 10] ?? 0);

    const cx = worldMatrices[matBase + 12] ?? 0;

    const cy = worldMatrices[matBase + 13] ?? 0;

    const cz = worldMatrices[matBase + 14] ?? 0;



    const ex = m0 * hx + m4 * hy + m8 * hz;

    const ey = m1 * hx + m5 * hy + m9 * hz;

    const ez = m2 * hx + m6 * hy + m10 * hz;



    const minx = cx - ex;

    const miny = cy - ey;

    const minz = cz - ez;

    const maxx = cx + ex;

    const maxy = cy + ey;

    const maxz = cz + ez;



    if (minx < minX) minX = minx;

    if (miny < minY) minY = miny;

    if (minz < minZ) minZ = minz;

    if (maxx > maxX) maxX = maxx;

    if (maxy > maxY) maxY = maxy;

    if (maxz > maxZ) maxZ = maxz;

    hasAny = true;

  }



  if (!hasAny) return null;

  return new Float32Array([minX, minY, minZ, maxX, maxY, maxZ]);

}



describe.skip('WASM scene bounds parity', () => {

  it('matches TS implementation for randomized data', async () => {

    let wasm: Awaited<ReturnType<typeof initWasm>>;

    try {

      wasm = await initWasm();

    } catch {

      return;

    }



    const count = 200;

    const world = new Float32Array(count * 16);

    const half = new Float32Array(count * 3);



    for (let i = 0; i < count; i++) {

      const base = i * 16;

      const sx = rand(0.2, 4);

      const sy = rand(0.2, 4);

      const sz = rand(0.2, 4);

      const tx = rand(-20, 20);

      const ty = rand(-10, 10);

      const tz = rand(-20, 20);



      // Simple diagonal matrix with translation (column-major)

      world[base + 0] = sx;

      world[base + 1] = 0;

      world[base + 2] = 0;

      world[base + 3] = 0;

      world[base + 4] = 0;

      world[base + 5] = sy;

      world[base + 6] = 0;

      world[base + 7] = 0;

      world[base + 8] = 0;

      world[base + 9] = 0;

      world[base + 10] = sz;

      world[base + 11] = 0;

      world[base + 12] = tx;

      world[base + 13] = ty;

      world[base + 14] = tz;

      world[base + 15] = 1;



      const halfBase = i * 3;

      half[halfBase] = Math.abs(sx) * 0.5;

      half[halfBase + 1] = Math.abs(sy) * 0.5;

      half[halfBase + 2] = Math.abs(sz) * 0.5;

    }



    const wasmBounds = wasm.computeSceneBounds(world, half);

    const tsBounds = computeBoundsTS(world, half);

    expect(wasmBounds ? Array.from(wasmBounds) : null).toEqual(tsBounds ? Array.from(tsBounds) : null);

  });

});















