/**
 * Custom assertions and matchers
 */
import { expect } from 'vitest';
/**
 * Assert that two vectors are approximately equal
 */
export function expectVec3ToBeCloseTo(actual, expected, precision = 2) {
    expect(actual.length).toBe(3);
    expect(expected.length).toBe(3);
    expect(actual[0]).toBeCloseTo(expected[0], precision);
    expect(actual[1]).toBeCloseTo(expected[1], precision);
    expect(actual[2]).toBeCloseTo(expected[2], precision);
}
/**
 * Assert that a quaternion is normalized
 */
export function expectQuatToBeNormalized(quat, precision = 5) {
    const lengthSquared = quat[0] * quat[0] + quat[1] * quat[1] + quat[2] * quat[2] + quat[3] * quat[3];
    expect(lengthSquared).toBeCloseTo(1, precision);
}
/**
 * Assert that a matrix is approximately equal to identity
 */
export function expectMat4ToBeIdentity(mat, precision = 5) {
    expect(mat.length).toBe(16);
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    for (let i = 0; i < 16; i++) {
        expect(mat[i]).toBeCloseTo(identity[i], precision);
    }
}
/**
 * Assert that a value is within a range
 */
export function expectToBeInRange(value, min, max) {
    expect(value).toBeGreaterThanOrEqual(min);
    expect(value).toBeLessThanOrEqual(max);
}
/**
 * Assert that an array contains unique values
 */
export function expectArrayToBeUnique(arr) {
    const uniqueSet = new Set(arr);
    expect(uniqueSet.size).toBe(arr.length);
}
/**
 * Assert that a function executes within a time limit (in ms)
 */
export async function expectToExecuteWithin(fn, maxMs) {
    const start = performance.now();
    await fn();
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(maxMs);
}
function runGcIfAvailable() {
    const maybeGc = globalThis.gc;
    if (maybeGc) {
        maybeGc();
    }
}
function getUsedJsHeapSize(perf) {
    const used = perf.memory?.usedJSHeapSize;
    return typeof used === 'number' ? used : 0;
}
export function expectNoMemoryLeak(setup, teardown, iterations = 100) {
    // Force initial GC if available
    runGcIfAvailable();
    const initial = getUsedJsHeapSize(performance);
    // Run multiple iterations
    for (let i = 0; i < iterations; i++) {
        const obj = setup();
        teardown(obj);
    }
    // Force GC again
    runGcIfAvailable();
    const final = getUsedJsHeapSize(performance);
    const growth = final - initial;
    const denominator = initial === 0 ? 1 : initial;
    const growthPercent = (growth / denominator) * 100;
    // Allow for some growth (10%) but not significant leaks
    expect(growthPercent).toBeLessThan(10);
}
/**
 * Assert that an object is properly disposed (all resources freed)
 */
export function expectToBeDisposed(obj) {
    // Check common disposal indicators
    if (typeof obj.isDisposed === 'boolean') {
        expect(obj.isDisposed).toBe(true);
    }
    if (typeof obj.destroyed === 'boolean') {
        expect(obj.destroyed).toBe(true);
    }
    // Check that no listeners remain
    if (typeof obj.listenerCount === 'function') {
        expect(obj.listenerCount()).toBe(0);
    }
}
//# sourceMappingURL=index.js.map