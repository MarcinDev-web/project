import { AnimationStateMachine } from './AnimationStateMachine';

export class AnimationLayer {
  name: string;
  stateMachine: AnimationStateMachine;
  mask: Set<string> | undefined; // Bone names to apply animation to
  weight: number = 1.0;
  additive: boolean = false; // If true, add to previous layers instead of override

  constructor(name: string) {
    this.name = name;
    this.stateMachine = new AnimationStateMachine();
  }

  setMask(boneNames: string[]): void {
    this.mask = new Set(boneNames);
  }

  clearMask(): void {
    this.mask = undefined;
  }
}

