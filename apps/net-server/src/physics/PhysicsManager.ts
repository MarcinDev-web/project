import { PhysicsWorld } from '@engine/wasm-physics/node';

export const PHYSICS_CONSTANTS = {
  GRAVITY: -9.81,
  STEP_DT: 1.0 / 60.0,
  PLAYER_RADIUS: 0.5,
  PLAYER_HEIGHT: 1.8,
  PLAYER_HALF_HEIGHT: 0.9,
  MOVE_SPEED: 0.5, // Impulse magnitude per tick
  JUMP_FORCE: 5.0,
  TOLERANCE: 2.0, // meters
};

export const SHAPE = {
  CUBOID: 0,
  BALL: 1,
  CAPSULE: 2,
  CYLINDER: 3,
};

export class PhysicsManager {
  private world: PhysicsWorld;
  private bodies: Map<string, number> = new Map(); // userId -> bodyId

  constructor() {
    // Initialize physics world with gravity
    this.world = new PhysicsWorld(0, PHYSICS_CONSTANTS.GRAVITY, 0);
    
    // Create a ground plane (static body)
    const groundId = this.world.add_rigid_body(1, 0, -1, 0, 0, 0, 0, 1, 0, 0);
    // Add collider (cuboid 100x1x100)
    const args = new Float32Array([100.0, 1.0, 100.0]);
    this.world.add_collider(groundId, SHAPE.CUBOID, args, 0.5, 0.0, 1.0, false);
  }

  public addPlayer(userId: string, x: number, y: number, z: number) {
    if (this.bodies.has(userId)) return;
    
    // Dynamic body
    const bodyId = this.world.add_rigid_body(0, x, y, z, 0, 0, 0, 1, 0.5, 0.5); // dampings
    
    // Capsule collider (radius, half_height)
    const args = new Float32Array([PHYSICS_CONSTANTS.PLAYER_RADIUS, PHYSICS_CONSTANTS.PLAYER_HALF_HEIGHT]);
    this.world.add_collider(bodyId, SHAPE.CAPSULE, args, 0.0, 0.0, 1.0, false);
    
    this.bodies.set(userId, bodyId);
  }

  public removePlayer(userId: string) {
    const bodyId = this.bodies.get(userId);
    if (bodyId !== undefined) {
      this.world.remove_rigid_body(bodyId);
      this.bodies.delete(userId);
    }
  }

  public applyInput(userId: string, input: { x: number, z: number, jump: boolean }) {
    const bodyId = this.bodies.get(userId);
    if (bodyId === undefined) return;

    // Apply movement impulse
    if (input.x !== 0 || input.z !== 0) {
        this.world.apply_impulse(bodyId, input.x * PHYSICS_CONSTANTS.MOVE_SPEED, 0, input.z * PHYSICS_CONSTANTS.MOVE_SPEED);
    }
    
    if (input.jump) {
      // Check if grounded via raycast
      const pos = this.world.get_body_position(bodyId);
      // Cast ray down from center
      // Ray start slightly below center to avoid self-intersection if needed, 
      // but rapier usually handles inside-collider start if configured, or we use filter.
      // Here we just cast from center.
      const hit = this.world.cast_ray(
          pos[0], pos[1], pos[2], // origin
          0, -1, 0,               // direction (down)
          PHYSICS_CONSTANTS.PLAYER_HALF_HEIGHT + 0.2, // max_toi (slightly more than half height)
          true                    // solid
      );
      
      // hit format: [1.0 (hit), toi, nx, ny, nz, bodyId] or [0.0, ...]
      if (hit[0] > 0.0) {
         this.world.apply_impulse(bodyId, 0, PHYSICS_CONSTANTS.JUMP_FORCE, 0);
      }
    }
    
    // Keep player upright (reset rotation)
    this.world.set_body_rotation(bodyId, 0, 0, 0, 1);
  }

  public step(dt: number) {
    this.world.step(dt);
  }

  public validatePosition(userId: string, x: number, y: number, z: number): boolean {
    const bodyId = this.bodies.get(userId);
    if (bodyId === undefined) return true; // Pass if body not tracked yet

    const pos = this.world.get_body_position(bodyId);
    const dx = x - pos[0];
    const dy = y - pos[1];
    const dz = z - pos[2];
    const distSq = dx*dx + dy*dy + dz*dz;

    if (distSq < PHYSICS_CONSTANTS.TOLERANCE * PHYSICS_CONSTANTS.TOLERANCE) {
      // Soft sync: Move server body to client position to prevent drift accumulation
      this.world.set_body_translation(bodyId, x, y, z);
      this.world.set_body_rotation(bodyId, 0, 0, 0, 1); // Ensure upright
      return true;
    }
    
    return false;
  }

  public getPlayerPosition(userId: string): { x: number, y: number, z: number } | null {
    const bodyId = this.bodies.get(userId);
    if (bodyId === undefined) return null;

    const pos = this.world.get_body_position(bodyId);
    return { x: pos[0], y: pos[1], z: pos[2] };
  }

  public dispose() {
    this.world.free();
  }
}
