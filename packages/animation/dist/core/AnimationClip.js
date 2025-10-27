export function createClip(name, tracks) {
    let duration = 0;
    for (const t of tracks) {
        validateTrack(t);
        const lastTime = t.times.length ? t.times[t.times.length - 1] : 0;
        if (lastTime > duration)
            duration = lastTime;
    }
    return { name, duration, tracks };
}
export function validateTrack(track) {
    const { times, values } = track;
    if (track.jointIndex < 0)
        throw new RangeError('jointIndex must be >= 0');
    if (!(times.length > 0))
        throw new Error('track must have at least one keyframe');
    // Monotonic times
    for (let i = 1; i < times.length; i++) {
        if (!(times[i] >= times[i - 1]))
            throw new Error('keyframe times must be non-decreasing');
    }
    let stride = 3;
    if (track.kind === 'rotation')
        stride = 4;
    if (values.length !== times.length * stride) {
        throw new Error(`values length ${values.length} must be times.length * ${stride}`);
    }
}
//# sourceMappingURL=AnimationClip.js.map