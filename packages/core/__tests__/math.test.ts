import { describe, it, expect } from 'vitest';
import {
  mat4Perspective,
  mat4LookAt,
  mat4FromRotationTranslation,
  mat4Multiply,
  normalizeVec3,
  quatFromAxisAngle,
  quatNormalize,
  quatMultiply,
  type Mat4,
} from '@engine/core';

function makeMat(): Mat4 {
  return new Float32Array(16);
}

describe('mat4Perspective validation', () => {
  it('throws on non-positive aspect', () => {
    expect(() => mat4Perspective(makeMat(), Math.PI / 3, 0, 0.1, 10)).toThrow();
    expect(() => mat4Perspective(makeMat(), Math.PI / 3, -1, 0.1, 10)).toThrow();
  });
  it('throws on non-positive near', () => {
    expect(() => mat4Perspective(makeMat(), Math.PI / 3, 1, 0, 10)).toThrow();
  });
  it('throws if far <= near', () => {
    expect(() => mat4Perspective(makeMat(), Math.PI / 3, 1, 1, 1)).toThrow();
    expect(() => mat4Perspective(makeMat(), Math.PI / 3, 1, 1, 0.5)).toThrow();
  });
  it('throws if fovy >= PI or invalid', () => {
    expect(() => mat4Perspective(makeMat(), Math.PI, 1, 0.1, 10)).toThrow();
    expect(() => mat4Perspective(makeMat(), Infinity, 1, 0.1, 10)).toThrow();
  });
  it('computes a valid matrix for sane inputs', () => {
    const out = makeMat();
    const m = mat4Perspective(out, Math.PI / 3, 1.6, 0.1, 100);
    expect(Number.isFinite(m[0])).toBe(true);
    expect(Number.isFinite(m[5])).toBe(true);
    // WebGPU 0..1 depth (ZO): m[11] = -1
    expect(m[11]).toBe(-1);
    expect(m[10]).toBeLessThan(0);
  });
});

describe('mat4LookAt validation', () => {
  it('throws on zero up vector', () => {
    const out = makeMat();
    expect(() => mat4LookAt(out, [0, 0, 1], [0, 0, 0], [0, 0, 0])).toThrow();
  });
  it('throws when up is parallel to view direction', () => {
    const out = makeMat();
    expect(() => mat4LookAt(out, [0, 0, 1], [0, 0, 0], [0, 0, 1])).toThrow();
  });
  it('works for valid inputs', () => {
    const out = makeMat();
    const m = mat4LookAt(out, [1, 1, 1], [0, 0, 0], [0, 1, 0]);
    expect(m[15]).toBe(1);
  });
});

describe('mat4FromRotationTranslation validation', () => {
  it('throws on non-finite angle or translation', () => {
    const out = makeMat();
    expect(() => mat4FromRotationTranslation(out, NaN, [0, 0, 0])).toThrow();
    expect(() => mat4FromRotationTranslation(out, 0, [0, 0, Infinity])).toThrow();
  });
  it('works for valid inputs', () => {
    const out = makeMat();
    const m = mat4FromRotationTranslation(out, Math.PI / 2, [1, 2, 3]);
    expect(m[12]).toBe(1);
    expect(m[13]).toBe(2);
    expect(m[14]).toBe(3);
  });
});

describe('mat4Multiply validation', () => {
  it('throws on invalid matrices', () => {
    // @ts-expect-error testing invalid mat
    expect(() => mat4Multiply(new Float32Array(16), [], new Float32Array(16))).toThrow();
  });
  it('produces finite output for identity-like inputs', () => {
    const a = new Float32Array(16);
    const b = new Float32Array(16);
    a[0] = a[5] = a[10] = a[15] = 1;
    b[0] = b[5] = b[10] = b[15] = 1;
    const out = new Float32Array(16);
    const m = mat4Multiply(out, a, b);
    expect(m[0]).toBe(1);
    expect(m[5]).toBe(1);
    expect(m[10]).toBe(1);
    expect(m[15]).toBe(1);
  });
});

describe('normalizeVec3 validation', () => {
  it('throws on zero vector', () => {
    expect(() => normalizeVec3([0, 0, 0])).toThrow();
  });
  it('returns unit vector', () => {
    const v = normalizeVec3([3, 0, 0]);
    expect(v[0]).toBe(1);
    expect(v[1]).toBe(0);
    expect(v[2]).toBe(0);
  });
});

describe('quaternion validation', () => {
  it('quatNormalize throws on zero quat', () => {
    expect(() => quatNormalize([0, 0, 0, 0])).toThrow();
  });
  it('quatFromAxisAngle throws on invalid inputs', () => {
    expect(() => quatFromAxisAngle([0, 0, 0], 1)).toThrow();
    expect(() => quatFromAxisAngle([1, 0, 0], Infinity)).toThrow();
  });
  it('quatMultiply works with unit quats', () => {
    const qx = quatFromAxisAngle([1, 0, 0], Math.PI / 2);
    const qy = quatFromAxisAngle([0, 1, 0], Math.PI / 2);
    const q = quatMultiply(quatNormalize(qx), quatNormalize(qy));
    expect(q.every(Number.isFinite)).toBe(true);
    const len = Math.hypot(q[0], q[1], q[2], q[3]);
    expect(Math.abs(len - 1)).toBeLessThan(1e-6);
  });
});
