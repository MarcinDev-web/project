export type TrsBuffers = {
  positions: Float32Array;
  rotations: Float32Array;
  scales: Float32Array;
};

export type PoolMetrics = {
  hits: number;
  misses: number;
  totalRequests: number;
  poolSize: {
    positions: number;
    rotations: number;
    scales: number;
  };
  hitRate: number;
};

const pools = {
  positions: [] as Float32Array[],
  rotations: [] as Float32Array[],
  scales: [] as Float32Array[],
};

const metrics = {
  hits: 0,
  misses: 0,
};

function takePool(pool: Float32Array[], minLength: number): Float32Array {
  for (let i = 0; i < pool.length; i++) {
    const arr = pool[i]!;
    if (arr.length >= minLength) {
      pool.splice(i, 1);
      metrics.hits++;
      return arr.subarray(0, minLength);
    }
  }
  metrics.misses++;
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

/**
 * Get current pool metrics for monitoring and debugging.
 * @returns Pool usage statistics including hit/miss ratio
 */
export function getPoolMetrics(): PoolMetrics {
  const total = metrics.hits + metrics.misses;
  return {
    hits: metrics.hits,
    misses: metrics.misses,
    totalRequests: total,
    poolSize: {
      positions: pools.positions.length,
      rotations: pools.rotations.length,
      scales: pools.scales.length,
    },
    hitRate: total > 0 ? metrics.hits / total : 0,
  };
}
