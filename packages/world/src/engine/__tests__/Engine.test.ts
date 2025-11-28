import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Engine } from '../Engine.js';
import { Scene } from '../../core/Scene.js';
import type { Plugin } from '@engine/core/plugin';
import type { System } from '@engine/core/ecs';

// Helper to create a simple plugin
function createPlugin(
  name: string,
  options: {
    onInstall?: (engine: Engine) => void | Promise<void>;
    onUninstall?: (engine: Engine) => void | Promise<void>;
    onStart?: (engine: Engine) => void | Promise<void>;
    onStop?: (engine: Engine) => void | Promise<void>;
    api?: unknown;
  } = {}
): Plugin<Engine> {
  return {
    metadata: {
      name,
      version: '1.0.0',
    },
    install: options.onInstall ?? vi.fn(),
    uninstall: options.onUninstall ?? vi.fn(),
    onStart: options.onStart,
    onStop: options.onStop,
    getAPI: options.api ? () => options.api : undefined,
  };
}

// Helper to create a mock system
function createMockSystem(
  requiredComponents: System['requiredComponents'] = []
): System & { update: ReturnType<typeof vi.fn>; fixedUpdate: ReturnType<typeof vi.fn> } {
  return {
    requiredComponents,
    update: vi.fn(),
    fixedUpdate: vi.fn(),
  };
}

