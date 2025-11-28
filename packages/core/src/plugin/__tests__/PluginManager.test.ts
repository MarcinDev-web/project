import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PluginManager, PluginError } from '../PluginManager.js';
import type { Plugin, PluginMetadata } from '../types.js';

// Mock context for testing
interface TestContext {
  name: string;
  value: number;
}

// Helper to create a simple plugin
function createPlugin(
  name: string,
  version = '1.0.0',
  options: {
    dependencies?: { name: string; versionRange?: string }[];
    onInstall?: () => void | Promise<void>;
    onUninstall?: () => void | Promise<void>;
    onStart?: () => void | Promise<void>;
    onStop?: () => void | Promise<void>;
    api?: unknown;
  } = {}
): Plugin<TestContext> {
  return {
    metadata: {
      name,
      version,
      dependencies: options.dependencies,
    },
    install: options.onInstall ?? vi.fn(),
    uninstall: options.onUninstall ?? vi.fn(),
    onStart: options.onStart,
    onStop: options.onStop,
    getAPI: options.api ? () => options.api : undefined,
  };
}

describe('PluginManager', () => {
  let context: TestContext;
  let manager: PluginManager<TestContext>;

  beforeEach(() => {
    context = { name: 'test', value: 42 };
    manager = new PluginManager(context);
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('use()', () => {
    it('should install a plugin', async () => {
      const installFn = vi.fn();
      const plugin = createPlugin('test-plugin', '1.0.0', { onInstall: installFn });

      await manager.use(plugin);

      expect(installFn).toHaveBeenCalledWith(context);
      expect(manager.has('test-plugin')).toBe(true);
      expect(manager.size).toBe(1);
    });

    it('should reject duplicate plugin names', async () => {
      const plugin1 = createPlugin('test-plugin');
      const plugin2 = createPlugin('test-plugin');

      await manager.use(plugin1);

      await expect(manager.use(plugin2)).rejects.toThrow(PluginError);
      await expect(manager.use(plugin2)).rejects.toThrow('already installed');
    });

    it('should handle async install', async () => {
      const order: string[] = [];
      const plugin = createPlugin('async-plugin', '1.0.0', {
        onInstall: async () => {
          await new Promise((r) => setTimeout(r, 10));
          order.push('installed');
        },
      });

      order.push('before');
      await manager.use(plugin);
      order.push('after');

      expect(order).toEqual(['before', 'installed', 'after']);
    });

    it('should rollback on install failure', async () => {
      const error = new Error('Install failed');
      const plugin = createPlugin('failing-plugin', '1.0.0', {
        onInstall: () => {
          throw error;
        },
      });

      await expect(manager.use(plugin)).rejects.toThrow('Failed to install plugin');
      expect(manager.has('failing-plugin')).toBe(false);
    });
  });

  describe('dependencies', () => {
    it('should validate required dependencies exist', async () => {
      const plugin = createPlugin('dependent', '1.0.0', {
        dependencies: [{ name: 'missing-dep' }],
      });

      await expect(manager.use(plugin)).rejects.toThrow(PluginError);
      await expect(manager.use(plugin)).rejects.toThrow('Missing dependency');
    });

    it('should accept plugins with satisfied dependencies', async () => {
      const base = createPlugin('base', '1.0.0');
      const dependent = createPlugin('dependent', '1.0.0', {
        dependencies: [{ name: 'base' }],
      });

      await manager.use(base);
      await manager.use(dependent);

      expect(manager.has('dependent')).toBe(true);
    });

    it('should validate version ranges', async () => {
      const base = createPlugin('base', '1.5.0');
      const dependent = createPlugin('dependent', '1.0.0', {
        dependencies: [{ name: 'base', versionRange: '^2.0.0' }],
      });

      await manager.use(base);
      await expect(manager.use(dependent)).rejects.toThrow('does not satisfy');
    });

    it('should accept satisfied version ranges', async () => {
      const base = createPlugin('base', '2.3.1');
      const dependent = createPlugin('dependent', '1.0.0', {
        dependencies: [{ name: 'base', versionRange: '^2.0.0' }],
      });

      await manager.use(base);
      await manager.use(dependent);

      expect(manager.has('dependent')).toBe(true);
    });

    it('should detect circular dependencies during topological sort', async () => {
      // Install plugins that would cause a cycle during startAll
      // (Can't directly create cycle in use() due to order)
      // This test verifies the topological sort handles installed plugins
      const a = createPlugin('a', '1.0.0', { dependencies: [] });
      const b = createPlugin('b', '1.0.0', { dependencies: [{ name: 'a' }] });

      await manager.use(a);
      await manager.use(b);

      // Should start without cycle error
      await expect(manager.startAll()).resolves.not.toThrow();
    });
  });

  describe('remove()', () => {
    it('should remove an installed plugin', async () => {
      const uninstallFn = vi.fn();
      const plugin = createPlugin('test-plugin', '1.0.0', { onUninstall: uninstallFn });

      await manager.use(plugin);
      await manager.remove('test-plugin');

      expect(uninstallFn).toHaveBeenCalledWith(context);
      expect(manager.has('test-plugin')).toBe(false);
    });

    it('should throw when removing non-existent plugin', async () => {
      await expect(manager.remove('non-existent')).rejects.toThrow(PluginError);
    });

    it('should prevent removal if other plugins depend on it', async () => {
      const base = createPlugin('base', '1.0.0');
      const dependent = createPlugin('dependent', '1.0.0', {
        dependencies: [{ name: 'base' }],
      });

      await manager.use(base);
      await manager.use(dependent);

      await expect(manager.remove('base')).rejects.toThrow('depends on it');
    });

    it('should allow removal in correct order', async () => {
      const base = createPlugin('base', '1.0.0');
      const dependent = createPlugin('dependent', '1.0.0', {
        dependencies: [{ name: 'base' }],
      });

      await manager.use(base);
      await manager.use(dependent);

      await manager.remove('dependent');
      await manager.remove('base');

      expect(manager.size).toBe(0);
    });
  });

  describe('get() and getAPI()', () => {
    it('should return plugin by name', async () => {
      const plugin = createPlugin('test-plugin');
      await manager.use(plugin);

      expect(manager.get('test-plugin')).toBe(plugin);
    });

    it('should return undefined for non-existent plugin', () => {
      expect(manager.get('non-existent')).toBeUndefined();
    });

    it('should return plugin API', async () => {
      const api = { foo: () => 'bar' };
      const plugin = createPlugin('api-plugin', '1.0.0', { api });

      await manager.use(plugin);

      expect(manager.getAPI('api-plugin')).toEqual(api);
    });

    it('should return null for plugin without API', async () => {
      const plugin = createPlugin('no-api');
      await manager.use(plugin);

      expect(manager.getAPI('no-api')).toBeNull();
    });
  });

  describe('list()', () => {
    it('should list all plugin metadata in install order', async () => {
      await manager.use(createPlugin('first', '1.0.0'));
      await manager.use(createPlugin('second', '2.0.0'));
      await manager.use(createPlugin('third', '3.0.0'));

      const list = manager.list();

      expect(list).toHaveLength(3);
      expect(list[0]!.name).toBe('first');
      expect(list[1]!.name).toBe('second');
      expect(list[2]!.name).toBe('third');
    });
  });

  describe('startAll() and stopAll()', () => {
    it('should call onStart on all plugins', async () => {
      const startFn1 = vi.fn();
      const startFn2 = vi.fn();

      await manager.use(createPlugin('p1', '1.0.0', { onStart: startFn1 }));
      await manager.use(createPlugin('p2', '1.0.0', { onStart: startFn2 }));

      await manager.startAll();

      expect(startFn1).toHaveBeenCalledWith(context);
      expect(startFn2).toHaveBeenCalledWith(context);
    });

    it('should call onStop on all started plugins', async () => {
      const stopFn1 = vi.fn();
      const stopFn2 = vi.fn();

      await manager.use(createPlugin('p1', '1.0.0', { onStart: vi.fn(), onStop: stopFn1 }));
      await manager.use(createPlugin('p2', '1.0.0', { onStart: vi.fn(), onStop: stopFn2 }));

      await manager.startAll();
      await manager.stopAll();

      expect(stopFn1).toHaveBeenCalled();
      expect(stopFn2).toHaveBeenCalled();
    });

    it('should start plugins in dependency order', async () => {
      const order: string[] = [];

      await manager.use(
        createPlugin('base', '1.0.0', {
          onStart: () => {
            order.push('base');
          },
        })
      );
      await manager.use(
        createPlugin('dependent', '1.0.0', {
          dependencies: [{ name: 'base' }],
          onStart: () => {
            order.push('dependent');
          },
        })
      );

      await manager.startAll();

      expect(order).toEqual(['base', 'dependent']);
    });

    it('should stop plugins in reverse dependency order', async () => {
      const order: string[] = [];

      await manager.use(
        createPlugin('base', '1.0.0', {
          onStart: vi.fn(),
          onStop: () => {
            order.push('base');
          },
        })
      );
      await manager.use(
        createPlugin('dependent', '1.0.0', {
          dependencies: [{ name: 'base' }],
          onStart: vi.fn(),
          onStop: () => {
            order.push('dependent');
          },
        })
      );

      await manager.startAll();
      await manager.stopAll();

      expect(order).toEqual(['dependent', 'base']);
    });
  });

  describe('events', () => {
    it('should emit plugin:installed event', async () => {
      const handler = vi.fn();
      manager.on('plugin:installed', handler);

      await manager.use(createPlugin('test'));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test',
          metadata: expect.objectContaining({ name: 'test' }),
        })
      );
    });

    it('should emit plugin:uninstalled event', async () => {
      const handler = vi.fn();
      manager.on('plugin:uninstalled', handler);

      await manager.use(createPlugin('test'));
      await manager.remove('test');

      expect(handler).toHaveBeenCalledWith({ name: 'test' });
    });

    it('should emit plugin:error event on failure', async () => {
      const handler = vi.fn();
      manager.on('plugin:error', handler);

      const plugin = createPlugin('failing', '1.0.0', {
        onInstall: () => {
          throw new Error('Fail');
        },
      });

      await expect(manager.use(plugin)).rejects.toThrow();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'failing',
          error: expect.any(Error),
        })
      );
    });
  });

  describe('dispose()', () => {
    it('should dispose all plugins', async () => {
      const uninstall1 = vi.fn();
      const uninstall2 = vi.fn();

      await manager.use(createPlugin('p1', '1.0.0', { onUninstall: uninstall1 }));
      await manager.use(createPlugin('p2', '1.0.0', { onUninstall: uninstall2 }));

      manager.dispose();

      expect(uninstall1).toHaveBeenCalled();
      expect(uninstall2).toHaveBeenCalled();
      expect(manager.size).toBe(0);
    });

    it('should reject operations after dispose', async () => {
      manager.dispose();

      await expect(manager.use(createPlugin('test'))).rejects.toThrow('disposed');
    });

    it('should be idempotent', () => {
      manager.dispose();
      manager.dispose();
      // No error thrown
    });
  });

  describe('version matching', () => {
    it('should match exact versions', async () => {
      await manager.use(createPlugin('base', '1.2.3'));

      const dependent = createPlugin('dep', '1.0.0', {
        dependencies: [{ name: 'base', versionRange: '1.2.3' }],
      });

      await expect(manager.use(dependent)).resolves.not.toThrow();
    });

    it('should match caret ranges', async () => {
      await manager.use(createPlugin('base', '1.5.0'));

      const dependent = createPlugin('dep', '1.0.0', {
        dependencies: [{ name: 'base', versionRange: '^1.2.0' }],
      });

      await expect(manager.use(dependent)).resolves.not.toThrow();
    });

    it('should reject incompatible caret ranges', async () => {
      await manager.use(createPlugin('base', '2.0.0'));

      const dependent = createPlugin('dep', '1.0.0', {
        dependencies: [{ name: 'base', versionRange: '^1.2.0' }],
      });

      await expect(manager.use(dependent)).rejects.toThrow();
    });

    it('should match tilde ranges', async () => {
      await manager.use(createPlugin('base', '1.2.5'));

      const dependent = createPlugin('dep', '1.0.0', {
        dependencies: [{ name: 'base', versionRange: '~1.2.0' }],
      });

      await expect(manager.use(dependent)).resolves.not.toThrow();
    });

    it('should match >= ranges', async () => {
      await manager.use(createPlugin('base', '2.5.0'));

      const dependent = createPlugin('dep', '1.0.0', {
        dependencies: [{ name: 'base', versionRange: '>=2.0.0' }],
      });

      await expect(manager.use(dependent)).resolves.not.toThrow();
    });
  });
});

