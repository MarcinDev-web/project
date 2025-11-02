import type { InputSource, InputMapping, RawKeyboardState } from '../InputSource';
import { InputSourcePriority } from '../InputSource';
import type { CharacterInput } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { DEFAULT_KEYBOARD_MAPPING } from '../InputSource';

/**
 * Keyboard input source implementation
 * 
 * Handles keyboard input events and converts them to CharacterInput.
 * Supports customizable key bindings via InputMapping.
 */
export class KeyboardInputSource implements InputSource {
  readonly id: string;
  readonly priority: InputSourcePriority;
  private _enabled: boolean = true;
  readonly connected: boolean = true; // Keyboard is always "connected"

  private keys: Map<string, boolean> = new Map();
  private mapping: InputMapping;
  private cameraForward: Vec3 = [0, 0, -1];
  private cameraRight: Vec3 = [1, 0, 0];

  // Bound handlers for proper cleanup
  private boundHandleKeyDown: (event: KeyboardEvent) => void;
  private boundHandleKeyUp: (event: KeyboardEvent) => void;

  constructor(id: string = 'keyboard', priority: InputSourcePriority = InputSourcePriority.NORMAL) {
    this.id = id;
    this.priority = priority;
    this.mapping = { ...DEFAULT_KEYBOARD_MAPPING };

    // Bind handlers once for cleanup
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleKeyUp = this.handleKeyUp.bind(this);

    this.setupEventListeners();
  }

  /**
   * Get current enabled state
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Set input mapping (key bindings)
   */
  setMapping(mapping: Partial<InputMapping>): void {
    if (mapping.movement) {
      this.mapping.movement = { ...this.mapping.movement, ...mapping.movement };
    }
    if (mapping.actions) {
      this.mapping.actions = { ...this.mapping.actions, ...mapping.actions };
    }
  }

  /**
   * Get current input mapping
   */
  getMapping(): InputMapping {
    return { ...this.mapping };
  }

  /**
   * Get raw keyboard state
   */
  getRawState(): RawKeyboardState {
    return {
      keys: new Map(this.keys),
    };
  }

  /**
   * Check if any key in a binding is pressed
   */
  private isKeyPressed(keys: string[]): boolean {
    return keys.some(key => this.keys.get(key) === true);
  }

  /**
   * Get current input state
   */
  getInput(): CharacterInput | null {
    if (!this._enabled) {
      return null;
    }

    // Calculate movement direction from keyboard state
    let x = 0;
    let z = 0;

    if (this.isKeyPressed(this.mapping.movement.forward)) z += 1;
    if (this.isKeyPressed(this.mapping.movement.backward)) z -= 1;
    if (this.isKeyPressed(this.mapping.movement.left)) x -= 1;
    if (this.isKeyPressed(this.mapping.movement.right)) x += 1;

    // Normalize diagonal movement
    const length = Math.sqrt(x * x + z * z);
    if (length > 0) {
      x /= length;
      z /= length;
    }

    return {
      moveDirection: [x, 0, z],
      sprint: this.isKeyPressed(this.mapping.actions.sprint),
      jump: this.isKeyPressed(this.mapping.actions.jump),
      cameraForward: this.cameraForward,
      cameraRight: this.cameraRight,
    };
  }

  /**
   * Set camera directions for camera-relative movement
   */
  setCameraDirections(forward: Vec3, right: Vec3): void {
    this.cameraForward = [...forward] as Vec3;
    this.cameraRight = [...right] as Vec3;
  }

  /**
   * Enable input handling
   */
  enable(): void {
    this._enabled = true;
  }

  /**
   * Disable input handling
   */
  disable(): void {
    this._enabled = false;
    this.keys.clear();
  }

  /**
   * Setup keyboard event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('keydown', this.boundHandleKeyDown);
    window.addEventListener('keyup', this.boundHandleKeyUp);
  }

  /**
   * Handle key down event
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this._enabled) return;
    this.keys.set(event.code, true);
  }

  /**
   * Handle key up event
   */
  private handleKeyUp(event: KeyboardEvent): void {
    this.keys.set(event.code, false);
  }

  /**
   * Clear all key states
   */
  clear(): void {
    this.keys.clear();
  }

  /**
   * Dispose of the input source
   */
  dispose(): void {
    this.disable();
    window.removeEventListener('keydown', this.boundHandleKeyDown);
    window.removeEventListener('keyup', this.boundHandleKeyUp);
    this.keys.clear();
  }
}

