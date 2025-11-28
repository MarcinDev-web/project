/**
 * Engine - Central runtime container for the game engine.
 *
 * Combines Scene, PluginManager, and Systems into a unified runtime.
 * Provides the main game loop and plugin management.
 *
 * @example
 * ```typescript
 * const engine = new Engine({ name: 'My Game' });
 *
 * await engine.use(new PhysicsPlugin());
 * await engine.use(new RenderPlugin());
 *
 * await engine.start();
 *
 * // Game loop
 * function gameLoop(time: number) {
 *   engine.update(time - lastTime);
 *   lastTime = time;
 *   requestAnimationFrame(gameLoop);
 * }
 * requestAnimationFrame(gameLoop);
 *
 * // Cleanup
 * await engine.stop();
 * engine.dispose();
 * ```
 */

import { EventBus } from '@engine/core/event';
import type { IDisposable } from '@engine/core/utils';
import type { System } from '@engine/core/ecs';
import { PluginManager, type Plugin } from '@engine/core/plugin';
import { Scene } from '../core/Scene.js';

/**
 * Engine configuration options.
 */
export interface EngineOptions {
  /** Existing scene to use (creates new if not provided) */
  scene?: Scene;
  /** Engine name for identification */
  name?: string;
}

/**
 * Engine lifecycle events.
 */
export interface EngineEvents {
  'engine:started': void;
  'engine:stopped': void;
  'engine:update': { dt: number };
  'engine:fixedUpdate': { dt: number };
  'system:registered': { name: string };
  'system:unregistered': { name: string };
}

/**
 * Engine state enum.
 */
export type EngineState = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped';

/**
 * Central runtime container for the game engine.
 *
 * @example
 * ```typescript
 * const engine = new Engine();
 * await engine.use(new PhysicsPlugin());
 * await engine.start();
 *
 * // Access plugin API
 * const physics = engine.plugins.getAPI<PhysicsAPI>('physics');
 * physics?.setGravity(new Vec3(0, -9.81, 0));
 * ```
 */
export class Engine implements IDisposable {
  /** Engine name */
  readonly name: string;
  /** The main scene */
  readonly scene: Scene;
  /** Plugin manager for extensions */
  readonly plugins: PluginManager<Engine>;
  /** Engine-wide event bus */
  readonly events: EventBus;

  /** Registered systems */
  private readonly systems = new Map<string, System>();
  /** System update order (based on registration) */
  private readonly systemOrder: string[] = [];
  /** Current engine state */
  private state: EngineState = 'idle';
  /** Disposed flag */
  private disposed = false;

  /**
   * Creates a new Engine instance.
   * @param options - Configuration options
   */
  constructor(options: EngineOptions = {}) {
    this.name = options.name ?? 'Engine';
    this.scene = options.scene ?? new Scene(this.name);
    this.events = new EventBus();
    this.plugins = new PluginManager<Engine>(this);
  }

  /**
   * Gets the current engine state.
   */
  getState(): EngineState {
    return this.state;
  }

  /**
   * Checks if the engine is currently running.
   */
  get isRunning(): boolean {
    return this.state === 'running';
  }

  // =========================================================================
  // Plugin Management
  // =========================================================================

  /**
   * Installs a plugin into the engine.
   * Fluent API - returns this for chaining.
   *
   * @param plugin - The plugin to install
   * @returns This engine instance for chaining
   *
   * @example
   * ```typescript
   * await engine
   *   .use(new PhysicsPlugin())
   *   .then(e => e.use(new RenderPlugin()));
   * ```
   */
  async use(plugin: Plugin<Engine>): Promise<this> {
    if (this.disposed) {
      throw new Error('Engine is disposed');
    }

    await this.plugins.use(plugin);
    return this;
  }

  // =========================================================================
  // System Management
  // =========================================================================

  /**
   * Registers a system with the engine.
   * Systems are updated in registration order.
   *
   * @param name - Unique system identifier
   * @param system - The system instance
   * @throws If system with name already exists
   */
  registerSystem(name: string, system: System): void {
    if (this.disposed) {
      throw new Error('Engine is disposed');
    }

    if (this.systems.has(name)) {
      throw new Error(`System "${name}" is already registered`);
    }

    this.systems.set(name, system);
    this.systemOrder.push(name);

    this.events.emit('system:registered', { name });
  }

