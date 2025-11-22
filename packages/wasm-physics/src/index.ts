import init, { PhysicsWorld, BodyType } from '../pkg/physics.js';

// Wrapper for server-side physics that doesn't rely on browser/webgl
// In a real implementation, this would likely use a different build or conditional imports
export class HeadlessPhysics {
  private world: PhysicsWorld | null = null;
  private initialized = false;

  constructor() {}

  async init() {
    if (this.initialized) return;
    await init();
    this.world = new PhysicsWorld(0, -9.81, 0);
    this.initialized = true;
  }

  update(dt: number) {
    if (this.world) {
      this.world.step(dt);
    }
  }

  dispose() {
    if (this.world) {
      this.world.free();
      this.world = null;
    }
  }
}

export { init, PhysicsWorld, BodyType };
export type WasmPhysics = {
  PhysicsWorld: typeof PhysicsWorld;
  memory: WebAssembly.Memory;
};
