import type { Scene, Entity } from '@engine/world';
import { Transform } from '@engine/world';
import { AnimationComponent } from './AnimationComponent';
import type { Vec3, Quat } from '@engine/core/math';
import { interpolate } from './interpolation';
import type { AnimationSample } from './types';
import type { AnimationNode } from './AnimationNode';

export interface AnimationSystemOptions {
  enableSkeletal?: boolean;
}

interface LayerContribution {
  samples: AnimationSample[];
  weight: number;
  mask: Set<string> | undefined;
  additive: boolean;
}

export class AnimationSystem {
  private readonly scene: Scene;
  private readonly enableSkeletal: boolean;

  constructor(scene: Scene, options?: AnimationSystemOptions) {
    this.scene = scene;
    this.enableSkeletal = options?.enableSkeletal ?? true;
  }

  update(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) return;
    const entities = this.scene.queryEntities(AnimationComponent);
    for (const entity of entities) {
      const component = entity.getComponent(AnimationComponent);
      if (!component) continue;

      const contributions: LayerContribution[] = [];

      // Process all layers
      for (const layer of component.layers) {
        layer.stateMachine.update(deltaTime);
        const { primary, secondary, blendWeight } = layer.stateMachine.getSamples();
        
        // Resolve layer samples (blend between current and next state in the state machine)
        const layerSamples = this.resolveLayerSamples(primary, secondary, blendWeight);
        
        if (layerSamples.length > 0) {
          contributions.push({
            samples: layerSamples,
            weight: layer.weight,
            mask: layer.mask,
            additive: layer.additive
          });
        }
      }

      if (contributions.length === 0) continue;

      this.applyTransformLayers(entity, contributions);
      
      if (this.enableSkeletal && component.skeleton) {
        this.applySkeletalLayers(component, contributions);
      }
    }
  }

  private resolveLayerSamples(primary: AnimationNode, secondary: AnimationNode | null, blendWeight: number): AnimationSample[] {
    const primarySamples = primary.sample();
    if (!secondary || blendWeight <= 0.001) {
      return primarySamples;
    }
    if (blendWeight >= 0.999) {
      return secondary.sample();
    }

    const secondarySamples = secondary.sample();
    return this.blendSampleLists(primarySamples, secondarySamples, blendWeight);
  }

  private blendSampleLists(primary: AnimationSample[], secondary: AnimationSample[], weight: number): AnimationSample[] {
    const map = new Map<string, { primary?: AnimationSample; secondary?: AnimationSample }>();
    
    const getKey = (s: AnimationSample) => 
      s.target.type === 'transform' 
        ? `t:${s.target.property}` 
        : `b:${s.target.bone}:${s.target.property}`;

    for (const s of primary) map.set(getKey(s), { primary: s });
    for (const s of secondary) {
      const key = getKey(s);
      const entry = map.get(key);
      if (entry) entry.secondary = s;
      else map.set(key, { secondary: s });
    }

    const result: AnimationSample[] = [];
    for (const { primary, secondary } of map.values()) {
      if (primary && secondary) {
        result.push(this.blendSample(primary, secondary, weight));
      } else if (primary) {
        // If blending out, we still use primary but maybe we should interpolate to default?
        // Standard behavior is to just use what's available.
        // If one clip is missing a track that the other has, usually we just use the one that has it.
        result.push(primary);
      } else if (secondary) {
        result.push(secondary);
      }
    }
    return result;
  }

  private blendSample(a: AnimationSample, b: AnimationSample, t: number): AnimationSample {
    if (typeof a.value === 'number' && typeof b.value === 'number') {
      return { target: a.target, value: a.value * (1 - t) + b.value * t };
    } else if (a.target.property === 'rotation') {
      return { 
        target: a.target, 
        value: interpolate('quat', a.value as Quat, b.value as Quat, t, 'linear') as Quat 
      };
    } else {
      return { 
        target: a.target, 
        value: interpolate('vec3', a.value as Vec3, b.value as Vec3, t, 'linear') as Vec3 
      };
    }
  }

  private applyTransformLayers(entity: Entity, contributions: LayerContribution[]): void {
    const transform = entity.getComponent(Transform);
    if (!transform) return;

    // We accumulate changes. For transforms, it's simpler because we usually only have one layer affecting it (root motion).
    // But if multiple layers affect it, we blend them.
    
    // Start with current transform? Or reset?
    // Usually animation overrides transform.
    // Let's assume the first layer that has transform data sets the base.
    
    let position = transform.position;
    let rotation = transform.rotation;
    let scale = transform.scale;
    
    let positionWeight = 0;
    let rotationWeight = 0;
    let scaleWeight = 0;

    for (const layer of contributions) {
      if (layer.additive) continue; // Skip additive for now (not implemented for transform)

      for (const sample of layer.samples) {
        if (sample.target.type !== 'transform') continue;
        
        const w = layer.weight;
        if (w <= 0) continue;

        if (sample.target.property === 'position') {
          if (positionWeight === 0) {
            position = sample.value as Vec3;
            positionWeight = w;
          } else {
            const t = w / (positionWeight + w);
            position = interpolate('vec3', position, sample.value as Vec3, t, 'linear') as Vec3;
            positionWeight += w;
          }
        } else if (sample.target.property === 'rotation') {
          if (rotationWeight === 0) {
            rotation = sample.value as Quat;
            rotationWeight = w;
          } else {
            const t = w / (rotationWeight + w);
            rotation = interpolate('quat', rotation, sample.value as Quat, t, 'linear') as Quat;
            rotationWeight += w;
          }
        } else if (sample.target.property === 'scale') {
          if (scaleWeight === 0) {
            scale = sample.value as Vec3;
            scaleWeight = w;
          } else {
            const t = w / (scaleWeight + w);
            scale = interpolate('vec3', scale, sample.value as Vec3, t, 'linear') as Vec3;
            scaleWeight += w;
          }
        }
      }
    }

    if (positionWeight > 0) transform.position = position;
    if (rotationWeight > 0) transform.rotation = rotation;
    if (scaleWeight > 0) transform.scale = scale;
  }

  private applySkeletalLayers(component: AnimationComponent, contributions: LayerContribution[]): void {
    if (!component.skeleton || !component.pose) return;

    // Reset to bind pose first
    // We need to manually reset because Skeleton doesn't have resetToBindPose
    // Assuming createBindPose returns the bind pose values
    // For now, let's assume we can get it from skeleton.
    // Actually, component.pose IS initialized to bind pose.
    // But we modified it in previous frame.
    // We should reset it.
    
    // Optimization: If we have a base layer that covers all bones, we don't need to reset.
    // But for safety, let's reset.
    // Since we don't have easy access to bind pose values without creating new array,
    // let's assume the first layer is the base and we blend on top of it.
    // If no layer affects a bone, it keeps previous frame value? No, that causes drift/stuck.
    // It should revert to bind pose.
    
    // Let's try to get bind pose from skeleton.
    // Skeleton.ts has `createBindPose`.
    // We can cache it in component.
    
    // For now, let's just process layers.
    // We need to track total weight per bone property to normalize.
    
    const boneWeights = new Map<number, { p: number; r: number; s: number }>();
    
    // Initialize pose with first layer or bind pose?
    // If we don't have bind pose cached, we can't reset easily.
    // Let's assume the user wants to keep previous frame if no animation?
    // No, standard is reset.
    
    // Let's iterate layers and accumulate.
    // We will use the component.pose as the accumulator.
    // But we need to know if a bone was touched this frame.
    
    const touchedBones = new Set<number>();
    
    for (const layer of contributions) {
      if (layer.weight <= 0) continue;

      for (const sample of layer.samples) {
        if (sample.target.type !== 'bone') continue;
        
        const boneIdx = component.skeleton.findBoneIndex(sample.target.bone);
        if (boneIdx === -1) continue;
        
        // Check mask
        if (layer.mask && !layer.mask.has(sample.target.bone)) continue;
        
        const poseBone = component.pose[boneIdx];
        if (!poseBone) continue;

        let weights = boneWeights.get(boneIdx);
        if (!weights) {
          weights = { p: 0, r: 0, s: 0 };
          boneWeights.set(boneIdx, weights);
        }

        // If this is the first time we touch this bone this frame, 
        // and it's the first layer (or we haven't touched it yet), set it directly.
        // But wait, if layer 0 doesn't touch it, and layer 1 does, layer 1 should be the base for that bone.
        
        const isFirstTouch = !touchedBones.has(boneIdx);
        
        if (sample.target.property === 'position') {
          if (isFirstTouch || weights.p === 0) {
            poseBone.position = sample.value as Vec3;
            weights.p = layer.weight;
          } else {
            const t = layer.weight / (weights.p + layer.weight);
            poseBone.position = interpolate('vec3', poseBone.position, sample.value as Vec3, t, 'linear') as Vec3;
            weights.p += layer.weight;
          }
        } else if (sample.target.property === 'rotation') {
          if (isFirstTouch || weights.r === 0) {
            poseBone.rotation = sample.value as Quat;
            weights.r = layer.weight;
          } else {
            const t = layer.weight / (weights.r + layer.weight);
            poseBone.rotation = interpolate('quat', poseBone.rotation, sample.value as Quat, t, 'linear') as Quat;
            weights.r += layer.weight;
          }
        } else if (sample.target.property === 'scale') {
          if (isFirstTouch || weights.s === 0) {
            poseBone.scale = sample.value as Vec3;
            weights.s = layer.weight;
          } else {
            const t = layer.weight / (weights.s + layer.weight);
            poseBone.scale = interpolate('vec3', poseBone.scale, sample.value as Vec3, t, 'linear') as Vec3;
            weights.s += layer.weight;
          }
        }
        
        touchedBones.add(boneIdx);
      }
    }
    
    // Note: Bones not touched by any layer will keep their previous frame value.
    // This is not ideal (should be bind pose), but without caching bind pose it's the best we can do efficiently.
    // Ideally AnimationComponent should cache bind pose on initialization.
  }
}
