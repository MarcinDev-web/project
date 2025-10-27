export function createPose(jointCount) {
    if (!(jointCount > 0))
        throw new RangeError('jointCount must be > 0');
    const t = new Float32Array(jointCount * 3);
    const r = new Float32Array(jointCount * 4);
    const s = new Float32Array(jointCount * 3);
    // Initialize identity
    for (let i = 0; i < jointCount; i++) {
        const ro = i * 4;
        r[ro + 0] = 0;
        r[ro + 1] = 0;
        r[ro + 2] = 0;
        r[ro + 3] = 1;
        const so = i * 3;
        s[so + 0] = 1;
        s[so + 1] = 1;
        s[so + 2] = 1;
        // translations already zeroed
    }
    return { jointCount, localTranslations: t, localRotations: r, localScales: s };
}
export function clonePose(src) {
    return {
        jointCount: src.jointCount,
        localTranslations: new Float32Array(src.localTranslations),
        localRotations: new Float32Array(src.localRotations),
        localScales: new Float32Array(src.localScales),
    };
}
export function copyPose(dst, src) {
    if (dst.jointCount !== src.jointCount)
        throw new Error('Pose jointCount mismatch');
    dst.localTranslations.set(src.localTranslations);
    dst.localRotations.set(src.localRotations);
    dst.localScales.set(src.localScales);
}
export function getLocalTranslation(out, pose, jointIndex) {
    validateJoint(pose, jointIndex);
    const o = jointIndex * 3;
    out[0] = pose.localTranslations[o + 0];
    out[1] = pose.localTranslations[o + 1];
    out[2] = pose.localTranslations[o + 2];
    return out;
}
export function getLocalRotation(out, pose, jointIndex) {
    validateJoint(pose, jointIndex);
    const o = jointIndex * 4;
    out[0] = pose.localRotations[o + 0];
    out[1] = pose.localRotations[o + 1];
    out[2] = pose.localRotations[o + 2];
    out[3] = pose.localRotations[o + 3];
    return out;
}
export function getLocalScale(out, pose, jointIndex) {
    validateJoint(pose, jointIndex);
    const o = jointIndex * 3;
    out[0] = pose.localScales[o + 0];
    out[1] = pose.localScales[o + 1];
    out[2] = pose.localScales[o + 2];
    return out;
}
export function setLocalTranslation(pose, jointIndex, value) {
    validateJoint(pose, jointIndex);
    const o = jointIndex * 3;
    pose.localTranslations[o + 0] = value[0];
    pose.localTranslations[o + 1] = value[1];
    pose.localTranslations[o + 2] = value[2];
}
export function setLocalRotation(pose, jointIndex, value) {
    validateJoint(pose, jointIndex);
    const o = jointIndex * 4;
    pose.localRotations[o + 0] = value[0];
    pose.localRotations[o + 1] = value[1];
    pose.localRotations[o + 2] = value[2];
    pose.localRotations[o + 3] = value[3];
}
export function setLocalScale(pose, jointIndex, value) {
    validateJoint(pose, jointIndex);
    const o = jointIndex * 3;
    pose.localScales[o + 0] = value[0];
    pose.localScales[o + 1] = value[1];
    pose.localScales[o + 2] = value[2];
}
function validateJoint(pose, jointIndex) {
    if (!(jointIndex >= 0 && jointIndex < pose.jointCount)) {
        throw new RangeError(`jointIndex ${jointIndex} out of range [0, ${pose.jointCount - 1}]`);
    }
}
//# sourceMappingURL=Pose.js.map