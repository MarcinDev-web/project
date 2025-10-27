import { Transform } from '@engine/world';
import { AnimationComponent } from './AnimationComponent';
import { interpolate } from './interpolation';
const DEFAULT_WEIGHT = 1;
export class AnimationSystem {
    scene;
    enableSkeletal;
    constructor(scene, options) {
        this.scene = scene;
        this.enableSkeletal = options?.enableSkeletal ?? true;
    }
    update(deltaTime) {
        if (!Number.isFinite(deltaTime) || deltaTime <= 0)
            return;
        const entities = this.scene.queryEntities(AnimationComponent);
        for (const entity of entities) {
            const component = entity.getComponent(AnimationComponent);
            if (!component)
                continue;
            component.stateMachine.update(deltaTime);
            const { primary, secondary, blendWeight } = component.stateMachine.getSamples();
            const primarySamples = primary.sample();
            const secondarySamples = secondary ? secondary.sample() : null;
            this.applyTransformSamples(entity, primarySamples, secondarySamples, blendWeight, primary.weight.value, secondary?.weight.value ?? 0);
            if (this.enableSkeletal && component.skeleton) {
                this.applySkeletalSamples(component, primarySamples, secondarySamples, blendWeight, primary.weight.value, secondary?.weight.value ?? 0);
            }
        }
    }
    applyTransformSamples(entity, primary, secondary, blendWeight, primaryWeight, secondaryWeight) {
        const transform = entity.getComponent(Transform);
        if (!transform)
            return;
        const w = Math.min(1, Math.max(0, Number.isFinite(blendWeight) ? blendWeight : 0));
        const primaryW = this.clampControllerWeight(primaryWeight);
        const secondaryW = this.clampControllerWeight(secondaryWeight);
        const { aWeight, bWeight } = this.resolveControllerWeights(primaryW, secondaryW, w);
        const primaryMap = {};
        for (const sample of primary) {
            if (sample.target.type !== 'transform')
                continue;
            if (sample.target.property === 'position')
                primaryMap.position = sample.value;
            if (sample.target.property === 'rotation')
                primaryMap.rotation = sample.value;
            if (sample.target.property === 'scale')
                primaryMap.scale = sample.value;
        }
        const secondaryMap = {};
        if (secondary && w > 0) {
            for (const sample of secondary) {
                if (sample.target.type !== 'transform')
                    continue;
                if (sample.target.property === 'position')
                    secondaryMap.position = sample.value;
                if (sample.target.property === 'rotation')
                    secondaryMap.rotation = sample.value;
                if (sample.target.property === 'scale')
                    secondaryMap.scale = sample.value;
            }
        }
        // Resolve final values per property using weighted blend when both are present
        const resolveVec3 = (a, b) => {
            if (a && b && w > 0) {
                return this.interpolateWeightedVec3(a, b, aWeight, bWeight);
            }
            return b && w > 0 && !a ? b : a ?? b;
        };
        const resolveQuat = (a, b) => {
            if (a && b && w > 0) {
                return this.interpolateWeightedQuat(a, b, aWeight, bWeight);
            }
            return b && w > 0 && !a ? b : a ?? b;
        };
        const finalPosition = resolveVec3(primaryMap.position, secondaryMap.position);
        const finalRotation = resolveQuat(primaryMap.rotation, secondaryMap.rotation);
        const finalScale = resolveVec3(primaryMap.scale, secondaryMap.scale);
        if (finalPosition)
            transform.position = finalPosition;
        if (finalRotation)
            transform.rotation = finalRotation;
        if (finalScale)
            transform.scale = finalScale;
    }
    applySkeletalSamples(component, primary, secondary, blendWeight, primaryWeight, secondaryWeight) {
        if (!component.skeleton)
            return;
        if (!component.pose) {
            component.pose = component.skeleton.createBindPose();
        }
        const w = Math.min(1, Math.max(0, Number.isFinite(blendWeight) ? blendWeight : 0));
        const primaryW = this.clampControllerWeight(primaryWeight);
        const secondaryW = this.clampControllerWeight(secondaryWeight);
        const { aWeight, bWeight } = this.resolveControllerWeights(primaryW, secondaryW, w);
        const primaryByBone = new Map();
        for (const sample of primary) {
            if (sample.target.type !== 'bone')
                continue;
            const idx = component.skeleton.findBoneIndex(sample.target.bone);
            if (idx === -1)
                continue;
            let values = primaryByBone.get(idx);
            if (!values) {
                values = {};
                primaryByBone.set(idx, values);
            }
            if (sample.target.property === 'position')
                values.position = sample.value;
            if (sample.target.property === 'rotation')
                values.rotation = sample.value;
            if (sample.target.property === 'scale')
                values.scale = sample.value;
        }
        const secondaryByBone = new Map();
        if (secondary && w > 0) {
            for (const sample of secondary) {
                if (sample.target.type !== 'bone')
                    continue;
                const idx = component.skeleton.findBoneIndex(sample.target.bone);
                if (idx === -1)
                    continue;
                let values = secondaryByBone.get(idx);
                if (!values) {
                    values = {};
                    secondaryByBone.set(idx, values);
                }
                if (sample.target.property === 'position')
                    values.position = sample.value;
                if (sample.target.property === 'rotation')
                    values.rotation = sample.value;
                if (sample.target.property === 'scale')
                    values.scale = sample.value;
            }
        }
        const resolveVec3 = (a, b) => {
            if (a && b && w > 0) {
                return this.interpolateWeightedVec3(a, b, aWeight, bWeight);
            }
            return b && w > 0 && !a ? b : a ?? b;
        };
        const resolveQuat = (a, b) => {
            if (a && b && w > 0) {
                return this.interpolateWeightedQuat(a, b, aWeight, bWeight);
            }
            return b && w > 0 && !a ? b : a ?? b;
        };
        const allBoneIndices = new Set([
            ...primaryByBone.keys(),
            ...secondaryByBone.keys(),
        ]);
        for (const idx of allBoneIndices) {
            const pose = component.pose[idx];
            if (!pose)
                continue;
            const a = primaryByBone.get(idx) ?? {};
            const b = secondaryByBone.get(idx) ?? {};
            const finalPosition = resolveVec3(a.position, b.position);
            const finalRotation = resolveQuat(a.rotation, b.rotation);
            const finalScale = resolveVec3(a.scale, b.scale);
            if (finalPosition)
                pose.position = finalPosition;
            if (finalRotation)
                pose.rotation = finalRotation;
            if (finalScale)
                pose.scale = finalScale;
        }
    }
    clampControllerWeight(weight) {
        if (!Number.isFinite(weight))
            return DEFAULT_WEIGHT;
        return Math.max(0, weight);
    }
    resolveControllerWeights(primaryWeight, secondaryWeight, blendWeight) {
        if (secondaryWeight <= 0 || blendWeight <= 0) {
            return { aWeight: 1, bWeight: 0 };
        }
        const wPrimary = (1 - blendWeight) * primaryWeight;
        const wSecondary = blendWeight * secondaryWeight;
        const total = wPrimary + wSecondary;
        if (total <= 0) {
            return { aWeight: 1, bWeight: 0 };
        }
        return { aWeight: wPrimary / total, bWeight: wSecondary / total };
    }
    interpolateWeightedVec3(a, b, aWeight, bWeight) {
        const total = aWeight + bWeight;
        if (total <= 0) {
            return interpolate('vec3', a, b, 0.5, 'linear');
        }
        const t = bWeight / total;
        return interpolate('vec3', a, b, t, 'linear');
    }
    interpolateWeightedQuat(a, b, aWeight, bWeight) {
        const total = aWeight + bWeight;
        if (total <= 0) {
            return interpolate('quat', a, b, 0.5, 'linear');
        }
        const t = bWeight / total;
        return interpolate('quat', a, b, t, 'linear');
    }
}
//# sourceMappingURL=AnimationSystem.js.map