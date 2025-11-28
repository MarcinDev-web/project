/**
 * PluginManager - Manages plugin lifecycle and dependencies.
 *
 * Features:
 * - Async plugin installation/uninstallation
 * - Dependency resolution with topological sort
 * - Semver version validation
 * - Inter-plugin API access
 * - Lifecycle hooks (start/stop)
 */

import type { IDisposable } from '../utils/DisposableGroup.js';
import { EventBus } from '../event/EventBus.js';
import type {
  Plugin,
  PluginMetadata,
  PluginEntry,
  PluginManagerEvents,
  PluginState,
} from './types.js';

/**
 * Error thrown when plugin operations fail.
 */
export class PluginError extends Error {
  constructor(
    message: string,
    public readonly pluginName: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

/**
 * Checks if a version satisfies a version range.
 * Simplified semver matching supporting: exact, ^, ~, >=, <=, >, <
 */
function satisfiesVersion(version: string, range: string): boolean {
  if (!range || range === '*') return true;

  const parseVersion = (v: string): number[] => {
    const match = v.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!match) return [0, 0, 0];
    return [
      parseInt(match[1] || '0', 10),
      parseInt(match[2] || '0', 10),
      parseInt(match[3] || '0', 10),
    ];
  };

  const compare = (a: number[], b: number[]): number => {
    for (let i = 0; i < 3; i++) {
      if (a[i]! > b[i]!) return 1;
      if (a[i]! < b[i]!) return -1;
    }
    return 0;
  };

  const ver = parseVersion(version);

  // Handle caret (^) - compatible with major version
  if (range.startsWith('^')) {
    const rangeVer = parseVersion(range.slice(1));
    if (ver[0] !== rangeVer[0]) return false;
    return compare(ver, rangeVer) >= 0;
  }

  // Handle tilde (~) - compatible with minor version
  if (range.startsWith('~')) {
    const rangeVer = parseVersion(range.slice(1));
    if (ver[0] !== rangeVer[0] || ver[1] !== rangeVer[1]) return false;
    return compare(ver, rangeVer) >= 0;
  }

  // Handle >= comparison
  if (range.startsWith('>=')) {
    const rangeVer = parseVersion(range.slice(2));
    return compare(ver, rangeVer) >= 0;
  }

  // Handle <= comparison
  if (range.startsWith('<=')) {
    const rangeVer = parseVersion(range.slice(2));
    return compare(ver, rangeVer) <= 0;
  }

  // Handle > comparison
  if (range.startsWith('>')) {
    const rangeVer = parseVersion(range.slice(1));
    return compare(ver, rangeVer) > 0;
  }

  // Handle < comparison
  if (range.startsWith('<')) {
    const rangeVer = parseVersion(range.slice(1));
    return compare(ver, rangeVer) < 0;
  }

  // Exact match
  const rangeVer = parseVersion(range);
  return compare(ver, rangeVer) === 0;
}

/**
 * Performs topological sort on plugins based on dependencies.
 * Returns plugins in installation order (dependencies first).
 */
function topologicalSort<TContext>(
  plugins: Map<string, PluginEntry<TContext>>,
  pluginNames: string[]
): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  const visit = (name: string, path: Set<string>): void => {
    if (visited.has(name)) return;
    if (path.has(name)) {
      throw new PluginError(
        `Circular dependency detected: ${Array.from(path).join(' -> ')} -> ${name}`,
        name
      );
    }

    const entry = plugins.get(name);
    if (!entry) return;

    path.add(name);

    const deps = entry.plugin.metadata.dependencies || [];
    for (const dep of deps) {
      if (plugins.has(dep.name)) {
        visit(dep.name, path);
      }
    }

    path.delete(name);
    visited.add(name);
    result.push(name);
  };

  for (const name of pluginNames) {
    visit(name, new Set());
  }

  return result;
}

/**
 * Manages plugin lifecycle, dependencies, and inter-plugin communication.
 *
 * @template TContext - The context type passed to plugins (usually Engine)
 *
 * @example
 * ```typescript
 * const manager = new PluginManager(engine);
 *
 * await manager.use(new PhysicsPlugin());
 * await manager.use(new RenderPlugin());
 *
 * await manager.startAll();
 * // ... game loop ...
 * await manager.stopAll();
 *
 * manager.dispose();
 * ```
 */
