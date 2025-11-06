/**
 * Test helper utilities
 */

import { vi } from 'vitest';

type ConsoleMethod = 'log' | 'warn' | 'error';
type AnyFunction = (...args: unknown[]) => unknown;
type MethodKeys<T> = {
  [K in keyof T]: T[K] extends AnyFunction ? K : never;
}[keyof T];
type MethodOf<T, K extends keyof T> = Extract<T[K], AnyFunction>;

/**
 * Wait for a condition to become true (with timeout)
 */
export async function waitFor(
  condition: () => boolean,
  timeoutMs = 5000,
  intervalMs = 50
): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Timeout waiting for condition after ${timeoutMs}ms`));
      } else {
        setTimeout(check, intervalMs);
      }
    };
    check();
  });
}

/**
 * Wait for next animation frame (in tests)
 */
export async function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/**
 * Run multiple frames of animation
 */
export async function runFrames(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await waitForNextFrame();
  }
}

/**
 * Suppress console warnings/errors during a test
 */
export function suppressConsole(methods: ConsoleMethod[] = ['warn', 'error']) {
  const originalMethods = new Map<ConsoleMethod, AnyFunction>();

  return {
    suppress: () => {
      methods.forEach((method) => {
        const current = Reflect.get(console, method);
        if (typeof current === 'function') {
          originalMethods.set(method, current as AnyFunction);
          Reflect.set(console, method, vi.fn());
        }
      });
    },
    restore: () => {
      methods.forEach((method) => {
        const original = originalMethods.get(method);
        if (original) {
          Reflect.set(console, method, original);
        }
      });
    },
  };
}

/**
 * Create a temporary spy on an object method
 */
export function withSpy<T extends Record<string, unknown>, K extends MethodKeys<T>>(
  obj: T,
  method: K,
  implementation?: MethodOf<T, K>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const spy = vi.spyOn(obj, method as any) as any;
  if (implementation) {
    spy.mockImplementation(implementation as AnyFunction);
  }

  return {
    spy,
    restore: () => spy.mockRestore(),
  };
}

/**
 * Benchmark a function execution time
 */
export function benchmark(fn: () => void | Promise<void>, iterations = 1000) {
  return async () => {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      times.push(performance.now() - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];

    return {
      average: avg,
      min,
      max,
      median,
      total: times.reduce((a, b) => a + b, 0),
      iterations,
    };
  };
}

/**
 * Create a deferred promise that can be resolved/rejected externally
 */
export function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Flush all pending promises
 */
export async function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Generate random test data
 */
export const randomData = {
  int: (min = 0, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min,
  float: (min = 0, max = 1) => Math.random() * (max - min) + min,
  bool: () => Math.random() > 0.5,
  string: (length = 10) =>
    Array.from({ length }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join(''),
  array: <T>(generator: () => T, length: number) => Array.from({ length }, generator),
  pick: <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)],
};

/**
 * Setup and teardown helper
 */
export function createTestContext<T>(
  setup: () => T | Promise<T>,
  teardown: (context: T) => void | Promise<void>
) {
  let context: T;

  return {
    beforeEach: async () => {
      context = await setup();
      return context;
    },
    afterEach: async () => {
      await teardown(context);
    },
    getContext: () => context,
  };
}
