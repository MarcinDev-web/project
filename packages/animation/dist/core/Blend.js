import { quatSlerpOut } from '@engine/core';
const TMP_QA = new Float32Array(4);
const TMP_QB = new Float32Array(4);
export function blendPoseLinear(out, a, b, weight, jointMask) {
    if (a.jointCount !== b.jointCount || out.jointCount !== a.jointCount) {
        throw new Error('blendPoseLinear: jointCount mismatch');
    }
    const jc = a.jointCount;
    const w = Math.min(1, Math.max(0, weight));
    const tA = a.localTranslations;
    const rA = a.localRotations;
    const sA = a.localScales;
    const tB = b.localTranslations;
    const rB = b.localRotations;
    const sB = b.localScales;
    const tO = out.localTranslations;
    const rO = out.localRotations;
    const sO = out.localScales;
    for (let i = 0; i < jc; i++) {
        const jw = jointMask ? Math.min(1, Math.max(0, jointMask[i])) * w : w;
        const t1 = 1 - jw;
        // translation
        const to = i * 3;
        tO[to + 0] = tA[to + 0] * t1 + tB[to + 0] * jw;
        tO[to + 1] = tA[to + 1] * t1 + tB[to + 1] * jw;
        tO[to + 2] = tA[to + 2] * t1 + tB[to + 2] * jw;
        // scale
        sO[to + 0] = sA[to + 0] * t1 + sB[to + 0] * jw;
        sO[to + 1] = sA[to + 1] * t1 + sB[to + 1] * jw;
        sO[to + 2] = sA[to + 2] * t1 + sB[to + 2] * jw;
        // rotation
        const ro = i * 4;
        TMP_QA[0] = rA[ro + 0];
        TMP_QA[1] = rA[ro + 1];
        TMP_QA[2] = rA[ro + 2];
        TMP_QA[3] = rA[ro + 3];
        TMP_QB[0] = rB[ro + 0];
        TMP_QB[1] = rB[ro + 1];
        TMP_QB[2] = rB[ro + 2];
        TMP_QB[3] = rB[ro + 3];
        quatSlerpOut(rO.subarray(ro, ro + 4), TMP_QA, TMP_QB, jw);
    }
}
//# sourceMappingURL=Blend.js.map