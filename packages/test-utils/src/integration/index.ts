/**
 * Integration Test Framework
 *
 * Provides utilities for testing cross-package interactions.
 * Ensures proper package boundary compliance while enabling
 * comprehensive integration testing.
 */

import { vi, expect } from 'vitest';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Package identifier for integration tests
 */
export type PackageName =
  | '@engine/core'
  | '@engine/world'
  | '@engine/gfx-webgpu'
  | '@engine/animation'
  | '@engine/avatar'
  | '@engine/camera'
  | '@engine/script'
  | '@engine/stdlib'
  | '@engine/input'
  | '@engine/economy'
  | '@engine/voxel'
  | '@engine/net'
  | '@engine/editor-utils'
  | '@engine/blocks';

/**
 * Dependency graph for package validation
 */
export const PACKAGE_DEPENDENCIES: Record<PackageName, PackageName[]> = {
  '@engine/core': [],
  '@engine/world': ['@engine/core'],
  '@engine/gfx-webgpu': ['@engine/core', '@engine/world'],
  '@engine/animation': ['@engine/core'],
  '@engine/avatar': ['@engine/core', '@engine/world', '@engine/animation'],
  '@engine/camera': ['@engine/core', '@engine/world'],
  '@engine/script': ['@engine/core', '@engine/world'],
  '@engine/stdlib': ['@engine/core', '@engine/world', '@engine/script'],
  '@engine/input': ['@engine/core'],
  '@engine/economy': ['@engine/core'],
  '@engine/voxel': ['@engine/core', '@engine/world'],
  '@engine/net': ['@engine/core', '@engine/world'],
  '@engine/editor-utils': ['@engine/core', '@engine/world'],
  '@engine/blocks': ['@engine/core', '@engine/world'],
};

/**
 * Configuration for integration test context
 */
export interface IntegrationTestConfig {
  /** Packages involved in this test */
  packages: PackageName[];
  /** Whether to validate package boundaries */
  validateBoundaries?: boolean;
  /** Setup timeout in ms */
  setupTimeout?: number;
  /** Teardown timeout in ms */
  teardownTimeout?: number;
  /** Whether to isolate tests (fresh context per test) */
  isolate?: boolean;
}

/**
 * Result of integration test execution
 */
export interface IntegrationTestResult {
  passed: boolean;
  duration: number;
  packagesUsed: PackageName[];
  boundaryViolations: string[];
  errors: Error[];
}

/**
 * Lifecycle hooks for integration tests
 */
export interface IntegrationLifecycle<TContext> {
  beforeAll?: () => TContext | Promise<TContext>;
  beforeEach?: (ctx: TContext) => void | Promise<void>;
  afterEach?: (ctx: TContext) => void | Promise<void>;
  afterAll?: (ctx: TContext) => void | Promise<void>;
}

// ============================================================================
// Core Integration Test Utilities
// ============================================================================

/**
 * Validates that package dependencies don't violate boundaries
 */
export function validatePackageBoundaries(
  sourcePackage: PackageName,
  targetPackage: PackageName
): boolean {
  if (sourcePackage === targetPackage) return true;

  const allowedDeps = PACKAGE_DEPENDENCIES[sourcePackage] || [];
  return allowedDeps.includes(targetPackage);
}

/**
 * Creates an integration test context with cross-package setup
 */
