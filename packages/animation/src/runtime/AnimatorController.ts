import type { AnimationClip } from '../core/AnimationClip';

export type AnimatorParameterMap = Record<string, number | boolean>;

export type AnimatorState = {
  name: string;
  clip: AnimationClip;
  speed: number; // playback speed multiplier
};

export type AnimatorTransition = {
  from: string;
  to: string;
  duration: number; // crossfade duration (seconds)
  condition?: (params: AnimatorParameterMap) => boolean;
};

export class AnimatorController {
  private readonly states = new Map<string, AnimatorState>();
  private readonly transitions: AnimatorTransition[] = [];
  private _defaultState: string | null = null;

  addState(name: string, clip: AnimationClip, speed = 1): this {
    if (this.states.has(name)) throw new Error(`State '${name}' already exists`);
    this.states.set(name, { name, clip, speed });
    if (!this._defaultState) this._defaultState = name;
    return this;
  }

  addTransition(t: AnimatorTransition): this {
    if (!this.states.has(t.from) || !this.states.has(t.to)) {
      throw new Error(`Transition from '${t.from}' to '${t.to}' requires existing states`);
    }
    if (!(t.duration >= 0)) throw new RangeError('Transition duration must be >= 0');
    this.transitions.push({ ...t });
    return this;
  }

  get defaultState(): string {
    if (!this._defaultState) throw new Error('No default state configured');
    return this._defaultState;
  }

  setDefaultState(name: string): this {
    if (!this.states.has(name)) throw new Error(`Unknown state '${name}'`);
    this._defaultState = name;
    return this;
  }

  getState(name: string): AnimatorState {
    const s = this.states.get(name);
    if (!s) throw new Error(`Unknown state '${name}'`);
    return s;
  }

  getTransitionsFrom(name: string): AnimatorTransition[] {
    return this.transitions.filter(t => t.from === name);
  }
}