export class PluginManager<TContext> implements IDisposable {
  private readonly plugins = new Map<string, PluginEntry<TContext>>();
  private readonly installOrder: string[] = [];
  private readonly events = new EventBus();
  private disposed = false;

  /**
   * Creates a new PluginManager.
   * @param context - The context to pass to all plugins
   */
  constructor(private readonly context: TContext) {}

  /**
   * Installs a plugin and its dependencies.
   * Validates dependencies and version requirements.
   *
   * @param plugin - The plugin to install
   * @throws {PluginError} If installation fails
   */
  async use(plugin: Plugin<TContext>): Promise<void> {
    if (this.disposed) {
      throw new PluginError('PluginManager is disposed', plugin.metadata.name);
    }

    const { name, dependencies = [] } = plugin.metadata;

    // Check if already installed
    if (this.plugins.has(name)) {
      throw new PluginError(`Plugin "${name}" is already installed`, name);
    }

    // Validate dependencies
    for (const dep of dependencies) {
      const depEntry = this.plugins.get(dep.name);
      if (!depEntry) {
        throw new PluginError(
          `Missing dependency "${dep.name}" for plugin "${name}"`,
          name
        );
      }

      if (dep.versionRange) {
        const depVersion = depEntry.plugin.metadata.version;
        if (!satisfiesVersion(depVersion, dep.versionRange)) {
          throw new PluginError(
            `Dependency "${dep.name}" version ${depVersion} does not satisfy ${dep.versionRange}`,
            name
          );
        }
      }
    }

    // Create entry
    const entry: PluginEntry<TContext> = {
      plugin,
      state: 'installed',
      api: null,
    };

    this.plugins.set(name, entry);
    this.installOrder.push(name);

    // Install
    try {
      await plugin.install(this.context);

      // Cache API if available
      if (plugin.getAPI) {
        entry.api = plugin.getAPI();
      }

      this.events.emit('plugin:installed', {
        name,
        metadata: plugin.metadata,
      });
    } catch (error) {
      // Rollback on failure
      this.plugins.delete(name);
      this.installOrder.pop();
      entry.state = 'error';

      const err = error instanceof Error ? error : new Error(String(error));
      this.events.emit('plugin:error', { name, error: err });

      throw new PluginError(`Failed to install plugin "${name}"`, name, err);
    }
  }

  /**
   * Removes a plugin.
   * Fails if other plugins depend on it.
   *
   * @param name - Name of the plugin to remove
   * @throws {PluginError} If removal fails
   */
  async remove(name: string): Promise<void> {
    if (this.disposed) {
      throw new PluginError('PluginManager is disposed', name);
    }

    const entry = this.plugins.get(name);
    if (!entry) {
      throw new PluginError(`Plugin "${name}" is not installed`, name);
    }

    // Check for dependents
    for (const [otherName, otherEntry] of this.plugins) {
      if (otherName === name) continue;
      const deps = otherEntry.plugin.metadata.dependencies || [];
      if (deps.some((d) => d.name === name)) {
        throw new PluginError(
          `Cannot remove "${name}": plugin "${otherName}" depends on it`,
          name
        );
      }
    }

    // Stop if running
    if (entry.state === 'started' && entry.plugin.onStop) {
      try {
        await entry.plugin.onStop(this.context);
      } catch {
        // Ignore stop errors during removal
      }
    }

    // Uninstall
    try {
      await entry.plugin.uninstall(this.context);
      entry.state = 'stopped';
    } catch (error) {
      entry.state = 'error';
      const err = error instanceof Error ? error : new Error(String(error));
      this.events.emit('plugin:error', { name, error: err });
      throw new PluginError(`Failed to uninstall plugin "${name}"`, name, err);
    }

    // Remove from tracking
    this.plugins.delete(name);
    const orderIndex = this.installOrder.indexOf(name);
    if (orderIndex !== -1) {
      this.installOrder.splice(orderIndex, 1);
    }

    this.events.emit('plugin:uninstalled', { name });
  }

  /**
   * Gets a plugin by name.
   * @param name - Plugin name
   * @returns The plugin or undefined
   */
  get(name: string): Plugin<TContext> | undefined {
    return this.plugins.get(name)?.plugin;
  }

