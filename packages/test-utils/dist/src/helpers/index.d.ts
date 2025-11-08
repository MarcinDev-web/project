/**
 * Test helper utilities
 */
type ConsoleMethod = 'log' | 'warn' | 'error';
type AnyFunction = (...args: unknown[]) => unknown;
type MethodKeys<T> = {
    [K in keyof T]: T[K] extends AnyFunction ? K : never;
}[keyof T];
type MethodOf<T, K extends keyof T> = Extract<T[K], AnyFunction>;
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
export declare function suppressConsole(methods?: ConsoleMethod[]): {
    suppress: () => void;
    restore: () => void;
};
/**
 * Create a temporary spy on an object method
 */
export declare function withSpy<T extends Record<string, unknown>, K extends MethodKeys<T>>(obj: T, method: K, implementation?: MethodOf<T, K>): {
    spy: any;
    restore: () => any;
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
    reject: (reason?: unknown) => void;
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
export {};
//# sourceMappingURL=index.d.ts.map