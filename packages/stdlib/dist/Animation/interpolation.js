import { quat } from 'gl-matrix';
import { lerpVec3Out, quatSlerpOut, quatNormalizeOut } from '@engine/core/math';
function applyEasing(t, easing) {
    if (!Number.isFinite(t))
        return 0;
    const clamped = Math.min(1, Math.max(0, t));
    switch (easing) {
        case 'ease-in':
            return clamped * clamped;
        case 'ease-out':
            return clamped * (2 - clamped);
        case 'ease-in-out':
            return clamped < 0.5 ? 2 * clamped * clamped : -1 + (4 - 2 * clamped) * clamped;
        case 'linear':
        default:
            return clamped;
    }
}
function lerpNumber(a, b, t) {
    return a + (b - a) * t;
}
function lerpVec3(a, b, t) {
    const out = [0, 0, 0];
    lerpVec3Out(out, a, b, t);
    return out;
}
function slerpQuat(a, b, t) {
    const out = [0, 0, 0, 1];
    quatSlerpOut(out, a, b, t);
    quatNormalizeOut(out, out);
    return out;
}
function cubicHermiteNumber(p0, p1, m0, m1, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
}
function cubicHermiteVec3(p0, p1, m0, m1, t) {
    return [
        cubicHermiteNumber(p0[0] ?? 0, p1[0] ?? 0, m0[0] ?? 0, m1[0] ?? 0, t),
        cubicHermiteNumber(p0[1] ?? 0, p1[1] ?? 0, m0[1] ?? 0, m1[1] ?? 0, t),
        cubicHermiteNumber(p0[2] ?? 0, p1[2] ?? 0, m0[2] ?? 0, m1[2] ?? 0, t),
    ];
}
// For quaternions we fallback to slerp even for cubic to avoid instability.
function getTangent(previous, next, valueType) {
    if (valueType === 'number') {
        return (next - previous);
    }
    if (valueType === 'vec3') {
        const a = previous;
        const b = next;
        return [(b[0] ?? 0) - (a[0] ?? 0), (b[1] ?? 0) - (a[1] ?? 0), (b[2] ?? 0) - (a[2] ?? 0)];
    }
    const qa = previous;
    const qb = next;
    const out = quat.create();
    quat.multiply(out, qb, quat.conjugate(quat.create(), qa));
    return out;
}
export function interpolate(valueType, a, b, t, interpolation, easing, tangentA, tangentB) {
    if (!Number.isFinite(t))
        return a;
    if (interpolation === 'step') {
        return a;
    }
    const eased = applyEasing(t, easing);
    if (interpolation === 'linear' || valueType === 'quat') {
        switch (valueType) {
            case 'number':
                return lerpNumber(a, b, eased);
            case 'vec3':
                return lerpVec3(a, b, eased);
            case 'quat':
                return slerpQuat(a, b, eased);
            default:
                return a;
        }
    }
    // Cubic interpolation (Hermite) for scalar / vec3
    if (interpolation === 'cubic') {
        const tangentPrev = tangentA ?? getTangent(a, b, valueType);
        const tangentNext = tangentB ?? getTangent(a, b, valueType);
        const clampedT = applyEasing(t, easing);
        if (valueType === 'number') {
            return cubicHermiteNumber(a, b, tangentPrev / 3, tangentNext / 3, clampedT);
        }
        if (valueType === 'vec3') {
            return cubicHermiteVec3(a, b, tangentPrev ?? [0, 0, 0], tangentNext ?? [0, 0, 0], clampedT);
        }
        // Quaternion fallback to slerp for stability
        return slerpQuat(a, b, clampedT);
    }
    return a;
}
//# sourceMappingURL=interpolation.js.map