import type { CharacterInput } from '@engine/world';
import type { Vec3 } from '@engine/core/math';

/**
 * Input source priority (higher = processed first)
 */
export enum InputSourcePriority {
  /** Highest priority - e.g., menu overrides, debug commands */
  CRITICAL = 100,
  /** High priority - e.g., gameplay input */
  HIGH = 50,
  /** Normal priority - e.g., default character input */
  NORMAL = 25,
  /** Low priority - e.g., background input, AI input */
  LOW = 10,
}

/**
 * Base interface for all input sources
 * 
 * Allows different input sources (keyboard, gamepad, touch, replay, AI)
 * to be used interchangeably.
 */
export interface InputSource {
  /** Unique identifier for this input source */
  readonly id: string;
  
  /** Priority of this input source (higher = processed first) */
  readonly priority: InputSourcePriority;
  
  /** Whether this input source is currently active/enabled */
  readonly enabled: boolean;
  
  /** Whether this input source is connected/available */
  readonly connected: boolean;
  
  /**
   * Get current input state from this source
   * Returns null if input is not available or disabled
   */
  getInput(): CharacterInput | null;
  
  /**
   * Update camera directions for camera-relative movement
   * Called when camera orientation changes
   */
  setCameraDirections(forward: Vec3, right: Vec3): void;
  
  /**
   * Enable this input source
   */
  enable(): void;
  
  /**
   * Disable this input source
   */
  disable(): void;
  
  /**
   * Dispose of this input source (cleanup listeners, etc.)
   */
  dispose(): void;
}

/**
 * Raw keyboard state (before mapping to actions)
 */
export interface RawKeyboardState {
  /** Map of key codes to pressed state */
  keys: Map<string, boolean>;
}

/**
 * Raw gamepad state (before mapping to actions)
 */
export interface RawGamepadState {
  /** Gamepad index */
  index: number;
  /** Button states (0 = not pressed, 1 = fully pressed) */
  buttons: readonly GamepadButton[];
  /** Analog stick axes (-1 to 1) */
  axes: readonly number[];
  /** Whether gamepad is connected */
  connected: boolean;
}

/**
 * Input mapping configuration
 * Maps raw input (keys, buttons, axes) to actions
 */
export interface InputMapping {
  /** Movement key bindings */
  movement: {
    forward: string[];
    backward: string[];
    left: string[];
    right: string[];
  };
  /** Action key bindings */
  actions: {
    jump: string[];
    sprint: string[];
    interact: string[];
  };
}

/**
 * Default input mapping (WASD + space, shift, E)
 */
export const DEFAULT_KEYBOARD_MAPPING: InputMapping = {
  movement: {
    forward: ['KeyW', 'ArrowUp'],
    backward: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
  },
  actions: {
    jump: ['Space'],
    sprint: ['ShiftLeft', 'ShiftRight'],
    interact: ['KeyE'],
  },
};

/**
 * Default gamepad mapping (Xbox controller layout)
 */
export const DEFAULT_GAMEPAD_MAPPING = {
  buttons: {
    jump: 0, // A button
    sprint: 7, // Right trigger
    interact: 1, // B button
  },
  axes: {
    moveX: 0, // Left stick X
    moveY: 1, // Left stick Y
  },
  deadZone: 0.15,
  sprintThreshold: 0.5,
} as const;

