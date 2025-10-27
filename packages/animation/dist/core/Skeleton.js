export function createSkeleton(joints, parents, inverseBindMatrices) {
    const jointCount = joints.length;
    if (parents.length !== jointCount) {
        throw new Error(`parents length (${parents.length}) must equal joints length (${jointCount})`);
    }
    if (inverseBindMatrices.length !== jointCount * 16) {
        throw new Error(`inverseBindMatrices length (${inverseBindMatrices.length}) must be jointCount * 16 (${jointCount * 16})`);
    }
    // Validate parent indices
    for (let i = 0; i < jointCount; i++) {
        const p = parents[i];
        if (p === -1)
            continue; // root
        if (!(p >= 0 && p < jointCount)) {
            throw new RangeError(`parents[${i}] = ${p} is out of range [0, ${jointCount - 1}] or -1`);
        }
    }
    return { joints, parents, inverseBindMatrices, jointCount };
}
export function getInverseBindMatrix(out, skeleton, jointIndex) {
    const { jointCount, inverseBindMatrices } = skeleton;
    if (!(jointIndex >= 0 && jointIndex < jointCount)) {
        throw new RangeError(`jointIndex ${jointIndex} out of range [0, ${jointCount - 1}]`);
    }
    const offset = jointIndex * 16;
    for (let i = 0; i < 16; i++)
        out[i] = inverseBindMatrices[offset + i];
    return out;
}
//# sourceMappingURL=Skeleton.js.map