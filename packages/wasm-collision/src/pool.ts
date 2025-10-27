export type TrsBuffers = {
  positions: Float32Array;
  rotations: Float32Array;
  scales: Float32Array;
};

const pools = {
  positions: [] as Float32Array[],
  rotations: [] as Float32Array[],
  scales: [] as Float32Array[],
};

function takePool(pool: Float32Array[], minLength: number): Float32Array {
  for (let i = 0; i < pool.length; i++) {
    const arr = pool[i]!;
    if (arr.length >= minLength) {
      pool.splice(i, 1);
      return arr.subarray(0, minLength);
    }
  }
  return new Float32Array(minLength);
}

export function getTrsBuffers(count: number): TrsBuffers {
  const p = takePool(pools.positions, count * 3);
  const r = takePool(pools.rotations, count * 4);
  const s = takePool(pools.scales, count * 3);
  return { positions: p, rotations: r, scales: s };
}

export function releaseTrsBuffers(buffers: TrsBuffers): void {
  // Only keep reasonably sized buffers to avoid memory bloat
  if (buffers.positions.length <= 20000) pools.positions.push(buffers.positions);
  if (buffers.rotations.length <= 20000) pools.rotations.push(buffers.rotations);
  if (buffers.scales.length <= 20000) pools.scales.push(buffers.scales);
}


