import { expect } from '@playwright/test';

export interface CloseOptions {
  abs?: number;
  rel?: number;
}

export function expectArrayClose(actual: ArrayLike<number>, expected: ArrayLike<number>, opts: CloseOptions = {}): void {
  const abs = opts.abs ?? 1e-5;
  const rel = opts.rel ?? 1e-5;
  const n = Math.min(actual.length, expected.length);
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < n; i++) {
    const a = actual[i];
    const e = expected[i];
    const diff = Math.abs(a - e);
    const tol = Math.max(abs, rel * Math.max(1, Math.abs(e)));
    if (Number.isNaN(a) || Number.isNaN(e) || diff > tol) {
      throw new Error(`Arrays differ at index ${i}: actual=${a}, expected=${e}, diff=${diff}, tol=${tol}`);
    }
  }
}


