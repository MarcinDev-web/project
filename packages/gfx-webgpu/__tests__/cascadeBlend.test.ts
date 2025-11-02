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
    // Depth just above split0 (10) so it's in cascade1, but within overlap zone of cascade0
    // For cascade1 (10-30), the overlap zone with cascade0 is at split0 - overlap
    // Overlap range = (30 - 10) * 0.1 = 2, so overlap zone starts at 10 - 2 = 8
    const depth = 9.5; // Just above the overlap start, in cascade1's lower overlap zone
    const [base, neighbor, weight] = computeCascadeBlend(depth, splits, overlap);
    // Depth 9.5 is < 10, so base cascade is 0, and it blends with cascade1
    expect(base).toBe(0);
    expect(neighbor).toBe(1);
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