  /**
   * Unregisters a system from the engine.
   *
   * @param name - System identifier to remove
   * @returns True if system was removed
   */
  unregisterSystem(name: string): boolean {
    const system = this.systems.get(name);
    if (!system) {
      return false;
    }

    this.systems.delete(name);
    const index = this.systemOrder.indexOf(name);
    if (index !== -1) {
      this.systemOrder.splice(index, 1);
    }

    this.events.emit('system:unregistered', { name });
    return true;
  }

  /**
   * Gets a registered system by name.
   *
   * @template T - Expected system type
   * @param name - System identifier
   * @returns The system or undefined
   */
  getSystem<T extends System>(name: string): T | undefined {
    return this.systems.get(name) as T | undefined;
  }

  /**
   * Checks if a system is registered.
   *
   * @param name - System identifier
   */
  hasSystem(name: string): boolean {
    return this.systems.has(name);
  }

  /**
   * Gets all registered system names.
   */
  getSystemNames(): ReadonlyArray<string> {
    return this.systemOrder;
  }

  // =========================================================================
  // Game Loop
  // =========================================================================

  /**
   * Updates all systems with variable timestep.
   * Called once per frame.
   *
   * @param dt - Delta time in seconds since last update
   */
  update(dt: number): void {
    if (this.state !== 'running' || this.disposed) {
      return;
    }

    // Validate delta time
    if (!Number.isFinite(dt) || dt < 0) {
      return;
    }

    // Update all systems in order
    for (const name of this.systemOrder) {
      const system = this.systems.get(name);
      if (system) {
        try {
          system.update(dt);
        } catch (error) {
          console.error(`Error in system "${name}" update:`, error);
        }
      }
    }

    this.events.emit('engine:update', { dt });
  }

  /**
   * Updates all systems with fixed timestep.
   * Called at a fixed rate for physics/deterministic logic.
   *
   * @param dt - Fixed delta time in seconds
   */
  fixedUpdate(dt: number): void {
    if (this.state !== 'running' || this.disposed) {
      return;
    }

    // Validate delta time
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }

    // Update all systems with fixed timestep
    for (const name of this.systemOrder) {
      const system = this.systems.get(name);
      if (system?.fixedUpdate) {
        try {
          system.fixedUpdate(dt);
        } catch (error) {
          console.error(`Error in system "${name}" fixedUpdate:`, error);
        }
      }
    }

    this.events.emit('engine:fixedUpdate', { dt });
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  /**
   * Starts the engine and all plugins.
   * Initializes systems and prepares for game loop.
   */
  async start(): Promise<void> {
    if (this.disposed) {
      throw new Error('Engine is disposed');
    }

    if (this.state === 'running') {
      return;
    }

    if (this.state === 'starting') {
      throw new Error('Engine is already starting');
    }

    this.state = 'starting';

    try {
      // Start all plugins
      await this.plugins.startAll();

      this.state = 'running';
      this.events.emit('engine:started', undefined);
    } catch (error) {
      this.state = 'stopped';
      throw error;
    }
  }

  /**
   * Stops the engine and all plugins.
   * Gracefully shuts down systems.
   */
  async stop(): Promise<void> {
    if (this.disposed || this.state === 'stopped' || this.state === 'idle') {
      return;
    }

    if (this.state === 'stopping') {
      throw new Error('Engine is already stopping');
    }

    this.state = 'stopping';

    try {
      // Stop all plugins
      await this.plugins.stopAll();
    } finally {
      this.state = 'stopped';
      this.events.emit('engine:stopped', undefined);
    }
  }

  /**
   * Disposes the engine and releases all resources.
   * After calling dispose(), the engine should not be used.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.state = 'stopped';

    // Dispose plugins (will stop and uninstall)
    this.plugins.dispose();

    // Clear systems
    this.systems.clear();
    this.systemOrder.length = 0;

    // Dispose scene
    this.scene.dispose();

    // Clear events
    this.events.clear();
  }

  /**
   * Checks if the engine has been disposed.
   */
  isDisposed(): boolean {
    return this.disposed;
  }
}

