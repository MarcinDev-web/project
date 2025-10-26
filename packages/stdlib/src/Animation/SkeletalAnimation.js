import { Skeleton } from './Skeleton';
export class SkeletalAnimation {
    skeleton;
    pose;
    constructor(skeleton) {
        this.skeleton = skeleton;
        this.pose = skeleton.createBindPose();
    }
    applySamples(samples) {
        for (const sample of samples) {
            if (sample.target.type !== 'bone')
                continue;
            const index = this.skeleton.findBoneIndex(sample.target.bone);
            if (index === -1)
                continue;
            const bonePose = this.pose[index];
            if (!bonePose)
                continue;
            switch (sample.target.property) {
                case 'position':
                    bonePose.position = [...sample.value];
                    break;
                case 'rotation':
                    bonePose.rotation = [...sample.value];
                    break;
                case 'scale':
                    bonePose.scale = [...sample.value];
                    break;
            }
        }
    }
}
//# sourceMappingURL=SkeletalAnimation.js.map