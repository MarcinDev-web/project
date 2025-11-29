/**
 * Optimized Animator with WASM acceleration and temporal coherence hints.
 *
 * Performance improvements over base Animator:
 * - Uses WASM batch sampling when available (single WASM call per pose)
 * - Binary search O(log n) for interval finding (vs O(n) linear)
 * - Temporal coherence hints (O(1) for sequential playback)
 * - Precompiled clip data to avoid per-frame allocations
 */

import type { Pose } from '../core/Pose';
import { createPose } from '../core/Pose';
import { blendPoseLinear } from '../core/Blend';
import type { AnimatorController, AnimatorParameterMap } from './AnimatorController';
import type { AnimationClip } from '../core/AnimationClip';
import {
  sampleTranslationAtWithHint,
  sampleRotationAtWithHint,
  sampleScaleAtWithHint,
} from '../sampling/Samplers';
import {
  isWasmAvailable,
  compileClip,
  createHints,
  resetHints,
  sampleClipWasm,
  blendPosesWasm,
  type CompiledClip,
  type SamplerHints,
} from '../sampling/WasmSampler';

/**
 * Hint state for a single clip (per-track keyframe indices)
 */
interface ClipHintState {
  trackHints: number[]; // Per-track last keyframe index
}

export class AnimatorOptimized {
  private readonly controller: AnimatorController;
  private currentStateName: string;
  private currentTime = 0;
  private readonly params: AnimatorParameterMap = {};

  // Crossfade state
  private fadeActive = false;
  private fadeFromStateName: string | null = null;
  private fadeToStateName: string | null = null;
  private fadeTime = 0;
  private fadeDuration = 0;
  private fadeFromTime = 0;
  private fadeToTime = 0;
  private readonly poseA: Pose;
  private readonly poseB: Pose;

  // Optimization: Precompiled clips for WASM
  private compiledClips = new Map<string, CompiledClip>();
  private clipHints = new Map<string, SamplerHints>();

  // Optimization: JS fallback hints (when WASM unavailable)
  private jsClipHints = new Map<string, ClipHintState>();

  private readonly useWasm: boolean;

  constructor(controller: AnimatorController, jointCount: number) {
    this.controller = controller;
    this.currentStateName = controller.defaultState;
    this.poseA = createPose(jointCount);
    this.poseB = createPose(jointCount);
    this.useWasm = isWasmAvailable();

    // Precompile all clips in the controller
    this.precompileClips();
  }

  /**
   * Precompile all animation clips for faster sampling
   */
  private precompileClips(): void {
    const stateNames = this.controller.getStateNames();
    for (const name of stateNames) {
      const state = this.controller.getState(name);
      if (state?.clip) {
        this.ensureClipCompiled(name, state.clip);
      }
    }
  }

  private ensureClipCompiled(stateName: string, clip: AnimationClip): void {
    if (!this.compiledClips.has(stateName)) {
      if (this.useWasm) {
        const compiled = compileClip(clip);
        this.compiledClips.set(stateName, compiled);
        this.clipHints.set(stateName, createHints(compiled.trackCount));
      } else {
        // JS fallback: track hints per clip
        this.jsClipHints.set(stateName, {
          trackHints: new Array(clip.tracks.length).fill(0),
        });
      }
    }
  }

  get activeClip(): AnimationClip | null {
    const state = this.controller.getState(this.currentStateName);
    return state ? state.clip : null;
  }

  get activeTime(): number {
    return this.currentTime;
  }

  get currentController(): AnimatorController {
    return this.controller;
  }

  get currentState(): string {
    return this.currentStateName;
  }

  setParameter(name: string, value: number | boolean): void {
    this.params[name] = value;
  }

  getParameter(name: string): number | boolean | undefined {
    return this.params[name];
  }

  setState(name: string, resetTime = true): void {
    this.controller.getState(name); // validate exists
    this.currentStateName = name;
    if (resetTime) {
      this.currentTime = 0;
      // Reset hints when animation restarts
      this.resetClipHints(name);
    }
    this.fadeActive = false;
  }

  private resetClipHints(stateName: string): void {
    if (this.useWasm) {
      const hints = this.clipHints.get(stateName);
      if (hints) resetHints(hints);
    } else {
      const jsHints = this.jsClipHints.get(stateName);
      if (jsHints) jsHints.trackHints.fill(0);
    }
  }

