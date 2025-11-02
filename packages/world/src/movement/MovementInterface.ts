import type { Vec3 } from '@engine/core/math';

/**
 * Unified input interface for movement controllers
 */
export interface MovementInput {
  /** Movement direction (normalized or unnormalized, depending on controller) */
  moveDirection: Vec3;
  /** Whether sprint/fast movement is active */
  sprint?: boolean;
  /** Whether jump was pressed this frame */
  jump?: boolean;
}

/**
 * Unified interface for movement controllers
 * 
 * Provides a common API for different movement types:
 * - CharacterController (physics-based gameplay movement)
 * - EditorCameraController (free-fly editor navigation)
 * - Future: VehicleController, FlyingController, etc.
 */
export interface MovementController {
  /**
   * Set movement input for this frame
   * @param input - Movement input state
   */
  setInput(input: MovementInput): void;

  /**
   * Update movement controller (called each frame)
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void;

  /**
   * Get current velocity
   * @returns Current velocity vector
   */
  getVelocity(): Vec3;

  /**
   * Get current position
   * @returns Current position vector
   */
  getPosition(): Vec3;
}

