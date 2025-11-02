/**
 * LogicCubeComponent - Component for logic cube entities.
 * Stores the logic cube type, configuration, and runtime state.
 */

import { Component } from '@engine/world';
import { registerComponent } from '@engine/world';
import type { LogicCubeState } from '../LogicCubes/cubes/types';

export class LogicCubeComponent extends Component {
  static readonly type = 'LogicCube';

  /** Type of logic cube (e.g., 'onClickTrigger', 'sendMessageAction') */
  private cubeType: string = '';

  /** Configuration parameters for this cube */
  private config: Record<string, unknown> = {};

  /** Whether this cube is enabled */
  private enabled = true;

  /** Current cooldown remaining (seconds) */
  private cooldown = 0;

  /** Custom state data for this cube instance */
  private state: Record<string, unknown> = {};

  getType(): string {
    return LogicCubeComponent.type;
  }

  /**
   * Gets the cube type identifier
   */
  getCubeType(): string {
    return this.cubeType;
  }

  /**
   * Sets the cube type identifier
   */
  setCubeType(type: string): void {
    this.cubeType = type;
  }

  /**
   * Gets all configuration parameters
   */
  getConfig(): Record<string, unknown> {
    return { ...this.config };
  }

  /**
   * Gets a specific configuration parameter
   */
  getConfigValue<T = unknown>(key: string, defaultValue?: T): T {
    const value = this.config[key];
    return (value !== undefined ? value : defaultValue) as T;
  }

  /**
   * Sets a configuration parameter
   */
  setConfigValue(key: string, value: unknown): void {
    this.config[key] = value;
  }

  /**
   * Sets all configuration parameters
   */
  setConfig(config: Record<string, unknown>): void {
    this.config = { ...config };
  }

  /**
   * Gets whether this cube is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Sets whether this cube is enabled
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Gets current cooldown
   */
  getCooldown(): number {
    return this.cooldown;
  }

  /**
   * Sets cooldown
   */
  setCooldown(cooldown: number): void {
    this.cooldown = Math.max(0, cooldown);
  }

  /**
   * Updates cooldown (called by LogicCubeSystem)
   */
  updateCooldown(deltaTime: number): void {
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - deltaTime);
    }
  }

  /**
   * Gets custom state data
   */
  getState<T = unknown>(key: string, defaultValue?: T): T {
    const value = this.state[key];
    return (value !== undefined ? value : defaultValue) as T;
  }

  /**
   * Sets custom state data
   */
  setState(key: string, value: unknown): void {
    this.state[key] = value;
  }

  /**
   * Gets all state data
   */
  getAllState(): Record<string, unknown> {
    return { ...this.state };
  }

  /**
   * Sets all state data
   */
  setAllState(state: Record<string, unknown>): void {
    this.state = { ...state };
  }

  clone(): LogicCubeComponent {
    const copy = new LogicCubeComponent();
    copy.cubeType = this.cubeType;
    copy.config = { ...this.config };
    copy.enabled = this.enabled;
    copy.cooldown = this.cooldown;
    copy.state = { ...this.state };
    return copy;
  }

  toJSON(): LogicCubeState {
    return {
      cubeType: this.cubeType,
      config: { ...this.config },
      enabled: this.enabled,
      cooldown: this.cooldown,
      state: { ...this.state },
    };
  }

  fromJSON(data: LogicCubeState): void {
    if (!data || typeof data !== 'object') return;

    if (typeof data.cubeType === 'string') {
      this.cubeType = data.cubeType;
    }

    if (data.config && typeof data.config === 'object') {
      this.config = { ...data.config };
    }

    if (typeof data.enabled === 'boolean') {
      this.enabled = data.enabled;
    }

    if (typeof data.cooldown === 'number') {
      this.cooldown = Math.max(0, data.cooldown);
    }

    if (data.state && typeof data.state === 'object') {
      this.state = { ...data.state };
    }
  }
}

registerComponent(LogicCubeComponent.type, LogicCubeComponent);

