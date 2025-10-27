import { createPose } from '../core/Pose';
import { blendPoseLinear } from '../core/Blend';
import { sampleRotationAt, sampleScaleAt, sampleTranslationAt } from '../sampling/Samplers';
export class Animator {
    controller;
    currentStateName;
    currentTime = 0;
    params = {};
    // Crossfade state
    fadeActive = false;
    fadeFromStateName = null;
    fadeToStateName = null;
    fadeTime = 0;
    fadeDuration = 0;
    fadeFromTime = 0;
    fadeToTime = 0;
    poseA;
    poseB;
    constructor(controller, jointCount) {
        this.controller = controller;
        this.currentStateName = controller.defaultState;
        this.poseA = createPose(jointCount);
        this.poseB = createPose(jointCount);
    }
    setParameter(name, value) {
        this.params[name] = value;
    }
    getParameter(name) {
        return this.params[name];
    }
    setState(name, resetTime = true) {
        this.controller.getState(name); // validate exists
        this.currentStateName = name;
        if (resetTime)
            this.currentTime = 0;
        // cancel any ongoing fade
        this.fadeActive = false;
    }
    update(deltaSeconds) {
        const dtClamped = Math.max(0, deltaSeconds);
        if (this.fadeActive) {
            // advance both times
            const from = this.controller.getState(this.fadeFromStateName);
            const to = this.controller.getState(this.fadeToStateName);
            if (from.clip.duration > 0)
                this.fadeFromTime = (this.fadeFromTime + dtClamped * from.speed) % from.clip.duration;
            if (to.clip.duration > 0)
                this.fadeToTime = (this.fadeToTime + dtClamped * to.speed) % to.clip.duration;
            this.fadeTime += dtClamped;
            if (this.fadeTime >= this.fadeDuration) {
                // finalize
                this.currentStateName = this.fadeToStateName;
                this.currentTime = this.fadeToTime % (to.clip.duration || 1);
                this.fadeActive = false;
            }
            return;
        }
        const state = this.controller.getState(this.currentStateName);
        const clip = state.clip;
        const speed = state.speed;
        const dt = dtClamped * speed;
        if (clip.duration > 0) {
            this.currentTime = (this.currentTime + dt) % clip.duration;
        }
        // Evaluate transitions; start crossfade when duration > 0
        const transitions = this.controller.getTransitionsFrom(this.currentStateName);
        for (const tr of transitions) {
            if (!tr.condition || tr.condition(this.params)) {
                if (tr.duration > 0) {
                    this.crossfadeTo(tr.to, tr.duration);
                }
                else {
                    this.setState(tr.to);
                }
                break;
            }
        }
    }
    sample(outPose) {
        // Reset pose to identity per joint (T=0,S=1,R=identity)
        resetPoseIdentity(outPose);
        if (this.fadeActive) {
            const from = this.controller.getState(this.fadeFromStateName);
            const to = this.controller.getState(this.fadeToStateName);
            applyClipToPose(this.poseA, from.clip, this.fadeFromTime);
            applyClipToPose(this.poseB, to.clip, this.fadeToTime);
            const w = Math.min(1, this.fadeTime / (this.fadeDuration || 1));
            blendPoseLinear(outPose, this.poseA, this.poseB, w);
        }
        else {
            const state = this.controller.getState(this.currentStateName);
            applyClipToPose(outPose, state.clip, this.currentTime);
        }
    }
    crossfadeTo(toStateName, duration) {
        this.controller.getState(toStateName); // validate
        this.fadeActive = true;
        this.fadeFromStateName = this.currentStateName;
        this.fadeToStateName = toStateName;
        this.fadeDuration = Math.max(0, duration);
        this.fadeTime = 0;
        this.fadeFromTime = this.currentTime;
        this.fadeToTime = 0;
    }
}
function resetPoseIdentity(pose) {
    const jc = pose.jointCount;
    for (let i = 0; i < jc; i++) {
        const to = i * 3;
        pose.localTranslations[to + 0] = 0;
        pose.localTranslations[to + 1] = 0;
        pose.localTranslations[to + 2] = 0;
        pose.localScales[to + 0] = 1;
        pose.localScales[to + 1] = 1;
        pose.localScales[to + 2] = 1;
        const ro = i * 4;
        pose.localRotations[ro + 0] = 0;
        pose.localRotations[ro + 1] = 0;
        pose.localRotations[ro + 2] = 0;
        pose.localRotations[ro + 3] = 1;
    }
}
function applyClipToPose(outPose, clip, time) {
    const tOut = TMP_V3;
    const sOut = TMP_V3B;
    const rOut = TMP_Q4;
    for (const track of clip.tracks) {
        switch (track.kind) {
            case 'translation':
                sampleTranslationAt(tOut, track, time);
                writeVec3(outPose.localTranslations, track.jointIndex, tOut);
                break;
            case 'scale':
                sampleScaleAt(sOut, track, time);
                writeVec3(outPose.localScales, track.jointIndex, sOut);
                break;
            case 'rotation':
                sampleRotationAt(rOut, track, time);
                writeQuat(outPose.localRotations, track.jointIndex, rOut);
                break;
        }
    }
}
const TMP_V3 = new Float32Array(3);
const TMP_V3B = new Float32Array(3);
const TMP_Q4 = new Float32Array(4);
function writeVec3(dst, jointIndex, v) {
    const o = jointIndex * 3;
    dst[o + 0] = v[0];
    dst[o + 1] = v[1];
    dst[o + 2] = v[2];
}
function writeQuat(dst, jointIndex, q) {
    const o = jointIndex * 4;
    dst[o + 0] = q[0];
    dst[o + 1] = q[1];
    dst[o + 2] = q[2];
    dst[o + 3] = q[3];
}
//# sourceMappingURL=Animator.js.map