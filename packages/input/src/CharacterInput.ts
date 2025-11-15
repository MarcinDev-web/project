import type { Vec3 } from '@engine/core/math';
import type { CharacterInput } from '@engine/world';
import { KeyboardInputSource } from './sources/KeyboardInputSource';
import { GamepadInputSource } from './sources/GamepadInputSource';
import { UnifiedInputManager, InputCombinationStrategy } from './UnifiedInputManager';
import { InputSourcePriority } from './InputSource';
import type { InputMapping } from './InputSource';

// Placeholder interface for InputBindings (will be properly defined when editor is migrated)
export interface InputBindings {
  movement: {
    forward: string[];
    backward: string[];
    left: string[];
    right: string[];
  };
  actions: {
    jump: string[];
    sprint: string[];
    interact: string[];
  };
}

/**
 * Keyboard input handler for character controller
 * 
 * Provides keyboard-based input for character movement.
 * Now uses Enhanced Input Abstraction internally but maintains backward compatibility.
 * 
 * For new code, consider using UnifiedInputManager directly.
 */
export class CharacterInputHandler {
  private inputManager: UnifiedInputManager;
  private keyboardSource: KeyboardInputSource;

  /** Whether input is enabled */
  private _enabled: boolean = true;

  /** Camera forward direction (for camera-relative movement) */
  private cameraForward: Vec3 = [0, 0, -1];

  /** Camera right direction (for camera-relative movement) */
  private cameraRight: Vec3 = [1, 0, 0];

  constructor() {
    // Use Enhanced Input Abstraction internally
    this.inputManager = new UnifiedInputManager();
    this.keyboardSource = new KeyboardInputSource('keyboard', InputSourcePriority.NORMAL);
    this.inputManager.addSource(this.keyboardSource);
    this.inputManager.setCombinationStrategy(InputCombinationStrategy.HIGHEST_PRIORITY);
  }

  /**
   * Set key bindings (backward compatibility)
   */
  setBindings(bindings: InputBindings): void {
    const mapping: Partial<InputMapping> = {
      movement: {
        forward: bindings.movement.forward,
        backward: bindings.movement.backward,
        left: bindings.movement.left,
        right: bindings.movement.right,
      },
      actions: {
        jump: bindings.actions.jump,
        sprint: bindings.actions.sprint,
        interact: bindings.actions.interact,
      },
    };
    this.keyboardSource.setMapping(mapping);
  }

  /**
   * Set camera directions for camera-relative movement
   */
  setCameraDirections(forward: Vec3, right: Vec3): void {
    this.cameraForward = [...forward] as Vec3;
    this.cameraRight = [...right] as Vec3;
    this.inputManager.setCameraDirections(forward, right);
  }

  /**
   * Get current character input state
   */
  getInput(): CharacterInput {
    const input = this.inputManager.getInput();
    
    // Debug: log input occasionally
    if (Math.random() < 0.01) {
      console.log('[CharacterInputHandler] getInput() called, input:', input, '_enabled:', this._enabled);
    }
    
    // If no input from manager, return default with camera directions
    if (!input) {
      return {
        moveDirection: [0, 0, 0],
        sprint: false,
        jump: false,
        cameraForward: this.cameraForward,
        cameraRight: this.cameraRight,
      };
    }

    // Ensure camera directions are set
    return {
      ...input,
      cameraForward: input.cameraForward ?? this.cameraForward,
      cameraRight: input.cameraRight ?? this.cameraRight,
    };
  }

  /**
   * Enable input handling
   */
  enable(): void {
    console.log('[CharacterInputHandler] enable() called, current _enabled:', this._enabled);
    this._enabled = true;
    this.inputManager.enableAll();
    console.log('[CharacterInputHandler] enable() completed, _enabled:', this._enabled, 'isEnabled():', this.isEnabled());
    const sources = this.inputManager.getSources();
    console.log('[CharacterInputHandler] Input sources:', sources.map(s => ({ id: s.id, enabled: s.enabled, connected: s.connected })));
  }

  /**
   * Disable input handling
   */
  disable(): void {
    this._enabled = false;
    this.inputManager.disableAll();
  }

  /**
   * Check if input is enabled
   */
  isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Clear all key states
   */
  clear(): void {
    this.keyboardSource.clear();
  }

  /**
   * Cleanup event listeners
   * @deprecated Use dispose() instead
   */
  destroy(): void {
    this.dispose();
  }

  /**
   * Dispose of the input handler
   */
  dispose(): void {
    this.inputManager.dispose();
  }
}

/**
 * Gamepad input handler for character controller
 * 
 * Now uses Enhanced Input Abstraction internally but maintains backward compatibility.
 * For new code, consider using GamepadInputSource or UnifiedInputManager directly.
 */
export class CharacterGamepadHandler {
  private gamepadSource: GamepadInputSource;
  private inputManager: UnifiedInputManager;

  constructor(gamepadIndex: number = 0) {
    
    // Use Enhanced Input Abstraction internally
    this.inputManager = new UnifiedInputManager();
    this.gamepadSource = new GamepadInputSource(
      gamepadIndex,
      `gamepad-${gamepadIndex}`,
      InputSourcePriority.NORMAL
    );
    this.inputManager.addSource(this.gamepadSource);
    this.inputManager.setCombinationStrategy(InputCombinationStrategy.HIGHEST_PRIORITY);
  }

  /** Dead zone for analog sticks */
  get deadZone(): number {
    return this.gamepadSource.getMapping().deadZone;
  }

  set deadZone(value: number) {
    this.gamepadSource.setMapping({ deadZone: value });
  }

  /** Sprint threshold for trigger */
  get sprintThreshold(): number {
    return this.gamepadSource.getMapping().sprintThreshold;
  }

  set sprintThreshold(value: number) {
    this.gamepadSource.setMapping({ sprintThreshold: value });
  }

  /** Button mappings (standard gamepad layout) */
  get buttons() {
    const mapping = this.gamepadSource.getMapping();
    return {
      jump: mapping.buttons.jump,
      sprint: mapping.buttons.sprint,
    };
  }

  set buttons(value: { jump: number; sprint: number }) {
    this.gamepadSource.setMapping({
      buttons: {
        ...this.gamepadSource.getMapping().buttons,
        ...value,
      },
    });
  }

  /** Axis mappings */
  get axes() {
    const mapping = this.gamepadSource.getMapping();
    return {
      moveX: mapping.axes.moveX,
      moveY: mapping.axes.moveY,
    };
  }

  set axes(value: { moveX: number; moveY: number }) {
    this.gamepadSource.setMapping({
      axes: {
        ...this.gamepadSource.getMapping().axes,
        ...value,
      },
    });
  }

  /**
   * Get current character input state from gamepad
   */
  getInput(): CharacterInput | null {
    return this.inputManager.getInput();
  }

  /**
   * Check if gamepad is connected
   */
  isConnected(): boolean {
    return this.gamepadSource.connected;
  }

  /**
   * Dispose of the gamepad handler
   */
  dispose(): void {
    this.inputManager.dispose();
  }
}

