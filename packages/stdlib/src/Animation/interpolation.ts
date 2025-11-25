import { quat } from 'gl-matrix';
import { lerpVec3Out, quatSlerpOut, quatNormalizeOut } from '@engine/core/math';
import type { Vec3, Quat } from '@engine/core/math';
import type {
  AnimationEasing,
  AnimationInterpolation,
  AnimationTrackType,
  AnimationValue,
} from './types';

function applyEasing(t: number, easing: AnimationEasing | undefined): number {
  if (!Number.isFinite(t)) return 0;
  const clamped = Math.min(1, Math.max(0, t));
  switch (easing) {
    case 'ease-in':
      return clamped * clamped;
    case 'ease-out':
      return clamped * (2 - clamped);
    case 'ease-in-out':
      return clamped < 0.5 ? 2 * clamped * clamped : -1 + (4 - 2 * clamped) * clamped;
    case 'linear':
    default:
      return clamped;
  }
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  const out: Vec3 = [0, 0, 0];
  lerpVec3Out(out, a, b, t);
  return out;
}

function slerpQuat(a: Quat, b: Quat, t: number): Quat {
  const out: Quat = [0, 0, 0, 1];
  quatSlerpOut(out, a, b, t);
  quatNormalizeOut(out, out);
  return out;
}

function cubicHermiteNumber(p0: number, p1: number, m0: number, m1: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1
  );
}

function cubicHermiteVec3(p0: Vec3, p1: Vec3, m0: Vec3, m1: Vec3, t: number): Vec3 {
  return [
    cubicHermiteNumber(p0[0] ?? 0, p1[0] ?? 0, m0[0] ?? 0, m1[0] ?? 0, t),
    cubicHermiteNumber(p0[1] ?? 0, p1[1] ?? 0, m0[1] ?? 0, m1[1] ?? 0, t),
    cubicHermiteNumber(p0[2] ?? 0, p1[2] ?? 0, m0[2] ?? 0, m1[2] ?? 0, t),
  ];
}

// For quaternions we fallback to slerp even for cubic to avoid instability.

function getTangent(
  previous: AnimationValue,
  next: AnimationValue,
  valueType: AnimationTrackType
): AnimationValue {
  if (valueType === 'number') {
    return ((next as number) - (previous as number)) as AnimationValue;
  }
  if (valueType === 'vec3') {
    const a = previous as Vec3;
    const b = next as Vec3;
    return [
      (b[0] ?? 0) - (a[0] ?? 0),
      (b[1] ?? 0) - (a[1] ?? 0),
      (b[2] ?? 0) - (a[2] ?? 0),
    ] as AnimationValue;
  }
  const qa = previous as Quat;
  const qb = next as Quat;
  const out = quat.create();
  quat.multiply(out, qb as unknown as quat, quat.conjugate(quat.create(), qa as unknown as quat));
  return out as unknown as Quat;
}

export function interpolate(
  valueType: AnimationTrackType,
  a: AnimationValue,
  b: AnimationValue,
  t: number,
  interpolation: AnimationInterpolation,
  easing?: AnimationEasing,
  tangentA?: AnimationValue,
  tangentB?: AnimationValue
): AnimationValue {
  if (!Number.isFinite(t)) return a;
  if (interpolation === 'step') {
    return a;
  }

  const eased = applyEasing(t, easing);

  if (interpolation === 'linear' || valueType === 'quat') {
    switch (valueType) {
      case 'number':
        return lerpNumber(a as number, b as number, eased);
      case 'vec3':
        return lerpVec3(a as Vec3, b as Vec3, eased);
      case 'quat':
        return slerpQuat(a as Quat, b as Quat, eased);
      default:
        return a;
    }
  }

  // Cubic interpolation (Hermite) for scalar / vec3
  if (interpolation === 'cubic') {
    const tangentPrev = tangentA ?? getTangent(a, b, valueType);
    const tangentNext = tangentB ?? getTangent(a, b, valueType);
    const clampedT = applyEasing(t, easing);
    if (valueType === 'number') {
      return cubicHermiteNumber(
        a as number,
        b as number,
        (tangentPrev as number) / 3,
        (tangentNext as number) / 3,
        clampedT
      );
    }
    if (valueType === 'vec3') {
      return cubicHermiteVec3(
        a as Vec3,
        b as Vec3,
        (tangentPrev as Vec3) ?? [0, 0, 0],
        (tangentNext as Vec3) ?? [0, 0, 0],
        clampedT
      );
    }
    // Quaternion fallback to slerp for stability
    return slerpQuat(a as Quat, b as Quat, clampedT);
  }

  return a;
}
