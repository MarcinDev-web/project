import { mat4FromQuatTranslationScale, mat4Multiply } from '@engine/core';
export function ensureScratch(jointCount, scratch) {
    if (scratch && scratch.globalMatrices.length >= jointCount * 16 && scratch.computed.length >= jointCount) {
        scratch.computed.fill(0);
        return scratch;
    }
    return {
        globalMatrices: new Float32Array(jointCount * 16),
        computed: new Uint8Array(jointCount),
        tmpMat: new Float32Array(16),
        tmpT: new Float32Array(3),
        tmpR: new Float32Array(4),
        tmpS: new Float32Array(3),
    };
}
/**
 * Computes the joint palette (global * inverseBind) for the provided skeleton and pose.
 * outPalette length must be jointCount * 16 (mat4, column-major).
 */
export function computeJointPalette(outPalette, skeleton, pose, scratch) {
    const jc = skeleton.jointCount;
    if (outPalette.length < jc * 16) {
        throw new Error(`outPalette must have length >= ${jc * 16}`);
    }
    const s = ensureScratch(jc, scratch);
    // Compute global matrices
    for (let i = 0; i < jc; i++) {
        computeGlobalForJoint(i, skeleton, pose, s);
    }
    // Multiply by inverseBind to produce palette
    for (let i = 0; i < jc; i++) {
        const go = i * 16;
        const ibo = i * 16;
        // out = global * inverseBind
        mat4Multiply(outPalette.subarray(go, go + 16), s.globalMatrices.subarray(go, go + 16), skeleton.inverseBindMatrices.subarray(ibo, ibo + 16));
    }
    return outPalette;
}
function computeGlobalForJoint(index, skeleton, pose, s) {
    if (s.computed[index])
        return;
    const parent = skeleton.parents[index];
    // Build local matrix
    const to = index * 3;
    const ro = index * 4;
    s.tmpT[0] = pose.localTranslations[to + 0];
    s.tmpT[1] = pose.localTranslations[to + 1];
    s.tmpT[2] = pose.localTranslations[to + 2];
    s.tmpR[0] = pose.localRotations[ro + 0];
    s.tmpR[1] = pose.localRotations[ro + 1];
    s.tmpR[2] = pose.localRotations[ro + 2];
    s.tmpR[3] = pose.localRotations[ro + 3];
    s.tmpS[0] = pose.localScales[to + 0];
    s.tmpS[1] = pose.localScales[to + 1];
    s.tmpS[2] = pose.localScales[to + 2];
    mat4FromQuatTranslationScale(s.tmpMat, s.tmpR, s.tmpT, s.tmpS);
    const outSlice = s.globalMatrices.subarray(index * 16, index * 16 + 16);
    if (parent === -1) {
        // root
        // copy tmpMat into global
        for (let k = 0; k < 16; k++)
            outSlice[k] = s.tmpMat[k];
    }
    else {
        if (!s.computed[parent])
            computeGlobalForJoint(parent, skeleton, pose, s);
        const parentSlice = s.globalMatrices.subarray(parent * 16, parent * 16 + 16);
        mat4Multiply(outSlice, parentSlice, s.tmpMat);
    }
    s.computed[index] = 1;
}
//# sourceMappingURL=JointPalette.js.map