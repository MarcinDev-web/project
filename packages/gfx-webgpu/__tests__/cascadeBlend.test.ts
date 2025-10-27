import { describe, it, expect } from 'vitest';
import { computeCascadeBlend, selectCascade } from '../src/shadows/blendUtils';

describe('computeCascadeBlend', () => {
  const splits: [number, number, number, number] = [10, 30, 60, 100];

  it('selects correct base cascade', () => {
    expect(selectCascade(5, splits)).toBe(0);
    expect(selectCascade(10, splits)).toBe(0);
    expect(selectCascade(20, splits)).toBe(1);
    expect(selectCascade(45, splits)).toBe(2);
    expect(selectCascade(80, splits)).toBe(3);
  });

  it('blends at lower boundary', () => {
    const overlap = 0.1; // 10% of range
    const depth = 10 - (30 - 10) * overlap * 0.25; // a bit below split0 from cascade1 side
    const [base, neighbor, weight] = computeCascadeBlend(depth, splits, overlap);
    expect(base).toBe(1);
    expect(neighbor).toBe(0);
    expect(weight).toBeGreaterThan(0);
    expect(weight).toBeLessThanOrEqual(1);
  });

  it('blends at upper boundary', () => {
    const overlap = 0.1;
    const upper = 30; // boundary between 1 and 2
    const depth = upper - (60 - 30) * overlap * 0.25; // near upper boundary inside cascade1
    const [base, neighbor, weight] = computeCascadeBlend(depth, splits, overlap);
    // Depending on where we are relative to boundary, neighbor might be 2
    expect(base).toBe(1);
    expect([1, 2]).toContain(neighbor);
    expect(weight).toBeGreaterThanOrEqual(0);
  });
});


