import { describe, it, expect } from 'vitest';
import { calculateInertiaTensor, type InertiaShape } from '../physics';

describe('calculateInertiaTensor', () => {
  it('computes box inertia correctly', () => {
    const shape: InertiaShape = { type: 'box', size: [2, 4, 6] };
    const mass = 3;
    const I = calculateInertiaTensor(shape, mass);
    // Ixx = m/12 * (h^2 + d^2)
    const ixx = (mass / 12) * (4 * 4 + 6 * 6);
    const iyy = (mass / 12) * (2 * 2 + 6 * 6);
    const izz = (mass / 12) * (2 * 2 + 4 * 4);
    expect(close(I[0], ixx)).toBe(true);
    expect(close(I[4], iyy)).toBe(true);
    expect(close(I[8], izz)).toBe(true);
  });

  it('computes sphere inertia correctly', () => {
    const shape: InertiaShape = { type: 'sphere', radius: 2 };
    const mass = 5;
    const I = calculateInertiaTensor(shape, mass);
    const i = (2 / 5) * mass * 2 * 2;
    expect(close(I[0], i)).toBe(true);
    expect(close(I[4], i)).toBe(true);
    expect(close(I[8], i)).toBe(true);
  });

  it('computes capsule inertia (approx) and stays positive', () => {
    const shape: InertiaShape = { type: 'capsule', radius: 1, height: 2 };
    const mass = 4;
    const I = calculateInertiaTensor(shape, mass);
    // All diagonal terms should be finite and positive
    expect(I[0]).toBeGreaterThan(0);
    expect(I[4]).toBeGreaterThan(0);
    expect(I[8]).toBeGreaterThan(0);
    // Off-diagonals must be zero in our diagonal output
    expect(I[1]).toBe(0);
    expect(I[2]).toBe(0);
    expect(I[3]).toBe(0);
    expect(I[5]).toBe(0);
    expect(I[6]).toBe(0);
    expect(I[7]).toBe(0);
  });

  it('validates inputs', () => {
    // @ts-expect-error testing validation
    expect(() => calculateInertiaTensor({ type: 'box', size: [2, -1, 3] }, 1)).toThrow();
    // @ts-expect-error testing validation
    expect(() => calculateInertiaTensor({ type: 'sphere', radius: -1 }, 1)).toThrow();
    // @ts-expect-error testing validation
    expect(() => calculateInertiaTensor({ type: 'capsule', radius: 1, height: 0 }, 1)).toThrow();
    expect(() => calculateInertiaTensor({ type: 'sphere', radius: 1 }, 0)).toThrow();
  });
});

function close(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}


