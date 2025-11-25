import { signal, type Signal } from '@preact/signals-core';
import { AnimationClip } from './AnimationClip';
import type { AnimationSample } from './types';
import type { AnimationNode } from './AnimationNode';

export interface AnimationControllerOptions {
  clip: AnimationClip;
  speed?: number;
  weight?: number;
  loop?: boolean;
}

export class AnimationController implements AnimationNode {
  readonly clip: AnimationClip;
  readonly time: Signal<number>;
  readonly playing: Signal<boolean>;
  speed: Signal<number>;
  weight: Signal<number>;
  loop: Signal<boolean>;

  constructor(options: AnimationControllerOptions) {
    if (!options || typeof options !== 'object') {
      throw new TypeError('AnimationController options must be an object');
    }
    this.clip = options.clip;
    this.time = signal(0);
    this.playing = signal(true);
    this.speed = signal(Number.isFinite(options.speed ?? 1) ? (options.speed ?? 1) : 1);
    this.weight = signal(Number.isFinite(options.weight ?? 1) ? (options.weight ?? 1) : 1);
    this.loop = signal(options.loop ?? true);
  }

  play(): void {
    this.playing.value = true;
  }

  pause(): void {
    this.playing.value = false;
  }

  stop(): void {
    this.playing.value = false;
    this.time.value = 0;
  }

  update(deltaTime: number): void {
    if (!this.playing.value) return;
    if (!Number.isFinite(deltaTime)) return;
    const speed = this.speed.value;
    const nextTime = this.time.value + deltaTime * speed;
    if (this.loop.value) {
      this.time.value = ((nextTime % this.clip.duration) + this.clip.duration) % this.clip.duration;
    } else {
      if (nextTime >= this.clip.duration) {
        this.time.value = this.clip.duration;
        this.playing.value = false;
      } else {
        this.time.value = Math.max(0, nextTime);
      }
    }
  }

  sample(): AnimationSample[] {
    return this.clip.sample(this.time.value);
  }

  getDuration(): number {
    return this.clip.duration;
  }

  getNormalizedTime(): number {
    return this.clip.duration > 0 ? this.time.value / this.clip.duration : 0;
  }

  setNormalizedTime(time: number): void {
    this.time.value = time * this.clip.duration;
  }

  getWeight(): number {
    return this.weight.value;
  }
}
