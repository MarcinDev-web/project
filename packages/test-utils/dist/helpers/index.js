/**
 * Test helper utilities
 */
import { vi } from 'vitest';
/**
 * Wait for a condition to become true (with timeout)
 */
export async function waitFor(condition, timeoutMs = 5000, intervalMs = 50) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
        const check = () => {
            if (condition()) {
                resolve();
            }
            else if (Date.now() - startTime > timeoutMs) {
                reject(new Error(`Timeout waiting for condition after ${timeoutMs}ms`));
            }
            else {
                setTimeout(check, intervalMs);
            }
        };
        check();
    });
}
/**
 * Wait for next animation frame (in tests)
 */
export async function waitForNextFrame() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}
/**
 * Run multiple frames of animation
 */
export async function runFrames(count) {
    for (let i = 0; i < count; i++) {
        await waitForNextFrame();
    }
}
/**
 * Suppress console warnings/errors during a test
 */
export function suppressConsole(methods = ['warn', 'error']) {
    const originalMethods = new Map();
    return {
        suppress: () => {
            methods.forEach((method) => {
                originalMethods.set(method, console[method]);
                console[method] = vi.fn();
            });
        },
        restore: () => {
            methods.forEach((method) => {
                const original = originalMethods.get(method);
                if (original)
                    console[method] = original;
            });
        },
    };
}
/**
 * Create a temporary spy on an object method
 */
export function withSpy(obj, method, implementation) {
    const spy = vi.spyOn(obj, method);
    if (implementation) {
        spy.mockImplementation(implementation);
    }
    return {
        spy,
        restore: () => spy.mockRestore(),
    };
}
/**
 * Benchmark a function execution time
 */
export function benchmark(fn, iterations = 1000) {
    return async () => {
        const times = [];
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
export function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}
/**
 * Flush all pending promises
 */
export async function flushPromises() {
    return new Promise((resolve) => setImmediate(resolve));
}
/**
 * Generate random test data
 */
export const randomData = {
    int: (min = 0, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min,
    float: (min = 0, max = 1) => Math.random() * (max - min) + min,
    bool: () => Math.random() > 0.5,
    string: (length = 10) => Array.from({ length }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join(''),
    array: (generator, length) => Array.from({ length }, generator),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
};
/**
 * Setup and teardown helper
 */
export function createTestContext(setup, teardown) {
    let context;
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
//# sourceMappingURL=index.js.map