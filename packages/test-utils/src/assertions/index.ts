/**
 * Custom assertions and matchers
 */

import { expect } from 'vitest';

/**
 * Assert that two vectors are approximately equal
 */
export function expectVec3ToBeCloseTo(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  precision = 2
) {
  expect(actual.length).toBe(3);
  expect(expected.length).toBe(3);
  expect(actual[0]).toBeCloseTo(expected[0]!, precision);
  expect(actual[1]).toBeCloseTo(expected[1]!, precision);
  expect(actual[2]).toBeCloseTo(expected[2]!, precision);
}

/**
 * Assert that a quaternion is normalized
 */
export function expectQuatToBeNormalized(quat: ArrayLike<number>, precision = 5) {
  const lengthSquared =
    quat[0]! * quat[0]! + quat[1]! * quat[1]! + quat[2]! * quat[2]! + quat[3]! * quat[3]!;
  expect(lengthSquared).toBeCloseTo(1, precision);
}

/**
 * Assert that a matrix is approximately equal to identity
 */
export function expectMat4ToBeIdentity(mat: ArrayLike<number>, precision = 5) {
  expect(mat.length).toBe(16);
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (let i = 0; i < 16; i++) {
    expect(mat[i]).toBeCloseTo(identity[i]!, precision);
  }
}

/**
 * Assert that a value is within a range
 */
export function expectToBeInRange(value: number, min: number, max: number) {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

/**
 * Assert that an array contains unique values
 */
export function expectArrayToBeUnique<T>(arr: T[]) {
  const uniqueSet = new Set(arr);
  expect(uniqueSet.size).toBe(arr.length);
}

/**
 * Assert that a function executes within a time limit (in ms)
 */
export async function expectToExecuteWithin(fn: () => void | Promise<void>, maxMs: number) {
  const start = performance.now();
  await fn();
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(maxMs);
}

/**
 * Assert that memory is properly cleaned up (no leaks)
 */
export function expectNoMemoryLeak(
  setup: () => any,
  teardown: (obj: any) => void,
  iterations = 100
) {
  // Force initial GC if available
  if (global.gc) global.gc();

  const initial = (performance as any).memory?.usedJSHeapSize ?? 0;

  // Run multiple iterations
  for (let i = 0; i < iterations; i++) {
    const obj = setup();
    teardown(obj);
  }

  // Force GC again
  if (global.gc) global.gc();

  const final = (performance as any).memory?.usedJSHeapSize ?? 0;
  const growth = final - initial;
  const growthPercent = (growth / initial) * 100;

  // Allow for some growth (10%) but not significant leaks
  expect(growthPercent).toBeLessThan(10);
}

/**
 * Assert that an object is properly disposed (all resources freed)
 */
export function expectToBeDisposed(obj: any) {
  // Check common disposal indicators
  if ('isDisposed' in obj) {
    expect(obj.isDisposed).toBe(true);
  }
  if ('destroyed' in obj) {
    expect(obj.destroyed).toBe(true);
  }
  // Check that no listeners remain
  if ('listenerCount' in obj) {
    expect(obj.listenerCount()).toBe(0);
  }
}
