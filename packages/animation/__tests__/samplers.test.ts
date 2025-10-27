import { describe, it, expect } from 'vitest';
import { sampleTranslationAt, sampleRotationAt } from '../src/sampling/Samplers';
import type { TranslationTrack, RotationTrack } from '../src/core/AnimationClip';

describe('Samplers', () => {
  it('samples translation linear', () => {
    const track: TranslationTrack = {
      kind: 'translation',
      jointIndex: 0,
      times: new Float32Array([0, 1]),
      values: new Float32Array([0, 0, 0, 1, 0, 0]),
      interpolation: 'linear',
    };
    const out = new Float32Array(3) as unknown as [number, number, number];
    sampleTranslationAt(out, track, 0.5);
    expect(out[0]).toBeCloseTo(0.5);
    expect(out[1]).toBeCloseTo(0);
    expect(out[2]).toBeCloseTo(0);
  });

  it('samples rotation slerp', () => {
    const qIdentity = [0, 0, 0, 1] as [number, number, number, number];
    const q180Y = [0, 1, 0, 0] as [number, number, number, number];
    const track: RotationTrack = {
      kind: 'rotation',
      jointIndex: 0,
      times: new Float32Array([0, 1]),
      values: new Float32Array([...qIdentity, ...q180Y]),
      interpolation: 'linear',
    };
    const out = new Float32Array(4) as unknown as [number, number, number, number];
    sampleRotationAt(out, track, 0.5);
    // Halfway should be around 90 degrees around Y => quaternion ~ [0, ~0.707, 0, ~0.707]
    expect(out[1]).toBeGreaterThan(0.6);
    expect(out[3]).toBeGreaterThan(0.6);
  });
});


