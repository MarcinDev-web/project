/**
 * Base class for all Logic Cube types.
 * Logic cubes are node-based logic elements that can be connected together.
 */

import type { Entity } from '@engine/world';
import type { Scene } from '@engine/world';
import type {
  LogicPort,
  LogicSignal,
  LogicExecutionContext,
  LogicCubeMetadata,
} from './types.js';

/**
 * Abstract base class for logic cubes
 */
export abstract class LogicCube {
  /** The entity this logic cube is attached to */
  protected entity: Entity;
  /** The scene this logic cube is part of */
  protected scene: Scene;
  /** Whether this cube is enabled */
  public enabled = true;
  /** Current cooldown timer (seconds) */
  protected cooldown = 0;
  /** Configuration parameters for this cube */
  protected config: Record<string, unknown> = {};
  /** Custom state data for this cube instance */
  protected state: Record<string, unknown> = {};

  constructor(entity: Entity, scene: Scene, config: Record<string, unknown> = {}) {
    this.entity = entity;
    this.scene = scene;
    this.config = { ...config };
  }

  /**
   * Returns metadata describing this cube type.
   * Must be implemented by subclasses.
   */
  abstract getMetadata(): LogicCubeMetadata;

  /**
   * Returns the input ports for this cube
   */
  getInputPorts(): LogicPort[] {
    return this.getMetadata().inputs;
  }

  /**
   * Returns the output ports for this cube
   */
  getOutputPorts(): LogicPort[] {
    return this.getMetadata().outputs;
  }

  /**
   * Called once when the cube is initialized
   */
  onInit(): void {
    // Override in subclasses if needed
  }

  /**
   * Called every frame to update cube state (timers, etc.)
   */
  onUpdate(context: LogicExecutionContext): void {
    // Update cooldown
    if (this.cooldown > 0) {
      this.cooldown = Math.max(0, this.cooldown - context.deltaTime);
    }
  }

  /**
   * Called when a signal arrives at an input port.
   * Returns signals to emit from output ports (if any).
   */
  abstract onSignalReceived(
    portId: string,
    signal: LogicSignal,
    context: LogicExecutionContext
  ): Map<string, LogicSignal> | null;

  /**
   * Validates if this cube can receive a signal on the given port
   */
  canReceiveSignal(portId: string): boolean {
    if (!this.enabled) return false;
    if (this.cooldown > 0) return false;

    const port = this.getInputPorts().find((p) => p.id === portId);
    return port !== undefined;
  }

  /**
   * Sets a configuration parameter
   */
  setConfig(key: string, value: unknown): void {
    this.config[key] = value;
  }

  /**
   * Gets a configuration parameter
   */
  getConfig<T = unknown>(key: string, defaultValue?: T): T {
    const value = this.config[key];
    return (value !== undefined ? value : defaultValue) as T;
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
   * Sets cooldown duration in seconds
   */
  setCooldown(seconds: number): void {
    this.cooldown = Math.max(0, seconds);
  }

  /**
   * Checks if cube is currently on cooldown
   */
  isOnCooldown(): boolean {
    return this.cooldown > 0;
  }

  /**
   * Serializes the cube's state
   */
  toJSON(): { config: Record<string, unknown>; state: Record<string, unknown>; cooldown: number } {
    return {
      config: { ...this.config },
      state: { ...this.state },
      cooldown: this.cooldown,
    };
  }

  /**
   * Restores the cube's state from serialized data
   */
  fromJSON(data: { config?: Record<string, unknown>; state?: Record<string, unknown>; cooldown?: number }): void {
    if (data.config) {
      this.config = { ...data.config };
    }
    if (data.state) {
      this.state = { ...data.state };
    }
    if (typeof data.cooldown === 'number') {
      this.cooldown = data.cooldown;
    }
  }

  /**
   * Called when the cube is destroyed
   */
  onDestroy(): void {
    // Override in subclasses if needed
  }
}

/**
 * Type alias for logic cube constructor
 */
export type LogicCubeConstructor = new (
  entity: Entity,
  scene: Scene,
  config?: Record<string, unknown>
) => LogicCube;

