import type { Vec3, Quat } from '@engine/core';
import { quatSlerpOut } from '@engine/core';
import type { TranslationTrack, RotationTrack, ScaleTrack } from '../core/AnimationClip';

// ============================================================================
// PUBLIC SAMPLING API
// ============================================================================

export function sampleTranslationAt(out: Vec3, track: TranslationTrack, time: number): Vec3 {
  const { idx, t } = findIntervalBinary(track.times, time);
  if (track.interpolation === 'step' || t === 0) return readVec3(out, track.values, idx);
  if (track.interpolation === 'linear' || idx + 1 >= track.times.length) {
    return lerpVec3(out, track.values, idx, idx + 1, t);
  }
  // cubic (Catmull-Rom)
  const i0 = Math.max(0, idx - 1);
  const i1 = idx;
  const i2 = Math.min(track.times.length - 1, idx + 1);
  const i3 = Math.min(track.times.length - 1, idx + 2);
  return catmullRomVec3(out, track.values, i0, i1, i2, i3, t);
}

export function sampleScaleAt(out: Vec3, track: ScaleTrack, time: number): Vec3 {
  // Same as translation
  return sampleTranslationAt(out, track as unknown as TranslationTrack, time);
}

export function sampleRotationAt(out: Quat, track: RotationTrack, time: number): Quat {
  const { idx, t } = findIntervalBinary(track.times, time);
  if (track.interpolation === 'step' || t === 0) return readQuat(out, track.values, idx);
  // For rotation, use slerp for both linear and cubic modes (squad pending)
  const qa = readQuat(TMP_Q0, track.values, idx);
  const qb = readQuat(TMP_Q1, track.values, Math.min(idx + 1, track.times.length - 1));
  return quatSlerpOut(out, qa, qb, t);
}

// ============================================================================
// OPTIMIZED SAMPLING WITH HINTS (for temporal coherence)
// ============================================================================

/**
 * Sample with hint for temporal coherence.
 * The hint is the last keyframe index from the previous frame.
 * Returns the new hint value to pass to the next call.
 */
export function sampleTranslationAtWithHint(
  out: Vec3,
  track: TranslationTrack,
  time: number,
  hint: number,
): { result: Vec3; newHint: number } {
  const { idx, t } = findIntervalWithHint(track.times, time, hint);
  let result: Vec3;

  if (track.interpolation === 'step' || t === 0) {
    result = readVec3(out, track.values, idx);
  } else if (track.interpolation === 'linear' || idx + 1 >= track.times.length) {
    result = lerpVec3(out, track.values, idx, idx + 1, t);
  } else {
    // cubic (Catmull-Rom)
    const i0 = Math.max(0, idx - 1);
    const i1 = idx;
    const i2 = Math.min(track.times.length - 1, idx + 1);
    const i3 = Math.min(track.times.length - 1, idx + 2);
    result = catmullRomVec3(out, track.values, i0, i1, i2, i3, t);
  }

  return { result, newHint: idx };
}

export function sampleRotationAtWithHint(
  out: Quat,
  track: RotationTrack,
  time: number,
  hint: number,
): { result: Quat; newHint: number } {
  const { idx, t } = findIntervalWithHint(track.times, time, hint);
  let result: Quat;

  if (track.interpolation === 'step' || t === 0) {
    result = readQuat(out, track.values, idx);
  } else {
    const qa = readQuat(TMP_Q0, track.values, idx);
    const qb = readQuat(TMP_Q1, track.values, Math.min(idx + 1, track.times.length - 1));
    result = quatSlerpOut(out, qa, qb, t);
  }

  return { result, newHint: idx };
}

export function sampleScaleAtWithHint(
  out: Vec3,
  track: ScaleTrack,
  time: number,
  hint: number,
): { result: Vec3; newHint: number } {
  return sampleTranslationAtWithHint(out, track as unknown as TranslationTrack, time, hint);
}

// ============================================================================
// INTERVAL FINDING - O(log n) Binary Search
// ============================================================================

const TMP_Q0 = new Float32Array(4) as unknown as Quat;
const TMP_Q1 = new Float32Array(4) as unknown as Quat;

/**
 * Find the interval containing `time` using binary search.
 * Returns { idx, t } where:
 * - idx: keyframe index such that times[idx] <= time < times[idx+1]
 * - t: interpolation factor in [0, 1]
 *
 * Complexity: O(log n)
 */
