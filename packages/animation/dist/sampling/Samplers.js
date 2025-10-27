import { quatSlerpOut } from '@engine/core';
export function sampleTranslationAt(out, track, time) {
    const { idx, t } = findInterval(track.times, time);
    if (track.interpolation === 'step' || t === 0)
        return readVec3(out, track.values, idx);
    if (track.interpolation === 'linear' || idx + 1 >= track.times.length) {
        return lerpVec3(out, track.values, idx, idx + 1, t);
    }
    // cubic (Catmull-Rom)
    const i0 = Math.max(0, idx - 1);
    const i1 = idx;
    const i2 = Math.min(track.times.length - 1, idx + 1);
    const i3 = Math.min(track.times.length - 1, idx + 2);
    return catmullRomVec3(out, track.values, i0, i1, i2, i3, t);
}
export function sampleScaleAt(out, track, time) {
    // Same as translation
    return sampleTranslationAt(out, track, time);
}
export function sampleRotationAt(out, track, time) {
    const { idx, t } = findInterval(track.times, time);
    if (track.interpolation === 'step' || t === 0)
        return readQuat(out, track.values, idx);
    // For rotation, use slerp for both linear and cubic modes (squad pending)
    const qa = readQuat(TMP_Q0, track.values, idx);
    const qb = readQuat(TMP_Q1, track.values, Math.min(idx + 1, track.times.length - 1));
    return quatSlerpOut(out, qa, qb, t);
}
// ========= Helpers =========
const TMP_Q0 = new Float32Array(4);
const TMP_Q1 = new Float32Array(4);
export function findInterval(times, time) {
    const n = times.length;
    if (n === 1)
        return { idx: 0, t: 0 };
    if (time <= times[0])
        return { idx: 0, t: 0 };
    if (time >= times[n - 1])
        return { idx: n - 2, t: 1 };
    // Linear search (M1); consider binary search in M2 if needed
    let i = 0;
    for (; i < n - 1; i++) {
        const t0 = times[i];
        const t1 = times[i + 1];
        if (time >= t0 && time <= t1) {
            const span = t1 - t0;
            const u = span > 0 ? (time - t0) / span : 0;
            return { idx: i, t: u };
        }
    }
    return { idx: n - 2, t: 1 };
}
function readVec3(out, values, keyIndex) {
    const o = keyIndex * 3;
    out[0] = values[o + 0];
    out[1] = values[o + 1];
    out[2] = values[o + 2];
    return out;
}
function lerpVec3(out, values, i0, i1, t) {
    const o0 = i0 * 3;
    const o1 = i1 * 3;
    const ti = 1 - t;
    out[0] = values[o0 + 0] * ti + values[o1 + 0] * t;
    out[1] = values[o0 + 1] * ti + values[o1 + 1] * t;
    out[2] = values[o0 + 2] * ti + values[o1 + 2] * t;
    return out;
}
function catmullRomVec3(out, values, i0, i1, i2, i3, t) {
    const p0o = i0 * 3;
    const p1o = i1 * 3;
    const p2o = i2 * 3;
    const p3o = i3 * 3;
    const t2 = t * t;
    const t3 = t2 * t;
    for (let c = 0; c < 3; c++) {
        const p0 = values[p0o + c];
        const p1 = values[p1o + c];
        const p2 = values[p2o + c];
        const p3 = values[p3o + c];
        out[c] = 0.5 * ((2 * p1) +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    return out;
}
function readQuat(out, values, keyIndex) {
    const o = keyIndex * 4;
    out[0] = values[o + 0];
    out[1] = values[o + 1];
    out[2] = values[o + 2];
    out[3] = values[o + 3];
    return out;
}
//# sourceMappingURL=Samplers.js.map