import type { Interpolation } from './AnimationClip';
import { findInterval } from '../sampling/Samplers';

export type MorphChannel = {
  targetIndex: number; // index into mesh's morph target list
  times: Float32Array; // keyframe times (seconds)
  values: Float32Array; // weights per key (0..1), length = times.length
  interpolation: Interpolation;
};

export type MorphTargetClip = {
  name: string;
  duration: number; // seconds
  channels: MorphChannel[];
  targetCount: number; // total morph targets in the mesh binding
};

export function createMorphClip(name: string, channels: MorphChannel[], targetCount: number): MorphTargetClip {
  let duration = 0;
  for (const ch of channels) {
    if (!(ch.targetIndex >= 0 && ch.targetIndex < targetCount)) {
      throw new RangeError(`channel targetIndex ${ch.targetIndex} out of [0, ${targetCount - 1}]`);
    }
    if (ch.times.length !== ch.values.length) {
      throw new Error('Morph channel times and values length must match');
    }
    const last = ch.times.length ? ch.times[ch.times.length - 1]! : 0;
    if (last > duration) duration = last;
  }
  return { name, duration, channels, targetCount };
}

/**
 * Samples morph weights for all targets at the given time into `outWeights`.
 * `outWeights.length` must equal `clip.targetCount`. Channels not affecting a target leave its weight at 0.
 */
export function sampleMorphWeightsAt(outWeights: Float32Array, clip: MorphTargetClip, time: number): Float32Array {
  if (outWeights.length < clip.targetCount) {
    throw new Error(`outWeights must be length >= ${clip.targetCount}`);
  }
  // zero initialize
  outWeights.fill(0);
  for (const ch of clip.channels) {
    const { idx, t } = findInterval(ch.times, time);
    const w = sampleScalar(ch, idx, t);
    outWeights[ch.targetIndex] = w;
  }
  return outWeights;
}

function sampleScalar(ch: MorphChannel, idx: number, t: number): number {
  if (ch.interpolation === 'step' || t === 0) return ch.values[idx]!;
  const i1 = Math.min(idx + 1, ch.times.length - 1);
  const a = ch.values[idx]!;
  const b = ch.values[i1]!;
  if (ch.interpolation === 'linear' || idx + 1 >= ch.times.length) return a * (1 - t) + b * t;
  // cubic: simple Catmull-Rom on scalar values
  const i0 = Math.max(0, idx - 1);
  const i2 = i1;
  const i3 = Math.min(ch.times.length - 1, idx + 2);
  const p0 = ch.values[i0]!;
  const p1 = ch.values[idx]!;
  const p2 = ch.values[i2]!;
  const p3 = ch.values[i3]!;
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}