  update(deltaSeconds: number): void {
    const dtClamped = Math.max(0, deltaSeconds);

    if (this.fadeActive) {
      const from = this.controller.getState(this.fadeFromStateName!);
      const to = this.controller.getState(this.fadeToStateName!);

      if (from.clip.duration > 0) {
        this.fadeFromTime = (this.fadeFromTime + dtClamped * from.speed) % from.clip.duration;
      }
      if (to.clip.duration > 0) {
        this.fadeToTime = (this.fadeToTime + dtClamped * to.speed) % to.clip.duration;
      }

      this.fadeTime += dtClamped;
      if (this.fadeTime >= this.fadeDuration) {
        this.currentStateName = this.fadeToStateName!;
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
      const prevTime = this.currentTime;
      this.currentTime = (this.currentTime + dt) % clip.duration;

      // Reset hints if we looped
      if (this.currentTime < prevTime) {
        this.resetClipHints(this.currentStateName);
      }
    }

    // Evaluate transitions
    const transitions = this.controller.getTransitionsFrom(this.currentStateName);
    for (const tr of transitions) {
      if (!tr.condition || tr.condition(this.params)) {
        if (tr.duration > 0) {
          this.crossfadeTo(tr.to, tr.duration);
          const from = this.controller.getState(this.fadeFromStateName!);
          const to = this.controller.getState(this.fadeToStateName!);
          this.fadeTime = Math.min(this.fadeDuration, dtClamped);
          if (from.clip.duration > 0) {
            this.fadeFromTime = (this.fadeFromTime + dtClamped * from.speed) % from.clip.duration;
          }
          if (to.clip.duration > 0) {
            this.fadeToTime = (this.fadeToTime + dtClamped * to.speed) % to.clip.duration;
          }
        } else {
          this.setState(tr.to);
        }
        break;
      }
    }
  }

  sample(outPose: Pose): void {
    resetPoseIdentity(outPose);

    if (this.fadeActive) {
      const from = this.controller.getState(this.fadeFromStateName!);
      const to = this.controller.getState(this.fadeToStateName!);

      this.sampleClipOptimized(this.poseA, this.fadeFromStateName!, from.clip, this.fadeFromTime);
      this.sampleClipOptimized(this.poseB, this.fadeToStateName!, to.clip, this.fadeToTime);

      const w = Math.min(1, this.fadeTime / (this.fadeDuration || 1));

      if (this.useWasm) {
        blendPosesWasm(outPose, this.poseA, this.poseB, w);
      } else {
        blendPoseLinear(outPose, this.poseA, this.poseB, w);
      }
    } else {
      const state = this.controller.getState(this.currentStateName);
      this.sampleClipOptimized(outPose, this.currentStateName, state.clip, this.currentTime);
    }
  }

  /**
   * Sample clip using best available method
   */
  private sampleClipOptimized(
    outPose: Pose,
    stateName: string,
    clip: AnimationClip,
    time: number,
  ): void {
    this.ensureClipCompiled(stateName, clip);

    if (this.useWasm) {
      const compiled = this.compiledClips.get(stateName)!;
      const hints = this.clipHints.get(stateName)!;
      sampleClipWasm(compiled, time, hints, outPose);
    } else {
      // JS fallback with hints
      const hintState = this.jsClipHints.get(stateName)!;
      applyClipToPoseWithHints(outPose, clip, time, hintState);
    }
  }

  crossfadeTo(toStateName: string, duration: number): void {
    this.controller.getState(toStateName); // validate
    this.fadeActive = true;
    this.fadeFromStateName = this.currentStateName;
    this.fadeToStateName = toStateName;
    this.fadeDuration = Math.max(0, duration);
    this.fadeTime = 0;
    this.fadeFromTime = this.currentTime;
    this.fadeToTime = 0;

    // Ensure target clip is compiled and hints reset
    const toState = this.controller.getState(toStateName);
    this.ensureClipCompiled(toStateName, toState.clip);
    this.resetClipHints(toStateName);
  }

  /**
   * Get performance stats for debugging
   */
  getStats(): { useWasm: boolean; compiledClips: number } {
    return {
      useWasm: this.useWasm,
      compiledClips: this.compiledClips.size,
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function resetPoseIdentity(pose: Pose): void {
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

const TMP_V3 = new Float32Array(3) as unknown as [number, number, number];
const TMP_V3B = new Float32Array(3) as unknown as [number, number, number];
const TMP_Q4 = new Float32Array(4) as unknown as [number, number, number, number];

function applyClipToPoseWithHints(
  outPose: Pose,
  clip: AnimationClip,
  time: number,
  hintState: ClipHintState,
): void {
  for (let i = 0; i < clip.tracks.length; i++) {
    const track = clip.tracks[i]!;
    const currentHint = hintState.trackHints[i] ?? 0;

    switch (track.kind) {
      case 'translation': {
        const { result, newHint } = sampleTranslationAtWithHint(TMP_V3, track, time, currentHint);
        writeVec3(outPose.localTranslations, track.jointIndex, result);
        hintState.trackHints[i] = newHint;
        break;
      }
      case 'scale': {
        const { result, newHint } = sampleScaleAtWithHint(TMP_V3B, track, time, currentHint);
        writeVec3(outPose.localScales, track.jointIndex, result);
        hintState.trackHints[i] = newHint;
        break;
      }
      case 'rotation': {
        const { result, newHint } = sampleRotationAtWithHint(TMP_Q4, track, time, currentHint);
        writeQuat(outPose.localRotations, track.jointIndex, result);
        hintState.trackHints[i] = newHint;
        break;
      }
    }
  }
}

function writeVec3(dst: Float32Array, jointIndex: number, v: [number, number, number]): void {
  const o = jointIndex * 3;
  dst[o + 0] = v[0];
  dst[o + 1] = v[1];
  dst[o + 2] = v[2];
}

function writeQuat(
  dst: Float32Array,
  jointIndex: number,
  q: [number, number, number, number],
): void {
  const o = jointIndex * 4;
  dst[o + 0] = q[0];
  dst[o + 1] = q[1];
  dst[o + 2] = q[2];
  dst[o + 3] = q[3];
}

