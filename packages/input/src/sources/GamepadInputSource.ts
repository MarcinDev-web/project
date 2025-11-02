import type { InputSource, RawGamepadState } from '../InputSource';
import { InputSourcePriority, DEFAULT_GAMEPAD_MAPPING } from '../InputSource';
import type { CharacterInput } from '@engine/world';
import type { Vec3 } from '@engine/core/math';

/**
 * Gamepad button and axis mapping
 */
export interface GamepadMapping {
  buttons: {
    jump: number;
    sprint: number;
    interact: number;
  };
  axes: {
    moveX: number;
    moveY: number;
  };
  deadZone: number;
  sprintThreshold: number;
}

/**
 * Gamepad input source implementation
 * 
 * Handles gamepad input polling and converts it to CharacterInput.
 * Supports customizable button/axis mappings.
 */
export class GamepadInputSource implements InputSource {
  readonly id: string;
  readonly priority: InputSourcePriority;
  private _enabled: boolean = true;
  private _connected: boolean = false;

  private gamepadIndex: number;
  private mapping: GamepadMapping;
  private cameraForward: Vec3 = [0, 0, -1];
  private cameraRight: Vec3 = [1, 0, 0];

  constructor(
    gamepadIndex: number = 0,
    id?: string,
    priority: InputSourcePriority = InputSourcePriority.NORMAL
  ) {
    this.gamepadIndex = gamepadIndex;
    this.id = id ?? `gamepad-${gamepadIndex}`;
    this.priority = priority;
    this.mapping = { ...DEFAULT_GAMEPAD_MAPPING };

    // Check initial connection state
    this._connected = this.getGamepad() !== null;

    // Listen for gamepad connection events
    this.setupEventListeners();
  }

  /**
   * Get current enabled state
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Get current connection state
   */
  get connected(): boolean {
    if (!this._enabled) return false;
    const gamepad = this.getGamepad();
    this._connected = gamepad !== null;
    return this._connected;
  }

  /**
   * Set gamepad mapping (button/axis bindings)
   */
  setMapping(mapping: Partial<GamepadMapping>): void {
    this.mapping = { ...this.mapping, ...mapping };
  }

  /**
   * Get current gamepad mapping
   */
  getMapping(): GamepadMapping {
    return { ...this.mapping };
  }

  /**
   * Get raw gamepad state
   */
  getRawState(): RawGamepadState | null {
    const gamepad = this.getGamepad();
    if (!gamepad) return null;

    return {
      index: this.gamepadIndex,
      buttons: gamepad.buttons,
      axes: gamepad.axes,
      connected: gamepad.connected,
    };
  }

  /**
   * Get connected gamepad from navigator
   */
  private getGamepad(): Gamepad | null {
    const gamepads = navigator.getGamepads();
    return gamepads[this.gamepadIndex] ?? null;
  }

  /**
   * Apply dead zone to axis value
   */
  private applyDeadZone(value: number): number {
    if (Math.abs(value) < this.mapping.deadZone) return 0;

    // Re-map from [deadZone, 1] to [0, 1]
    const sign = Math.sign(value);
    const normalized = (Math.abs(value) - this.mapping.deadZone) / (1 - this.mapping.deadZone);
    return sign * normalized;
  }

  /**
   * Get current input state
   */
  getInput(): CharacterInput | null {
    if (!this._enabled) {
      return null;
    }

    const gamepad = this.getGamepad();
    if (!gamepad) {
      return null;
    }

    // Get stick input with dead zone applied
    const x = this.applyDeadZone(gamepad.axes[this.mapping.axes.moveX] ?? 0);
    const y = this.applyDeadZone(gamepad.axes[this.mapping.axes.moveY] ?? 0);

    // Get button input
    const jump = gamepad.buttons[this.mapping.buttons.jump]?.pressed ?? false;
    const sprintValue = gamepad.buttons[this.mapping.buttons.sprint]?.value ?? 0;
    const sprint = sprintValue > this.mapping.sprintThreshold;

    return {
      moveDirection: [x, 0, -y], // Invert Y for forward/backward
      sprint,
      jump,
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
  }

  /**
   * Setup gamepad event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('gamepadconnected', this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
  }

  /**
   * Handle gamepad connected event
   */
  private handleGamepadConnected = (event: GamepadEvent): void => {
    if (event.gamepad.index === this.gamepadIndex) {
      this._connected = true;
    }
  };

  /**
   * Handle gamepad disconnected event
   */
  private handleGamepadDisconnected = (event: GamepadEvent): void => {
    if (event.gamepad.index === this.gamepadIndex) {
      this._connected = false;
    }
  };

  /**
   * Dispose of the input source
   */
  dispose(): void {
    this.disable();
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
  }
}