export function findIntervalBinary(times: Float32Array, time: number): { idx: number; t: number } {
  const n = times.length;
  if (n === 1) return { idx: 0, t: 0 };
  if (time <= times[0]!) return { idx: 0, t: 0 };
  if (time >= times[n - 1]!) return { idx: n - 2, t: 1 };

  // Binary search for interval
  const idx = binarySearchInterval(times, time);
  const t0 = times[idx]!;
  const t1 = times[idx + 1]!;
  const span = t1 - t0;
  const u = span > 0 ? (time - t0) / span : 0;

  return { idx, t: u };
}

/**
 * Find interval with hint for temporal coherence.
 * Most animation playback is sequential, so checking the hint first
 * gives O(1) performance in the common case.
 */
export function findIntervalWithHint(
  times: Float32Array,
  time: number,
  hint: number,
): { idx: number; t: number } {
  const n = times.length;
  if (n === 1) return { idx: 0, t: 0 };
  if (time <= times[0]!) return { idx: 0, t: 0 };
  if (time >= times[n - 1]!) return { idx: n - 2, t: 1 };

  // Clamp hint to valid range
  const hintIdx = Math.min(Math.max(0, hint), n - 2);

  // Check if hint is still valid (most common case for sequential playback)
  const t0 = times[hintIdx]!;
  const t1 = times[hintIdx + 1]!;

  if (time >= t0 && time < t1) {
    // Hint was correct! O(1)
    const span = t1 - t0;
    const u = span > 0 ? (time - t0) / span : 0;
    return { idx: hintIdx, t: u };
  }

  // Check next interval (common for forward playback)
  if (hintIdx + 2 <= n - 1) {
    const t2 = times[hintIdx + 2]!;
    if (time >= t1 && time < t2) {
      const span = t2 - t1;
      const u = span > 0 ? (time - t1) / span : 0;
      return { idx: hintIdx + 1, t: u };
    }
  }

  // Fall back to binary search
  return findIntervalBinary(times, time);
}

/**
 * Binary search to find index i where times[i] <= time < times[i+1]
 * Assumes times is sorted and has at least 2 elements.
 */
function binarySearchInterval(times: Float32Array, time: number): number {
  let lo = 0;
  let hi = times.length - 1;

  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1; // Fast integer division by 2
    if (times[mid]! <= time) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return lo;
}

/**
 * @deprecated Use findIntervalBinary instead. Kept for backwards compatibility.
 */
export function findInterval(times: Float32Array, time: number): { idx: number; t: number } {
  return findIntervalBinary(times, time);
}

// ============================================================================
// VALUE READING HELPERS
// ============================================================================

function readVec3(out: Vec3, values: Float32Array, keyIndex: number): Vec3 {
  const o = keyIndex * 3;
  out[0] = values[o + 0]!;
  out[1] = values[o + 1]!;
  out[2] = values[o + 2]!;
  return out;
}

function lerpVec3(out: Vec3, values: Float32Array, i0: number, i1: number, t: number): Vec3 {
  const o0 = i0 * 3;
  const o1 = i1 * 3;
  const ti = 1 - t;
  out[0] = values[o0 + 0]! * ti + values[o1 + 0]! * t;
  out[1] = values[o0 + 1]! * ti + values[o1 + 1]! * t;
  out[2] = values[o0 + 2]! * ti + values[o1 + 2]! * t;
  return out;
}

function catmullRomVec3(
  out: Vec3,
  values: Float32Array,
  i0: number,
  i1: number,
  i2: number,
  i3: number,
  t: number,
): Vec3 {
  const p0o = i0 * 3;
  const p1o = i1 * 3;
  const p2o = i2 * 3;
  const p3o = i3 * 3;
  const t2 = t * t;
  const t3 = t2 * t;
  for (let c = 0; c < 3; c++) {
    const p0 = values[p0o + c]!;
    const p1 = values[p1o + c]!;
    const p2 = values[p2o + c]!;
    const p3 = values[p3o + c]!;
    out[c] =
      0.5 *
      (2 * p1 +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
  return out;
}

function readQuat(out: Quat, values: Float32Array, keyIndex: number): Quat {
  const o = keyIndex * 4;
  out[0] = values[o + 0]!;
  out[1] = values[o + 1]!;
  out[2] = values[o + 2]!;
  out[3] = values[o + 3]!;
  return out;
}
