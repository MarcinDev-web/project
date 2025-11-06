export type Interpolation = 'step' | 'linear' | 'cubic';

export type TranslationTrack = {
  kind: 'translation';
  jointIndex: number;
  times: Float32Array; // length = keyframeCount
  values: Float32Array; // length = keyframeCount * 3
  interpolation: Interpolation;
};

export type RotationTrack = {
  kind: 'rotation';
  jointIndex: number;
  times: Float32Array; // length = keyframeCount
  values: Float32Array; // length = keyframeCount * 4 (x,y,z,w)
  interpolation: Interpolation;
};

export type ScaleTrack = {
  kind: 'scale';
  jointIndex: number;
  times: Float32Array; // length = keyframeCount
  values: Float32Array; // length = keyframeCount * 3
  interpolation: Interpolation;
};

export type Track = TranslationTrack | RotationTrack | ScaleTrack;

export type AnimationClip = {
  name: string;
  duration: number; // seconds
  tracks: Track[];
};

export function createClip(name: string, tracks: Track[]): AnimationClip {
  let duration = 0;
  for (const t of tracks) {
    validateTrack(t);
    const lastTime = t.times.length ? t.times[t.times.length - 1]! : 0;
    if (lastTime > duration) duration = lastTime;
  }
  return { name, duration, tracks };
}

export function validateTrack(track: Track): void {
  const { times, values } = track as { times: Float32Array; values: Float32Array };
  if (track.jointIndex < 0) throw new RangeError('jointIndex must be >= 0');
  if (!(times.length > 0)) throw new Error('track must have at least one keyframe');
  // Monotonic times
  for (let i = 1; i < times.length; i++) {
    if (!(times[i]! >= times[i - 1]!)) throw new Error('keyframe times must be non-decreasing');
  }
  let stride = 3;
  if (track.kind === 'rotation') stride = 4;
  if (values.length !== times.length * stride) {
    throw new Error(`values length ${values.length} must be times.length * ${stride}`);
  }
}
