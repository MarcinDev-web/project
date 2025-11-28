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
import type { Plugin, PluginMetadata, PluginManagerEvents, PluginState } from './types.js';
/**
 * Error thrown when plugin operations fail.
 */
export declare class PluginError extends Error {
    readonly pluginName: string;
    readonly cause?: Error | undefined;
    constructor(message: string, pluginName: string, cause?: Error | undefined);
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
export declare class PluginManager<TContext> implements IDisposable {
    private readonly context;
    private readonly plugins;
    private readonly installOrder;
    private readonly events;
    private disposed;
    /**
     * Creates a new PluginManager.
     * @param context - The context to pass to all plugins
     */
    constructor(context: TContext);
    /**
     * Installs a plugin and its dependencies.
     * Validates dependencies and version requirements.
     *
     * @param plugin - The plugin to install
     * @throws {PluginError} If installation fails
     */
    use(plugin: Plugin<TContext>): Promise<void>;
    /**
     * Removes a plugin.
     * Fails if other plugins depend on it.
     *
     * @param name - Name of the plugin to remove
     * @throws {PluginError} If removal fails
     */
    remove(name: string): Promise<void>;
    /**
     * Gets a plugin by name.
     * @param name - Plugin name
     * @returns The plugin or undefined
     */
    get(name: string): Plugin<TContext> | undefined;
    /**
     * Gets a plugin's exposed API.
     * @template T - Expected API type
     * @param name - Plugin name
     * @returns The plugin's API or undefined
     */
    getAPI<T>(name: string): T | undefined;
    /**
     * Checks if a plugin is installed.
     * @param name - Plugin name
     */
    has(name: string): boolean;
    /**
     * Gets the state of a plugin.
     * @param name - Plugin name
     */
    getState(name: string): PluginState | undefined;
    /**
     * Lists all installed plugin metadata.
     */
    list(): ReadonlyArray<PluginMetadata>;
    /**
     * Gets the number of installed plugins.
     */
    get size(): number;
    /**
     * Starts all installed plugins in dependency order.
     * Calls onStart() on each plugin that has it.
     */
    startAll(): Promise<void>;
    /**
     * Stops all started plugins in reverse dependency order.
     * Calls onStop() on each plugin that has it.
     */
    stopAll(): Promise<void>;
    /**
     * Subscribes to plugin manager events.
     */
    on<K extends keyof PluginManagerEvents>(event: K, handler: (data: PluginManagerEvents[K]) => void): () => void;
    /**
     * Disposes the plugin manager and all plugins.
     * Stops all plugins and uninstalls them in reverse order.
     */
    dispose(): void;
}
//# sourceMappingURL=PluginManager.d.ts.map