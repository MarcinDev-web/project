/**
 * Plugin System Types
 *
 * Core interfaces for the extensible plugin architecture.
 * Plugins provide a modular way to extend engine functionality.
 */

/**
 * Dependency specification for a plugin.
 * Used to declare requirements on other plugins.
 */
export interface PluginDependency {
  /** Name of the required plugin */
  readonly name: string;
  /** Optional semver version range, e.g. "^1.0.0", ">=2.0.0" */
  readonly versionRange?: string;
}

/**
 * Metadata describing a plugin.
 * Every plugin must provide this information.
 */
export interface PluginMetadata {
  /** Unique plugin identifier */
  readonly name: string;
  /** Semantic version string, e.g. "1.0.0" */
  readonly version: string;
  /** Human-readable description */
  readonly description?: string;
  /** List of plugins this one depends on */
  readonly dependencies?: PluginDependency[];
}

/**
 * Plugin interface for extending engine functionality.
 *
 * Plugins follow a lifecycle:
 * 1. install() - Called when plugin is added to the manager
 * 2. onStart() - Called when engine starts (optional)
 * 3. onStop() - Called when engine stops (optional)
 * 4. uninstall() - Called when plugin is removed
 *
 * @template TContext - The context type passed to lifecycle methods (usually Engine)
 *
 * @example
 * ```typescript
 * class MyPlugin implements Plugin<Engine> {
 *   readonly metadata = {
 *     name: 'my-plugin',
 *     version: '1.0.0',
 *     description: 'Does something useful',
 *   };
 *
 *   async install(engine: Engine): Promise<void> {
 *     // Setup resources, register systems
 *   }
 *
 *   async uninstall(engine: Engine): Promise<void> {
 *     // Cleanup resources
 *   }
 *
 *   getAPI(): MyPluginAPI {
 *     return { doSomething: () => this.doSomethingInternal() };
 *   }
 * }
 * ```
 */
export interface Plugin<TContext = unknown> {
  /** Plugin metadata (name, version, dependencies) */
  readonly metadata: PluginMetadata;

  /**
   * Called when the plugin is installed into the manager.
   * Use for initial setup, resource allocation, system registration.
   * @param context - The engine or runtime context
   */
  install(context: TContext): void | Promise<void>;

  /**
   * Called when the plugin is removed from the manager.
   * Use for cleanup, resource disposal.
   * @param context - The engine or runtime context
   */
  uninstall(context: TContext): void | Promise<void>;

  /**
   * Optional hook called when the engine starts.
   * Use for runtime initialization that depends on all plugins being ready.
   * @param context - The engine or runtime context
   */
  onStart?(context: TContext): void | Promise<void>;

  /**
   * Optional hook called when the engine stops.
   * Use for graceful shutdown procedures.
   * @param context - The engine or runtime context
   */
  onStop?(context: TContext): void | Promise<void>;

  /**
   * Optional method to expose an API for inter-plugin communication.
   * Other plugins can retrieve this via PluginManager.getAPI().
   * @returns The plugin's public API object
   */
  getAPI?(): unknown;
}

/**
 * State of a plugin in the manager.
 */
export type PluginState = 'installed' | 'started' | 'stopped' | 'error';

/**
 * Internal plugin entry stored by PluginManager.
 * @internal
 */
export interface PluginEntry<TContext> {
  readonly plugin: Plugin<TContext>;
  state: PluginState;
  api: unknown | null;
}

/**
 * Events emitted by PluginManager.
 */
export interface PluginManagerEvents {
  'plugin:installed': { name: string; metadata: PluginMetadata };
  'plugin:uninstalled': { name: string };
  'plugin:started': { name: string };
  'plugin:stopped': { name: string };
  'plugin:error': { name: string; error: Error };
}