export function createIntegrationContext<TContext>(
  config: IntegrationTestConfig,
  lifecycle: IntegrationLifecycle<TContext>
): {
  setup: () => Promise<TContext>;
  teardown: (ctx: TContext) => Promise<void>;
  validateBoundary: (source: PackageName, target: PackageName) => void;
} {
  const boundaryViolations: string[] = [];

  const validateBoundary = (source: PackageName, target: PackageName): void => {
    if (config.validateBoundaries !== false) {
      const isValid = validatePackageBoundaries(source, target);
      if (!isValid) {
        const violation = `${source} cannot depend on ${target}`;
        boundaryViolations.push(violation);
        throw new Error(`Package boundary violation: ${violation}`);
      }
    }
  };

  const setup = async (): Promise<TContext> => {
    // Validate all package dependencies first
    for (let i = 0; i < config.packages.length; i++) {
      for (let j = i + 1; j < config.packages.length; j++) {
        const pkg1 = config.packages[i]!;
        const pkg2 = config.packages[j]!;
        // Check both directions
        const valid1 = validatePackageBoundaries(pkg1, pkg2);
        const valid2 = validatePackageBoundaries(pkg2, pkg1);
        if (!valid1 && !valid2) {
          console.warn(`Packages ${pkg1} and ${pkg2} have no direct dependency relationship`);
        }
      }
    }

    if (lifecycle.beforeAll) {
      return await lifecycle.beforeAll();
    }
    return undefined as unknown as TContext;
  };

  const teardown = async (ctx: TContext): Promise<void> => {
    if (lifecycle.afterAll) {
      await lifecycle.afterAll(ctx);
    }
    vi.clearAllMocks();
    vi.clearAllTimers();
  };

  return { setup, teardown, validateBoundary };
}

// ============================================================================
// Cross-Package Event Testing
// ============================================================================

/**
 * Event capture for cross-package communication testing
 */
export interface EventCapture<T = unknown> {
  events: Array<{ type: string; data: T; timestamp: number; source?: string }>;
  capture: (type: string, data: T, source?: string) => void;
  getByType: (type: string) => Array<{ type: string; data: T; timestamp: number }>;
  clear: () => void;
  waitFor: (type: string, timeout?: number) => Promise<T>;
}

