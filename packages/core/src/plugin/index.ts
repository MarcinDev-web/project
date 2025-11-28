/**
 * Plugin System
 *
 * Provides a modular plugin architecture for extending engine functionality.
 *
 * @example
 * ```typescript
 * import { Plugin, PluginManager } from '@engine/core/plugin';
 *
 * class MyPlugin implements Plugin<Engine> {
 *   readonly metadata = { name: 'my-plugin', version: '1.0.0' };
 *   install(engine: Engine) { ... }
 *   uninstall(engine: Engine) { ... }
 * }
 *
 * const manager = new PluginManager(engine);
 * await manager.use(new MyPlugin());
 * ```
 */

export * from './types.js';
export { PluginManager, PluginError } from './PluginManager.js';