describe('Engine', () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ name: 'TestEngine' });
  });

  afterEach(() => {
    engine.dispose();
  });

  describe('constructor', () => {
    it('should create engine with default options', () => {
      const defaultEngine = new Engine();
      expect(defaultEngine.name).toBe('Engine');
      expect(defaultEngine.scene).toBeInstanceOf(Scene);
      defaultEngine.dispose();
    });

    it('should create engine with custom name', () => {
      expect(engine.name).toBe('TestEngine');
    });

    it('should use provided scene', () => {
      const scene = new Scene('CustomScene');
      const customEngine = new Engine({ scene });

      expect(customEngine.scene).toBe(scene);
      expect(customEngine.scene.name).toBe('CustomScene');

      customEngine.dispose();
    });

    it('should initialize with idle state', () => {
      expect(engine.getState()).toBe('idle');
      expect(engine.isRunning).toBe(false);
    });
  });

  describe('use()', () => {
    it('should install a plugin', async () => {
      const installFn = vi.fn();
      const plugin = createPlugin('test', { onInstall: installFn });

      await engine.use(plugin);

      expect(installFn).toHaveBeenCalledWith(engine);
      expect(engine.plugins.has('test')).toBe(true);
    });

    it('should return engine for chaining', async () => {
      const plugin = createPlugin('test');
      const result = await engine.use(plugin);

      expect(result).toBe(engine);
    });

    it('should throw when disposed', async () => {
      engine.dispose();
      const plugin = createPlugin('test');

      await expect(engine.use(plugin)).rejects.toThrow('disposed');
    });
  });

  describe('system management', () => {
    it('should register a system', () => {
      const system = createMockSystem();

      engine.registerSystem('physics', system);

      expect(engine.hasSystem('physics')).toBe(true);
      expect(engine.getSystem('physics')).toBe(system);
    });

    it('should throw on duplicate system name', () => {
      const system1 = createMockSystem();
      const system2 = createMockSystem();

      engine.registerSystem('physics', system1);

      expect(() => engine.registerSystem('physics', system2)).toThrow('already registered');
    });

    it('should unregister a system', () => {
      const system = createMockSystem();

      engine.registerSystem('physics', system);
      const result = engine.unregisterSystem('physics');

      expect(result).toBe(true);
      expect(engine.hasSystem('physics')).toBe(false);
    });

    it('should return false when unregistering non-existent system', () => {
      expect(engine.unregisterSystem('non-existent')).toBe(false);
    });

    it('should list system names in order', () => {
      engine.registerSystem('physics', createMockSystem());
      engine.registerSystem('render', createMockSystem());
      engine.registerSystem('input', createMockSystem());

      expect(engine.getSystemNames()).toEqual(['physics', 'render', 'input']);
    });

    it('should emit events on register/unregister', () => {
      const registerHandler = vi.fn();
      const unregisterHandler = vi.fn();

      engine.events.on('system:registered', registerHandler);
      engine.events.on('system:unregistered', unregisterHandler);

      engine.registerSystem('test', createMockSystem());
      engine.unregisterSystem('test');

      expect(registerHandler).toHaveBeenCalledWith({ name: 'test' });
      expect(unregisterHandler).toHaveBeenCalledWith({ name: 'test' });
    });
  });

  describe('update()', () => {
    it('should not update when not running', () => {
      const system = createMockSystem();
      engine.registerSystem('test', system);

      engine.update(0.016);

      expect(system.update).not.toHaveBeenCalled();
    });

    it('should update all systems when running', async () => {
      const system1 = createMockSystem();
      const system2 = createMockSystem();

      engine.registerSystem('s1', system1);
      engine.registerSystem('s2', system2);

      await engine.start();
      engine.update(0.016);

      expect(system1.update).toHaveBeenCalledWith(0.016);
      expect(system2.update).toHaveBeenCalledWith(0.016);
    });

    it('should update systems in registration order', async () => {
      const order: string[] = [];

      const system1: System = {
        requiredComponents: [],
        update: () => order.push('s1'),
      };
      const system2: System = {
        requiredComponents: [],
        update: () => order.push('s2'),
      };

      engine.registerSystem('s1', system1);
      engine.registerSystem('s2', system2);

      await engine.start();
      engine.update(0.016);

      expect(order).toEqual(['s1', 's2']);
    });

    it('should emit update event', async () => {
      const handler = vi.fn();
      engine.events.on('engine:update', handler);

      await engine.start();
      engine.update(0.016);

      expect(handler).toHaveBeenCalledWith({ dt: 0.016 });
    });

    it('should ignore invalid delta times', async () => {
      const system = createMockSystem();
      engine.registerSystem('test', system);
      await engine.start();

      engine.update(NaN);
      engine.update(-1);
      engine.update(Infinity);

      expect(system.update).not.toHaveBeenCalled();
    });

    it('should handle system errors gracefully', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingSystem: System = {
        requiredComponents: [],
        update: () => {
          throw new Error('System error');
        },
      };
      const workingSystem = createMockSystem();

      engine.registerSystem('failing', failingSystem);
      engine.registerSystem('working', workingSystem);

      await engine.start();
      engine.update(0.016);

      // Should continue to other systems
      expect(workingSystem.update).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('fixedUpdate()', () => {
    it('should not fixedUpdate when not running', () => {
      const system = createMockSystem();
      engine.registerSystem('test', system);

      engine.fixedUpdate(0.016);

      expect(system.fixedUpdate).not.toHaveBeenCalled();
    });

    it('should call fixedUpdate on systems that have it', async () => {
      const system = createMockSystem();
      engine.registerSystem('test', system);

      await engine.start();
      engine.fixedUpdate(0.016);

      expect(system.fixedUpdate).toHaveBeenCalledWith(0.016);
    });

    it('should skip systems without fixedUpdate', async () => {
      const systemWithFixed = createMockSystem();
      const systemWithoutFixed: System = {
        requiredComponents: [],
        update: vi.fn(),
      };

      engine.registerSystem('with', systemWithFixed);
      engine.registerSystem('without', systemWithoutFixed);

      await engine.start();
      engine.fixedUpdate(0.016);

      expect(systemWithFixed.fixedUpdate).toHaveBeenCalled();
      // No error from calling undefined fixedUpdate
    });

    it('should emit fixedUpdate event', async () => {
      const handler = vi.fn();
      engine.events.on('engine:fixedUpdate', handler);

      await engine.start();
      engine.fixedUpdate(0.016);

      expect(handler).toHaveBeenCalledWith({ dt: 0.016 });
    });
  });

  describe('lifecycle', () => {
    it('should start engine and plugins', async () => {
      const startFn = vi.fn();
      const plugin = createPlugin('test', { onStart: startFn });

      await engine.use(plugin);
      await engine.start();

      expect(engine.getState()).toBe('running');
      expect(engine.isRunning).toBe(true);
      expect(startFn).toHaveBeenCalledWith(engine);
    });

    it('should emit started event', async () => {
      const handler = vi.fn();
      engine.events.on('engine:started', handler);

      await engine.start();

      expect(handler).toHaveBeenCalled();
    });

    it('should stop engine and plugins', async () => {
      const stopFn = vi.fn();
      const plugin = createPlugin('test', { onStart: vi.fn(), onStop: stopFn });

      await engine.use(plugin);
      await engine.start();
      await engine.stop();

      expect(engine.getState()).toBe('stopped');
      expect(engine.isRunning).toBe(false);
      expect(stopFn).toHaveBeenCalledWith(engine);
    });

    it('should emit stopped event', async () => {
      const handler = vi.fn();
      engine.events.on('engine:stopped', handler);

      await engine.start();
      await engine.stop();

      expect(handler).toHaveBeenCalled();
    });

    it('should handle multiple start calls gracefully', async () => {
      await engine.start();
      await engine.start(); // Should not throw
      await engine.start();

      expect(engine.isRunning).toBe(true);
    });

    it('should handle multiple stop calls gracefully', async () => {
      await engine.start();
      await engine.stop();
      await engine.stop(); // Should not throw
      await engine.stop();

      expect(engine.getState()).toBe('stopped');
    });

    it('should throw when starting disposed engine', async () => {
      engine.dispose();
      await expect(engine.start()).rejects.toThrow('disposed');
    });
  });

  describe('dispose()', () => {
    it('should dispose plugins', async () => {
      const uninstallFn = vi.fn();
      const plugin = createPlugin('test', { onUninstall: uninstallFn });

      await engine.use(plugin);
      engine.dispose();

      expect(uninstallFn).toHaveBeenCalled();
    });

    it('should clear systems', () => {
      engine.registerSystem('test', createMockSystem());
      engine.dispose();

      expect(engine.getSystemNames()).toHaveLength(0);
    });

    it('should be idempotent', () => {
      engine.dispose();
      engine.dispose(); // Should not throw
    });

    it('should set disposed state', () => {
      engine.dispose();
      expect(engine.isDisposed()).toBe(true);
    });

    it('should reject system registration after dispose', () => {
      engine.dispose();
      expect(() => engine.registerSystem('test', createMockSystem())).toThrow('disposed');
    });
  });

  describe('plugin integration with systems', () => {
    it('should allow plugins to register systems', async () => {
      const mockSystem = createMockSystem();
      const plugin = createPlugin('system-plugin', {
        onInstall: (e) => e.registerSystem('pluginSystem', mockSystem),
        onUninstall: (e) => e.unregisterSystem('pluginSystem'),
      });

      await engine.use(plugin);

      expect(engine.hasSystem('pluginSystem')).toBe(true);

      await engine.plugins.remove('system-plugin');

      expect(engine.hasSystem('pluginSystem')).toBe(false);
    });

    it('should allow access to plugin API', async () => {
      interface TestAPI {
        getValue: () => number;
      }

      const plugin = createPlugin('api-plugin', {
        api: { getValue: () => 42 } as TestAPI,
      });

      await engine.use(plugin);

      const api = engine.plugins.getAPI<TestAPI>('api-plugin');
      expect(api?.getValue()).toBe(42);
    });
  });
});

