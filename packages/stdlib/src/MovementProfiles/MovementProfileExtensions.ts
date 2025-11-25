/**
 * Common movement profile extensions
 *
 * These extensions add custom mechanics to movement profiles.
 * Extensions can modify config, add update logic, or handle lifecycle events.
 */

import type { MovementProfileExtension } from './MovementProfile';
import type { CharacterControllerConfig } from '@engine/world';

/**
 * Base extension implementation
 */
export class BaseMovementExtension implements MovementProfileExtension {
  constructor(
    public readonly id: string,
    public readonly name: string
  ) {}

  modifyConfig?(config: CharacterControllerConfig): CharacterControllerConfig {
    return config;
  }

  update?(_controller: import('@engine/world').CharacterController, _deltaTime: number): void {
    // Override in subclasses
  }

  onApply?(_controller: import('@engine/world').CharacterController): void {
    // Override in subclasses
  }

  onRemove?(_controller: import('@engine/world').CharacterController): void {
    // Override in subclasses
  }
}

/**
 * Example extension: Reduced gravity (for flying-like mechanics)
 *
 * This is a template - actual extensions would be implemented
 * as needed for specific gameplay mechanics.
 */
export class ReducedGravityExtension extends BaseMovementExtension {
  constructor(public readonly gravityReduction: number = 0.5) {
    super('reduced-gravity', 'Reduced Gravity');
  }

  modifyConfig(config: CharacterControllerConfig): CharacterControllerConfig {
    return {
      ...config,
      gravityMultiplier: config.gravityMultiplier * this.gravityReduction,
    };
  }
}

/**
 * Input provider interface for extensions that need input state
 */
export interface MovementExtensionInputProvider {
  isKeyPressed(key: string): boolean;
}

/**
 * Flying Extension - Enables flight mechanics
 *
 * Features:
 * - Significantly reduced gravity (nearly zero)
 * - Space key to fly up
 * - Ctrl key to fly down
 * - Smooth vertical movement control
 */
export class FlyingExtension extends BaseMovementExtension {
  private readonly flyUpForce: number = 15.0;
  private readonly flyDownForce: number = 10.0;
  private inputProvider: MovementExtensionInputProvider | null = null;

  constructor(flyUpForce: number = 15.0, flyDownForce: number = 10.0) {
    super('flying', 'Flying');
    this.flyUpForce = flyUpForce;
    this.flyDownForce = flyDownForce;
  }

  modifyConfig(config: CharacterControllerConfig): CharacterControllerConfig {
    return {
      ...config,
      gravityMultiplier: 0.05, // Almost zero gravity
      airControlMultiplier: 1.0, // Full control in air when flying
    };
  }

  update(controller: import('@engine/world').CharacterController, deltaTime: number): void {
    if (!this.inputProvider) {
      // Try to get input provider from window (browser environment)
      this.inputProvider = this.createDefaultInputProvider();
    }

    if (!this.inputProvider) return;

    // Access internal physics property (not exposed in public interface)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const physics = (controller as any).physics;
    if (!physics) return;

    // Fly up with Space
    if (this.inputProvider.isKeyPressed('Space')) {
      controller.addVelocity([0, this.flyUpForce * deltaTime, 0]);
    }

    // Fly down with Ctrl
    if (
      this.inputProvider.isKeyPressed('ControlLeft') ||
      this.inputProvider.isKeyPressed('ControlRight') ||
      this.inputProvider.isKeyPressed('KeyC')
    ) {
      controller.addVelocity([0, -this.flyDownForce * deltaTime, 0]);
    }
  }

  onApply(_controller: import('@engine/world').CharacterController): void {
    // Set input provider when extension is applied
    this.inputProvider = this.createDefaultInputProvider();
  }

  /**
   * Set custom input provider (for testing or custom input handling)
   */
  setInputProvider(provider: MovementExtensionInputProvider): void {
    this.inputProvider = provider;
  }

  private static globalInputProvider: MovementExtensionInputProvider | null = null;

