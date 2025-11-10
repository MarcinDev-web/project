import type { CharacterControllerConfig } from '../components/CharacterController.js';

/**
 * Extension interface for adding custom mechanics to movement profiles
 */
export interface MovementProfileExtension {
  readonly id: string;
  readonly name: string;

  /**
   * Modify config before applying to controller
   */
  modifyConfig?(config: CharacterControllerConfig): CharacterControllerConfig;

  /**
   * Custom update logic (called each frame)
   */
  update?(controller: import('../components/CharacterController.js').CharacterController, deltaTime: number): void;

  /**
   * Called when profile is applied to controller
   */
  onApply?(controller: import('../components/CharacterController.js').CharacterController): void;

  /**
   * Called when profile is removed from controller
   */
  onRemove?(controller: import('../components/CharacterController.js').CharacterController): void;
}

/**
 * Movement Profile interface
 * 
 * Defines a set of movement parameters and optional extensions
 * that can be applied to a CharacterController.
 * 
 * This interface is compatible with MovementProfile class from @engine/stdlib.
 */
export interface MovementProfile {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly config: CharacterControllerConfig;
  readonly extensions?: MovementProfileExtension[];
}

