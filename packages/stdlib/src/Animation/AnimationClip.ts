import type { AnimationClipJSON, AnimationSample, AnimationTrack } from './types';
import { interpolate } from './interpolation';

export class AnimationClip {
  readonly name: string;
  readonly duration: number;
  readonly tracks: AnimationTrack[];

  constructor(options: { name: string; duration: number; tracks?: AnimationTrack[] }) {
    if (!options || typeof options !== 'object') {
      throw new TypeError('AnimationClip options must be an object');
    }
    const { name, duration, tracks = [] } = options;
    if (typeof name !== 'string' || !name.trim()) {
      throw new TypeError('AnimationClip name must be a non-empty string');
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new RangeError('AnimationClip duration must be a finite positive number');
    }
    this.name = name;
    this.duration = duration;
    this.tracks = tracks.map((track) => ({ ...track, keyframes: [...track.keyframes] }));
  }

  sample(time: number): AnimationSample[] {
    if (!Number.isFinite(time)) time = 0;
    const localTime = ((time % this.duration) + this.duration) % this.duration;
    const results: AnimationSample[] = [];

    for (const track of this.tracks) {
      const { keyframes } = track;
      if (!keyframes || keyframes.length === 0) continue;
      if (keyframes.length === 1) {
        results.push({ target: track.target, value: keyframes[0]!.value });
        continue;
      }

      let nextIndex = keyframes.findIndex((frame) => frame.time >= localTime);
      if (nextIndex === -1) {
        nextIndex = keyframes.length - 1;
      }
      const next = keyframes[nextIndex]!;
      if (next.time === localTime) {
        results.push({ target: track.target, value: next.value });
        continue;
      }
      const prevIndex = Math.max(0, nextIndex - 1);
      const prev = keyframes[prevIndex]!;
      const range = next.time - prev.time;
      const t = range > 0 ? (localTime - prev.time) / range : 0;
      const value = interpolate(
        track.valueType,
        prev.value,
        next.value,
        t,
        track.interpolation,
        next.easing
      );
      results.push({ target: track.target, value });
    }

    return results;
  }

  toJSON(): AnimationClipJSON {
    return {
      name: this.name,
      duration: this.duration,
      tracks: this.tracks.map((track) => ({
        id: track.id,
        target: track.target,
        interpolation: track.interpolation,
        valueType: track.valueType,
        keyframes: track.keyframes.map((k) => ({ ...k })),
      })),
    };
  }

  static fromJSON(data: AnimationClipJSON): AnimationClip {
    if (!data || typeof data !== 'object') {
      throw new TypeError('AnimationClip JSON must be an object');
    }
    const { name, duration, tracks } = data;
    if (!Array.isArray(tracks)) {
      throw new TypeError('AnimationClip JSON must include tracks array');
    }
    return new AnimationClip({
      name,
      duration,
      tracks: tracks.map((track) => ({
        ...track,
        keyframes: track.keyframes.map((keyframe) => ({ ...keyframe })),
      })),
    });
  }
}

