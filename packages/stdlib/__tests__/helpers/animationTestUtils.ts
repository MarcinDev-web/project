// Shared helpers for animation-related tests
import { AnimationClip } from '../../src/Animation/AnimationClip';

export interface KeyframeVec3 {
  time: number;
  value: [number, number, number];
}

export function createTestClip(
  name: string,
  keyframes?: KeyframeVec3[],
  duration = 1
): AnimationClip {
  const frames = keyframes ?? [
    { time: 0, value: [0, 0, 0] as [number, number, number] },
    { time: duration, value: [0, 0, 0] as [number, number, number] },
  ];
  const clipDuration = frames.at(-1)?.time ?? duration;

  return new AnimationClip({
    name,
    duration: clipDuration,
    tracks: [
      {
        id: `${name}-pos`,
        target: { type: 'transform', property: 'position' },
        interpolation: 'linear',
        valueType: 'vec3',
        keyframes: frames.map(({ time, value }) => ({ time, value })),
      },
    ],
  });
}