export function createEventCapture<T = unknown>(): EventCapture<T> {
  const events: EventCapture<T>['events'] = [];
  const waiters = new Map<
    string,
    Array<{ resolve: (data: T) => void; reject: (err: Error) => void }>
  >();

  return {
    events,
    capture: (type: string, data: T, source?: string) => {
      const event = { type, data, timestamp: Date.now(), source };
      events.push(event);

      // Resolve any waiters
      const typeWaiters = waiters.get(type);
      if (typeWaiters) {
        typeWaiters.forEach(({ resolve }) => resolve(data));
        waiters.delete(type);
      }
    },
    getByType: (type: string) => events.filter((e) => e.type === type),
    clear: () => {
      events.length = 0;
    },
    waitFor: (type: string, timeout = 5000): Promise<T> => {
      // Check if event already captured
      const existing = events.find((e) => e.type === type);
      if (existing) return Promise.resolve(existing.data);

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Timeout waiting for event: ${type}`));
        }, timeout);

        if (!waiters.has(type)) {
          waiters.set(type, []);
        }
        waiters.get(type)!.push({
          resolve: (data: T) => {
            clearTimeout(timeoutId);
            resolve(data);
          },
          reject,
        });
      });
    },
  };
}

// ============================================================================
// Integration Scenario Builder
// ============================================================================

/**
 * Step in an integration test scenario
 */
export interface ScenarioStep<TContext> {
  name: string;
  action: (ctx: TContext) => void | Promise<void>;
  validate?: (ctx: TContext) => void | Promise<void>;
  timeout?: number;
}

/**
 * Integration scenario configuration
 */
export interface ScenarioConfig<TContext> {
  name: string;
  description?: string;
  packages: PackageName[];
  setup: () => TContext | Promise<TContext>;
  teardown?: (ctx: TContext) => void | Promise<void>;
  steps: ScenarioStep<TContext>[];
}

/**
 * Run an integration scenario with proper setup/teardown
 */
export async function runIntegrationScenario<TContext>(
  config: ScenarioConfig<TContext>
): Promise<IntegrationTestResult> {
  const startTime = performance.now();
  const errors: Error[] = [];
  const boundaryViolations: string[] = [];

  // Validate package relationships
  for (let i = 0; i < config.packages.length - 1; i++) {
    const source = config.packages[i]!;
    const target = config.packages[i + 1]!;
    if (!validatePackageBoundaries(source, target) && !validatePackageBoundaries(target, source)) {
      boundaryViolations.push(`No direct dependency between ${source} and ${target}`);
    }
  }

  let ctx: TContext | undefined;

  try {
    ctx = await config.setup();

    for (const step of config.steps) {
      try {
        await step.action(ctx);
        if (step.validate) {
          await step.validate(ctx);
        }
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error(String(error)));
  } finally {
    if (ctx && config.teardown) {
      try {
        await config.teardown(ctx);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  return {
    passed: errors.length === 0,
    duration: performance.now() - startTime,
    packagesUsed: config.packages,
    boundaryViolations,
    errors,
  };
}

// ============================================================================
// Package Mock Factory
// ============================================================================

/**
 * Creates standardized mocks for common package interfaces
 */
export const packageMocks = {
  /**
   * Mock @engine/core EventBus
   */
  createEventBusMock: () => {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    return {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(handler);
        return () => listeners.get(event)?.delete(handler);
      }),
      off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        listeners.get(event)?.delete(handler);
      }),
      emit: vi.fn((event: string, ...args: unknown[]) => {
        listeners.get(event)?.forEach((handler) => handler(...args));
      }),
      once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const wrapper = (...args: unknown[]) => {
          handler(...args);
          listeners.get(event)?.delete(wrapper);
        };
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(wrapper);
      }),
      clear: () => listeners.clear(),
      _listeners: listeners,
    };
  },

  /**
   * Mock @engine/world Entity
   */
  createEntityMock: (id = 1, name = 'TestEntity') => ({
    id,
    name,
    components: new Map<string, unknown>(),
    addComponent: vi.fn(function (
      this: { components: Map<string, unknown> },
      type: string,
      data: unknown
    ) {
      this.components.set(type, data);
      return this;
    }),
    getComponent: vi.fn(function (this: { components: Map<string, unknown> }, type: string) {
      return this.components.get(type);
    }),
    hasComponent: vi.fn(function (this: { components: Map<string, unknown> }, type: string) {
      return this.components.has(type);
    }),
    removeComponent: vi.fn(function (this: { components: Map<string, unknown> }, type: string) {
      return this.components.delete(type);
    }),
    dispose: vi.fn(),
  }),

  /**
   * Mock @engine/world Scene
   */
  createSceneMock: () => {
    const entities = new Map<number, ReturnType<typeof packageMocks.createEntityMock>>();
    let nextId = 1;

    return {
      entities,
      createEntity: vi.fn((name?: string) => {
        const entity = packageMocks.createEntityMock(nextId++, name || 'Entity');
        entities.set(entity.id, entity);
        return entity;
      }),
      getEntity: vi.fn((id: number) => entities.get(id)),
      removeEntity: vi.fn((id: number) => {
        const entity = entities.get(id);
        if (entity) {
          entity.dispose();
          entities.delete(id);
        }
      }),
      query: vi.fn((componentTypes: string[]) => {
        return Array.from(entities.values()).filter((e) =>
          componentTypes.every((type) => e.hasComponent(type))
        );
      }),
      dispose: vi.fn(() => {
        entities.forEach((e) => e.dispose());
        entities.clear();
      }),
    };
  },

  /**
   * Mock @engine/animation AnimationSystem
   */
  createAnimationSystemMock: () => ({
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    update: vi.fn(),
    getState: vi.fn(() => 'idle'),
    setSpeed: vi.fn(),
    crossFade: vi.fn(),
    dispose: vi.fn(),
  }),

  /**
   * Mock @engine/input InputManager
   */
  createInputManagerMock: () => {
    const keyStates = new Map<string, boolean>();
    const mousePosition = { x: 0, y: 0 };

    return {
      isKeyDown: vi.fn((key: string) => keyStates.get(key) || false),
      isKeyUp: vi.fn((key: string) => !keyStates.get(key)),
      getMousePosition: vi.fn(() => ({ ...mousePosition })),
      simulateKeyDown: (key: string) => keyStates.set(key, true),
      simulateKeyUp: (key: string) => keyStates.set(key, false),
      simulateMouseMove: (x: number, y: number) => {
        mousePosition.x = x;
        mousePosition.y = y;
      },
      dispose: vi.fn(),
    };
  },
};

// ============================================================================
// Integration Test Assertions
// ============================================================================

/**
 * Assert that packages interact correctly
 */
export function expectPackageInteraction(
  sourcePackage: PackageName,
  targetPackage: PackageName,
  interactionType: 'event' | 'method' | 'data'
): void {
  expect(validatePackageBoundaries(sourcePackage, targetPackage)).toBe(true);
}

/**
 * Assert that all events were received in order
 */
export function expectEventsInOrder<T>(capture: EventCapture<T>, expectedTypes: string[]): void {
  const capturedTypes = capture.events.map((e) => e.type);
  expect(capturedTypes).toEqual(expectedTypes);
}

/**
 * Assert that a cross-package operation completed successfully
 */
export function expectCrossPackageSuccess(result: IntegrationTestResult): void {
  expect(result.passed).toBe(true);
  expect(result.boundaryViolations).toHaveLength(0);
  expect(result.errors).toHaveLength(0);
}

// ============================================================================
// Common Integration Test Patterns
// ============================================================================

/**
 * Test pattern: Core → World entity creation
 */
export async function testCoreWorldEntityCreation(): Promise<IntegrationTestResult> {
  const eventCapture = createEventCapture();

  return runIntegrationScenario({
    name: 'Core-World Entity Creation',
    packages: ['@engine/core', '@engine/world'],
    setup: () => {
      const eventBus = packageMocks.createEventBusMock();
      const scene = packageMocks.createSceneMock();

      // Wire up events
      eventBus.on('entity:created', (entity: unknown) => {
        eventCapture.capture('entity:created', entity, '@engine/world');
      });

      return { eventBus, scene, eventCapture };
    },
    teardown: (ctx) => {
      ctx.scene.dispose();
      ctx.eventBus.clear();
    },
    steps: [
      {
        name: 'Create entity',
        action: (ctx) => {
          const entity = ctx.scene.createEntity('TestEntity');
          ctx.eventBus.emit('entity:created', entity);
        },
        validate: (ctx) => {
          expect(ctx.scene.entities.size).toBe(1);
          expect(ctx.eventCapture.events).toHaveLength(1);
        },
      },
    ],
  });
}

/**
 * Test pattern: World → Animation integration
 */
export async function testWorldAnimationIntegration(): Promise<IntegrationTestResult> {
  return runIntegrationScenario({
    name: 'World-Animation Integration',
    packages: ['@engine/world', '@engine/animation'],
    setup: () => {
      const scene = packageMocks.createSceneMock();
      const animationSystem = packageMocks.createAnimationSystemMock();
      return { scene, animationSystem };
    },
    teardown: (ctx) => {
      ctx.scene.dispose();
      ctx.animationSystem.dispose();
    },
    steps: [
      {
        name: 'Create animated entity',
        action: (ctx) => {
          const entity = ctx.scene.createEntity('AnimatedEntity');
          entity.addComponent('animation', { clips: [] });
          ctx.animationSystem.play();
        },
        validate: (ctx) => {
          expect(ctx.animationSystem.play).toHaveBeenCalled();
        },
      },
      {
        name: 'Update animation',
        action: (ctx) => {
          ctx.animationSystem.update(16); // 16ms delta
        },
        validate: (ctx) => {
          expect(ctx.animationSystem.update).toHaveBeenCalledWith(16);
        },
      },
    ],
  });
}
