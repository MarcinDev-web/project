import { signal } from '@preact/signals-core';
import type { AnimationNode } from './AnimationNode';
import type { AnimationSample } from './types';
import { interpolate } from './interpolation';
import type { AnimationStateMachine } from './AnimationStateMachine';

export interface BlendTree1DChild {
  threshold: number;
  node: AnimationNode;
}

export interface BlendTree1DOptions {
  parameter: string;
  children: BlendTree1DChild[];
  stateMachine: AnimationStateMachine; // Needed to access parameter values
  sync?: boolean; // Whether to sync normalized time across children (default: true)
}

export class BlendTree1D implements AnimationNode {
  private children: BlendTree1DChild[];
  private parameter: string;
  private stateMachine: AnimationStateMachine;
  private sync: boolean;
  private playing = signal(true);

  // We track our own normalized time to sync children
  private normalizedTime = 0;
  private duration = 0;

  constructor(options: BlendTree1DOptions) {
    this.parameter = options.parameter;
    this.stateMachine = options.stateMachine;
    this.sync = options.sync ?? true;

    // Sort children by threshold
    this.children = [...options.children].sort((a, b) => a.threshold - b.threshold);

    if (this.children.length === 0) {
      throw new Error('BlendTree1D must have at least one child');
    }

    this.updateDuration();
  }

  update(deltaTime: number): void {
    if (!this.playing.value) return;

    const paramValue = this.stateMachine.getParam(this.parameter);
    const value = typeof paramValue === 'number' ? paramValue : 0;

    // Calculate weights and find active children
    const weights = this.calculateWeights(value);

    // Calculate effective duration based on weights
    this.updateDuration();

    // Advance time
    // We advance normalized time based on the effective duration
    if (this.duration > 0) {
      this.normalizedTime += deltaTime / this.duration;
      if (this.normalizedTime > 1) {
        this.normalizedTime %= 1;
      }
    }

    // Update children
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i]!;
      const weight = weights[i]!;

      if (weight > 0 || !this.sync) {
        if (this.sync) {
          child.node.setNormalizedTime(this.normalizedTime);
        } else {
          child.node.update(deltaTime);
        }
      }
    }
  }

  sample(): AnimationSample[] {
    const paramValue = this.stateMachine.getParam(this.parameter);
    const value = typeof paramValue === 'number' ? paramValue : 0;
    const weights = this.calculateWeights(value);

    // Collect samples from all active children
    const samplesByTarget = new Map<string, { sample: AnimationSample; weight: number }[]>();

    for (let i = 0; i < this.children.length; i++) {
      const weight = weights[i]!;
      if (weight <= 0.001) continue;

      const childSamples = this.children[i]!.node.sample();
      for (const sample of childSamples) {
        const key = this.getSampleKey(sample);
        if (!samplesByTarget.has(key)) {
          samplesByTarget.set(key, []);
        }
        samplesByTarget.get(key)!.push({ sample, weight });
      }
    }

    // Blend samples
    const result: AnimationSample[] = [];
    for (const [, /* _targetKey */ contributions] of samplesByTarget) {
      if (contributions.length === 0) continue;

      // If only one contribution, use it directly
      if (contributions.length === 1) {
        result.push(contributions[0]!.sample);
        continue;
      }

      // Blend multiple contributions
      const blended = this.blendSamples(contributions);
      if (blended) {
        result.push(blended);
      }
    }

    return result;
  }

  play(): void {
    this.playing.value = true;
    for (const child of this.children) {
      child.node.play();
    }
  }

  pause(): void {
    this.playing.value = false;
    for (const child of this.children) {
      child.node.pause();
    }
  }

  stop(): void {
    this.playing.value = false;
    this.normalizedTime = 0;
    for (const child of this.children) {
      child.node.stop();
    }
  }

  getDuration(): number {
    return this.duration;
  }

  getNormalizedTime(): number {
    return this.normalizedTime;
  }

  setNormalizedTime(time: number): void {
    this.normalizedTime = time;
    if (this.sync) {
      for (const child of this.children) {
        child.node.setNormalizedTime(time);
      }
    }
  }

  getWeight(): number {
    return 1.0; // BlendTree itself has weight 1, internal blending handles children
  }

  private updateDuration(): void {
    const paramValue = this.stateMachine.getParam(this.parameter);
    const value = typeof paramValue === 'number' ? paramValue : 0;
    const weights = this.calculateWeights(value);

    let weightedDuration = 0;
    let totalWeight = 0;

    for (let i = 0; i < this.children.length; i++) {
      const w = weights[i]!;
      if (w > 0) {
        weightedDuration += this.children[i]!.node.getDuration() * w;
        totalWeight += w;
      }
    }

    this.duration = totalWeight > 0 ? weightedDuration / totalWeight : 1.0;
  }

  private calculateWeights(value: number): number[] {
    const weights: number[] = Array.from({ length: this.children.length }, () => 0);

    if (this.children.length === 0) return weights;
    if (this.children.length === 1) {
      weights[0] = 1;
      return weights;
    }

    // Find range
    for (let i = 0; i < this.children.length - 1; i++) {
      const a = this.children[i]!;
      const b = this.children[i + 1]!;

      if (value >= a.threshold && value <= b.threshold) {
        const range = b.threshold - a.threshold;
        const t = range > 0 ? (value - a.threshold) / range : 0;
        weights[i] = 1 - t;
        weights[i + 1] = t;
        return weights;
      }
    }

    // Out of bounds
    if (value < this.children[0]!.threshold) {
      weights[0] = 1;
    } else {
      weights[weights.length - 1] = 1;
    }

    return weights;
  }

  private getSampleKey(sample: AnimationSample): string {
    if (sample.target.type === 'transform') {
      return `transform:${sample.target.property}`;
    } else {
      return `bone:${sample.target.bone}:${sample.target.property}`;
    }
  }

  private blendSamples(
    contributions: { sample: AnimationSample; weight: number }[]
  ): AnimationSample | null {
    const first = contributions[0]!.sample;
    const type = typeof first.value;

    if (type === 'number') {
      let value = 0;
      let totalWeight = 0;
      for (const { sample, weight } of contributions) {
        value += (sample.value as number) * weight;
        totalWeight += weight;
      }
      return {
        target: first.target,
        value: totalWeight > 0 ? value / totalWeight : value,
      };
    } else {
      // Vec3 or Quat
      // Simple linear blend for now
      // For Quat we should use slerp but for multi-blend linear is approximation
      // Or we can do iterative interpolation

      let result = contributions[0]!.sample.value;
      let currentWeight = contributions[0]!.weight;

      for (let i = 1; i < contributions.length; i++) {
        const next = contributions[i]!;
        const t = next.weight / (currentWeight + next.weight);

        if (first.target.property === 'rotation') {
          // Quat interpolation - type assertion needed for generic AnimationValue
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
          result = interpolate('quat', result as any, next.sample.value as any, t, 'linear');
        } else {
          // Vec3 interpolation - type assertion needed for generic AnimationValue
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
          result = interpolate('vec3', result as any, next.sample.value as any, t, 'linear');
        }
        currentWeight += next.weight;
      }

      return {
        target: first.target,
        value: result,
      };
    }
  }
}
