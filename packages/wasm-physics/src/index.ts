import init, { PhysicsWorld } from '../pkg/physics.js';

export { init, PhysicsWorld };
// export type { InitOutput } from '../pkg/physics.js'; // Removed as it causes build error

// Re-export types if needed
export type WasmPhysics = {
  PhysicsWorld: typeof PhysicsWorld;
  memory: WebAssembly.Memory;
};