  /**
   * Gets a plugin's exposed API.
   * @template T - Expected API type
   * @param name - Plugin name
   * @returns The plugin's API or undefined
   */
  getAPI<T>(name: string): T | undefined {
    const entry = this.plugins.get(name);
    if (!entry) return undefined;

    // Refresh API if getter exists
    if (entry.plugin.getAPI) {
      entry.api = entry.plugin.getAPI();
    }

    return entry.api as T | undefined;
  }

  /**
   * Checks if a plugin is installed.
   * @param name - Plugin name
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Gets the state of a plugin.
   * @param name - Plugin name
   */
  getState(name: string): PluginState | undefined {
    return this.plugins.get(name)?.state;
  }

  /**
   * Lists all installed plugin metadata.
   */
  list(): ReadonlyArray<PluginMetadata> {
    return this.installOrder.map((name) => this.plugins.get(name)!.plugin.metadata);
  }

  /**
   * Gets the number of installed plugins.
   */
  get size(): number {
    return this.plugins.size;
  }

  /**
   * Starts all installed plugins in dependency order.
   * Calls onStart() on each plugin that has it.
   */
  async startAll(): Promise<void> {
    if (this.disposed) {
      throw new PluginError('PluginManager is disposed', 'startAll');
    }

    const sorted = topologicalSort(this.plugins, this.installOrder);

    for (const name of sorted) {
      const entry = this.plugins.get(name);
      if (!entry || entry.state === 'started') continue;

      if (entry.plugin.onStart) {
        try {
          await entry.plugin.onStart(this.context);
        } catch (error) {
          entry.state = 'error';
          const err = error instanceof Error ? error : new Error(String(error));
          this.events.emit('plugin:error', { name, error: err });
          throw new PluginError(`Failed to start plugin "${name}"`, name, err);
        }
      }

      entry.state = 'started';
      this.events.emit('plugin:started', { name });
    }
  }

  /**
   * Stops all started plugins in reverse dependency order.
   * Calls onStop() on each plugin that has it.
   */
  async stopAll(): Promise<void> {
    if (this.disposed) return;

    const sorted = topologicalSort(this.plugins, this.installOrder);
    const reversed = sorted.reverse();

    for (const name of reversed) {
      const entry = this.plugins.get(name);
      if (!entry || entry.state !== 'started') continue;

      if (entry.plugin.onStop) {
        try {
          await entry.plugin.onStop(this.context);
        } catch (error) {
          entry.state = 'error';
          const err = error instanceof Error ? error : new Error(String(error));
          this.events.emit('plugin:error', { name, error: err });
          // Continue stopping other plugins
        }
      }

      entry.state = 'stopped';
      this.events.emit('plugin:stopped', { name });
    }
  }

  /**
   * Subscribes to plugin manager events.
   */
  on<K extends keyof PluginManagerEvents>(
    event: K,
    handler: (data: PluginManagerEvents[K]) => void
  ): () => void {
    return this.events.on<PluginManagerEvents[K]>(event, (data) => {
      if (data !== undefined) {
        handler(data);
      }
    });
  }

  /**
   * Disposes the plugin manager and all plugins.
   * Stops all plugins and uninstalls them in reverse order.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Synchronous dispose - stop and uninstall in reverse order
    const reversed = [...this.installOrder].reverse();

    for (const name of reversed) {
      const entry = this.plugins.get(name);
      if (!entry) continue;

      // Try to stop
      if (entry.state === 'started' && entry.plugin.onStop) {
        try {
          const result = entry.plugin.onStop(this.context);
          // Can't await in dispose, but handle if sync
          if (result instanceof Promise) {
            result.catch(() => {
              /* ignore async errors */
            });
          }
        } catch {
          // Ignore errors during dispose
        }
      }

      // Try to uninstall
      try {
        const result = entry.plugin.uninstall(this.context);
        if (result instanceof Promise) {
          result.catch(() => {
            /* ignore async errors */
          });
        }
      } catch {
        // Ignore errors during dispose
      }
    }

    this.plugins.clear();
    this.installOrder.length = 0;
    this.events.clear();
  }
}

