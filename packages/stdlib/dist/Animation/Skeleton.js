export class Skeleton {
    bones;
    constructor(bones) {
        if (!Array.isArray(bones) || bones.length === 0) {
            throw new TypeError('Skeleton must created with non-empty bone array');
        }
        this.bones = bones.map((bone) => ({
            ...bone,
            bindPosition: [...bone.bindPosition],
            bindRotation: [...bone.bindRotation],
            bindScale: [...bone.bindScale],
        }));
    }
    findBoneIndex(name) {
        return this.bones.findIndex((bone) => bone.name === name);
    }
    createBindPose() {
        return this.bones.map((bone) => ({
            position: [...bone.bindPosition],
            rotation: [...bone.bindRotation],
            scale: [...bone.bindScale],
        }));
    }
}
//# sourceMappingURL=Skeleton.js.map