  private createDefaultInputProvider(): MovementExtensionInputProvider | null {
    // Browser environment - use window events
    if (typeof window !== 'undefined') {
      // Use singleton pattern to avoid multiple event listeners
      if (!FlyingExtension.globalInputProvider) {
        const keys = new Set<string>();

        const handleKeyDown = (e: KeyboardEvent) => {
          keys.add(e.code);
        };

        const handleKeyUp = (e: KeyboardEvent) => {
          keys.delete(e.code);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        FlyingExtension.globalInputProvider = {
          isKeyPressed: (key: string) => keys.has(key),
        };
      }

      return FlyingExtension.globalInputProvider;
    }

    return null;
  }
}

/**
 * Speed Boost Extension - Temporarily increases movement speed
 *
 * Features:
 * - Doubles movement speed
 * - Increases sprint multiplier
 * - Optional duration limit
 * - Optional cooldown
 */
export class SpeedBoostExtension extends BaseMovementExtension {
  private readonly speedMultiplier: number;
  private readonly sprintMultiplier: number;
  private readonly duration: number; // Duration in seconds, 0 = infinite
  private readonly cooldown: number; // Cooldown in seconds, 0 = no cooldown
  private activeTime: number = 0;
  private cooldownTime: number = 0;
  private isActive: boolean = false;

  constructor(
    speedMultiplier: number = 2.0,
    sprintMultiplier: number = 1.5,
    duration: number = 0, // 0 = infinite
    cooldown: number = 0 // 0 = no cooldown
  ) {
    super('speed-boost', 'Speed Boost');
    this.speedMultiplier = speedMultiplier;
    this.sprintMultiplier = sprintMultiplier;
    this.duration = duration;
    this.cooldown = cooldown;
  }

  modifyConfig(config: CharacterControllerConfig): CharacterControllerConfig {
    const modified = {
      ...config,
      moveSpeed: config.moveSpeed * this.speedMultiplier,
      sprintMultiplier: config.sprintMultiplier * this.sprintMultiplier,
    };

    this.isActive = true;
    this.activeTime = 0;

    return modified;
  }

  update(controller: import('@engine/world').CharacterController, deltaTime: number): void {
    if (!this.isActive) return;

    // Update active time
    if (this.duration > 0) {
      this.activeTime += deltaTime;
      if (this.activeTime >= this.duration) {
        // Duration expired - deactivate
        this.deactivate(controller);
      }
    }
  }

  onRemove(controller: import('@engine/world').CharacterController): void {
    this.deactivate(controller);
  }

  private deactivate(_controller: import('@engine/world').CharacterController): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.cooldownTime = this.cooldown;
    this.activeTime = 0;

    // Reset config to original (this would need to be stored)
    // For now, extension removal will restore original config
  }

  /**
   * Check if boost is active
   */
  getIsActive(): boolean {
    return this.isActive && (this.duration === 0 || this.activeTime < this.duration);
  }

  /**
   * Check if boost is on cooldown
   */
  getIsOnCooldown(): boolean {
    return this.cooldownTime > 0;
  }
}

/**
 * Vehicle Extension - Vehicle-like movement mechanics
 *
 * Features:
 * - Very high movement speed
 * - Minimal air control
 * - High momentum (less responsive turns)
 * - Higher linear drag for vehicle-like feel
 */
export class VehicleExtension extends BaseMovementExtension {
  private readonly speedMultiplier: number;

  constructor(speedMultiplier: number = 3.0) {
    super('vehicle', 'Vehicle Mode');
    this.speedMultiplier = speedMultiplier;
  }

  modifyConfig(config: CharacterControllerConfig): CharacterControllerConfig {
    return {
      ...config,
      moveSpeed: config.moveSpeed * this.speedMultiplier,
      sprintMultiplier: 1.2, // Lower sprint boost for vehicles
      airControlMultiplier: 0.1, // Minimal air control
      rotationSpeed: 5, // Slower rotation for vehicle-like feel
    };
  }

  onApply(controller: import('@engine/world').CharacterController): void {
    // Modify physics component for vehicle-like behavior
    // Access internal physics property (not exposed in public interface)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const physics = (controller as any).physics;
    if (physics) {
      // Increase linear drag for vehicle momentum feel
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      physics.linearDrag = Math.max(physics.linearDrag || 5, 8);
    }
  }

  onRemove(controller: import('@engine/world').CharacterController): void {
    // Restore original physics settings
    // Access internal physics property (not exposed in public interface)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    const physics = (controller as any).physics;
    if (physics) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      physics.linearDrag = 5; // Default drag
    }
  }
}
