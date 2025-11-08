/**
 * Custom assertions and matchers
 */
/**
 * Assert that two vectors are approximately equal
 */
export declare function expectVec3ToBeCloseTo(actual: ArrayLike<number>, expected: ArrayLike<number>, precision?: number): void;
/**
 * Assert that a quaternion is normalized
 */
export declare function expectQuatToBeNormalized(quat: ArrayLike<number>, precision?: number): void;
/**
 * Assert that a matrix is approximately equal to identity
 */
export declare function expectMat4ToBeIdentity(mat: ArrayLike<number>, precision?: number): void;
/**
 * Assert that a value is within a range
 */
export declare function expectToBeInRange(value: number, min: number, max: number): void;
/**
 * Assert that an array contains unique values
 */
export declare function expectArrayToBeUnique<T>(arr: T[]): void;
/**
 * Assert that a function executes within a time limit (in ms)
 */
export declare function expectToExecuteWithin(fn: () => void | Promise<void>, maxMs: number): Promise<void>;
type DisposableLike = {
    isDisposed?: boolean;
    destroyed?: boolean;
    listenerCount?: () => number;
};
export declare function expectNoMemoryLeak<T>(setup: () => T, teardown: (obj: T) => void, iterations?: number): void;
/**
 * Assert that an object is properly disposed (all resources freed)
 */
export declare function expectToBeDisposed(obj: DisposableLike): void;
export {};
//# sourceMappingURL=index.d.ts.map