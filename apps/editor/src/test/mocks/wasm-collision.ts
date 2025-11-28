// Mock implementation of @engine/wasm-collision for tests
// This avoids loading the actual WASM module which causes issues in Vitest environment

export async function init() {
  return {
    obbIntersect: () => false,
    sphereSphereIntersect: () => false,
    batchCheckTrs: () => new Uint32Array(0),
  };
}

export function getTrsBuffers(count: number) {
  return {
    positions: new Float32Array(count * 3),
    rotations: new Float32Array(count * 4),
    scales: new Float32Array(count * 3),
  };
}

export function releaseTrsBuffers(_buffers: unknown) {
  // no-op in mock
}

export function getPoolMetrics() {
  return {
    totalAllocated: 0,
    inUse: 0,
    available: 0,
  };
}
