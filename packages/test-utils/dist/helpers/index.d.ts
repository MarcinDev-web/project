/**
 * Test helper utilities
 */
/**
 * Wait for a condition to become true (with timeout)
 */
export declare function waitFor(condition: () => boolean, timeoutMs?: number, intervalMs?: number): Promise<void>;
/**
 * Wait for next animation frame (in tests)
 */
export declare function waitForNextFrame(): Promise<void>;
/**
 * Run multiple frames of animation
 */
export declare function runFrames(count: number): Promise<void>;
/**
 * Suppress console warnings/errors during a test
 */
export declare function suppressConsole(methods?: ('log' | 'warn' | 'error')[]): {
    suppress: () => void;
    restore: () => void;
};
/**
 * Create a temporary spy on an object method
 */
export declare function withSpy<T extends object, K extends keyof T>(obj: T, method: K, implementation?: T[K]): {
    spy: Required<T>[any] extends new (...args: infer A) => infer R ? import("vitest").MockInstance<(this: R, ...args: A) => R> : T[any] extends (...args: any[]) => any ? import("vitest").MockInstance<T[any]> : never;
    restore: () => void;
};
/**
 * Benchmark a function execution time
 */
export declare function benchmark(fn: () => void | Promise<void>, iterations?: number): () => Promise<{
    average: number;
    min: number;
    max: number;
    median: number | undefined;
    total: number;
    iterations: number;
}>;
/**
 * Create a deferred promise that can be resolved/rejected externally
 */
export declare function createDeferred<T = void>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
};
/**
 * Flush all pending promises
 */
export declare function flushPromises(): Promise<void>;
/**
 * Generate random test data
 */
export declare const randomData: {
    int: (min?: number, max?: number) => number;
    float: (min?: number, max?: number) => number;
    bool: () => boolean;
    string: (length?: number) => string;
    array: <T>(generator: () => T, length: number) => T[];
    pick: <T>(arr: T[]) => T | undefined;
};
/**
 * Setup and teardown helper
 */
export declare function createTestContext<T>(setup: () => T | Promise<T>, teardown: (context: T) => void | Promise<void>): {
    beforeEach: () => Promise<T>;
    afterEach: () => Promise<void>;
    getContext: () => T;
};
//# sourceMappingURL=index.d.ts.map