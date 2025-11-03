import type { Scene } from '../core/Scene.js';
import { AnimatorComponent } from '../components/AnimatorComponent.js';
import { SkeletalBindingComponent } from '../components/SkeletalBindingComponent.js';
import { MorphBindingComponent } from '../components/MorphBindingComponent.js';
// Animator and functions are exported via export * from their modules in animation package
// Import from main package export (subpath imports not supported)
import { Animator, computeJointPalette, sampleMorphWeightsAt } from '@engine/animation';

export class AnimationSystem {
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  update(deltaSeconds: number): void {
    if (!(deltaSeconds > 0)) return;
    const entities = this.scene.queryEntities(AnimatorComponent);
    for (const entity of entities) {
      const anim = entity.getComponent(AnimatorComponent);
      if (!anim) continue;
      if (!anim.skeleton || !anim.pose || !anim.controller) continue;

      // Lazily create animator instance
      if (!anim.animator) {
        anim.animator = new Animator(anim.controller, anim.skeleton.jointCount);
      }

      anim.animator.update(deltaSeconds);
      anim.animator.sample(anim.pose);

      // Update skeletal binding if present
      const skel = entity.getComponent(SkeletalBindingComponent);
      if (skel) {
        if (!skel.skeleton) skel.skeleton = anim.skeleton;
        if (!skel.pose) skel.pose = anim.pose;
        const jc = anim.skeleton.jointCount;
        if (!skel.jointPalette || skel.jointPalette.length < jc * 16) {
          skel.jointPalette = new Float32Array(jc * 16);
        }
        computeJointPalette(skel.jointPalette, anim.skeleton, anim.pose);
      }

      // Update morph weights if binding present and clip configured
      const morph = entity.getComponent(MorphBindingComponent);
      if (morph && anim.morphClip) {
        if (!morph.weights || morph.weights.length < anim.morphClip.targetCount) {
          morph.targetCount = anim.morphClip.targetCount;
          morph.weights = new Float32Array(morph.targetCount);
        }
        sampleMorphWeightsAt(morph.weights, anim.morphClip, 0 /* TODO: separate morph timer if needed */);
      }
    }
  }
}


