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
interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize?: number;
  };
}

type DisposableLike = {
  isDisposed?: boolean;
  destroyed?: boolean;
  listenerCount?: () => number;
};

function runGcIfAvailable(): void {
  const maybeGc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
  if (maybeGc) {
    maybeGc();
  }
}

function getUsedJsHeapSize(perf: PerformanceWithMemory): number {
  const used = perf.memory?.usedJSHeapSize;
  return typeof used === 'number' ? used : 0;
}

export function expectNoMemoryLeak<T>(
  setup: () => T,
  teardown: (obj: T) => void,
  iterations = 100
): void {
  // Force initial GC if available
  runGcIfAvailable();

  const initial = getUsedJsHeapSize(performance as PerformanceWithMemory);

  // Run multiple iterations
  for (let i = 0; i < iterations; i++) {
    const obj = setup();
    teardown(obj);
  }

  // Force GC again
  runGcIfAvailable();

  const final = getUsedJsHeapSize(performance as PerformanceWithMemory);
  const growth = final - initial;
  const denominator = initial === 0 ? 1 : initial;
  const growthPercent = (growth / denominator) * 100;

  // Allow for some growth (10%) but not significant leaks
  expect(growthPercent).toBeLessThan(10);
}

/**
 * Assert that an object is properly disposed (all resources freed)
 */
export function expectToBeDisposed(obj: DisposableLike): void {
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
