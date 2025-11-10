import { EventBus, type Unsubscribe } from '@engine/core/event/EventBus';
import { quatSlerpOut, type Quat, type Vec3 } from '@engine/core/math';
import { getVec3Pool } from '@engine/core/utils/Vec3Pool';
import type { AvatarJointName, AvatarSkeleton } from './skeleton';

export interface AvatarJointKeyframe {
  readonly position?: Vec3;
  readonly rotation?: Quat;
}

export interface AvatarAnimationKeyframe {
  readonly time: number;
  readonly joints: Partial<Record<AvatarJointName, AvatarJointKeyframe>>;
}

export interface AvatarAnimation {
  readonly name: string;
  readonly length: number;
  readonly loop?: boolean;
  readonly frames: readonly AvatarAnimationKeyframe[];
}

export interface AvatarAnimationFinishedEvent {
  readonly animation: AvatarAnimation;
}

export interface AvatarAnimationStopOptions {
  readonly resetPose?: boolean;
}

interface PreparedJointKeyframe extends AvatarJointKeyframe {
  readonly time: number;
}

type PreparedTrack = {
  readonly joint: AvatarJointName;
  readonly frames: readonly PreparedJointKeyframe[];
};

type SampleResult = {
  position?: Vec3;
  rotation?: Quat;
};

/**
 * Minimal animation player supporting quaternion slerp + vector lerp.
 * 
 * @deprecated Use AnimationComponent from @engine/stdlib/Animation instead.
 * This class is kept for backward compatibility but will be removed in a future version.
 * 
 * Migration guide:
 * - Instead of `new AvatarAnimationPlayer(skeleton)`, use `AnimationComponent` on the entity
 * - Use `avatarAnimationToClip()` to convert AvatarAnimation to AnimationClip
 * - Use `avatarSkeletonToSkeleton()` to convert AvatarSkeleton to Skeleton
 * - See `packages/avatar/src/animation-adapter.ts` and `packages/avatar/src/animation-converter.ts` for helpers
 */
export class AvatarAnimationPlayer {
  private readonly skeleton: AvatarSkeleton;
  private animation: AvatarAnimation | null = null;
  private time = 0;
  private readonly tracks = new Map<AvatarJointName, PreparedTrack>();
  private readonly events = new EventBus();
  private finished = false;

  constructor(skeleton: AvatarSkeleton) {
    this.skeleton = skeleton;
  }

  play(animation: AvatarAnimation, time = 0): void {
    if (!(animation.length > 0)) {
      throw new Error(`Animation "${animation.name}" must have positive length`);
    }
    this.animation = animation;
    this.time = wrapTime(time, animation.length, animation.loop ?? false);
    this.prepareTracks(animation);
    this.sampleAndApply(this.time);
    this.finished = false;
    this.checkForCompletion();
  }

  stop(options: AvatarAnimationStopOptions = {}): void {
    this.animation = null;
    this.tracks.clear();
    this.finished = false;
    this.time = 0;
    if (options.resetPose) {
      this.skeleton.resetPose();
    }
  }

  update(deltaTime: number): void {
    if (!this.animation) {
      return;
    }
    if (!this.animation.loop && this.finished) {
      return;
    }
    this.time = wrapTime(this.time + deltaTime, this.animation.length, this.animation.loop ?? false);
    this.sampleAndApply(this.time);
    this.checkForCompletion();
  }

  onFinished(handler: (event: AvatarAnimationFinishedEvent) => void): Unsubscribe {
    return this.events.on<AvatarAnimationFinishedEvent>('finished', (event) => {
      if (event) {
        handler(event);
      }
    });
  }

  /**
   * Get current animation
   */
  getCurrentAnimation(): AvatarAnimation | null {
    return this.animation;
  }

  onceFinished(handler: (event: AvatarAnimationFinishedEvent) => void): Unsubscribe {
    return this.events.once<AvatarAnimationFinishedEvent>('finished', (event) => {
      if (event) {
        handler(event);
      }
    });
  }

  isFinished(): boolean {
    return this.finished;
  }

  private sampleAndApply(time: number): void {
    const pool = getVec3Pool();
    for (const [jointName, track] of this.tracks.entries()) {
      const sample = sampleTrack(track, time);
      if (sample.position) {
        this.skeleton.setLocalPosition(jointName, sample.position);
        // Release pooled Vec3 after setLocalPosition copies it internally
        pool.release(sample.position);
      }
      if (sample.rotation) {
        this.skeleton.setLocalRotation(jointName, sample.rotation);
      }
    }
  }

  private prepareTracks(animation: AvatarAnimation): void {
    this.tracks.clear();
    const jointMap = new Map<AvatarJointName, PreparedJointKeyframe[]>();
    for (const frame of animation.frames) {
      for (const [name, keyframe] of Object.entries(frame.joints)) {
        if (!keyframe) continue;
        const jointName = name as AvatarJointName;
        let track = jointMap.get(jointName);
        if (!track) {
          track = [];
          jointMap.set(jointName, track);
        }
        const prepared: PreparedJointKeyframe = {
          time: clamp(frame.time, 0, animation.length),
          ...(keyframe.position ? { position: [...keyframe.position] as Vec3 } : {}),
          ...(keyframe.rotation ? { rotation: [...keyframe.rotation] as Quat } : {}),
        };
        track.push(prepared);
      }
    }
    for (const [joint, frames] of jointMap.entries()) {
      if (frames.length === 0) continue;
      frames.sort((a, b) => a.time - b.time);
      this.tracks.set(joint, {
        joint,
        frames,
      });
    }
  }

  private checkForCompletion(): void {
    const animation = this.animation;
    if (!animation || (animation.loop ?? false) || this.finished) {
      return;
    }
    if (!(animation.length > 0)) {
      this.finished = true;
      this.events.emit('finished', { animation });
      return;
    }
    if (this.time >= animation.length) {
      this.finished = true;
      this.events.emit('finished', { animation });
    }
  }
}

/**
 * Samples an animation track at a given time using linear interpolation.
 * 
 * This function handles keyframe interpolation for a single joint's animation track.
 * It supports both position (lerp) and rotation (slerp) interpolation.
 * 
 * Edge cases handled:
 * - No frames: returns empty result (no position/rotation change)
 * - Single frame: returns frame as-is (no interpolation needed)
 * - Time before first frame: returns first frame (clamp to start)
 * - Time after last frame: returns last frame (clamp to end)
 * - Time between frames: interpolates using lerp (position) or slerp (rotation)
 * 
 * Interpolation details:
 * - Position: Linear interpolation (lerp) between prev and next positions
 * - Rotation: Spherical linear interpolation (slerp) between prev and next quaternions
 * - If only one frame has position/rotation, uses that frame's value
 * 
 * @param track - Prepared animation track with sorted keyframes
 * @param time - Time to sample at (in seconds, should be within animation length)
 * @returns Sample result with interpolated position and/or rotation
 * 
 * @example
 * ```typescript
 * const track = { joint: 'Hand.L', frames: [
 *   { time: 0.0, position: [0, 0, 0], rotation: [0, 0, 0, 1] },
 *   { time: 1.0, position: [1, 0, 0], rotation: [0, 0, 0, 1] }
 * ]};
 * const result = sampleTrack(track, 0.5);
 * // result.position ≈ [0.5, 0, 0] (lerped)
 * // result.rotation ≈ [0, 0, 0, 1] (slerped)
 * ```
 */
function sampleTrack(track: PreparedTrack, time: number): SampleResult {
  const { frames } = track;
  if (frames.length === 0) {
    return {};
  }
  if (frames.length === 1) {
    const onlyFrame = frames[0];
    return onlyFrame ? cloneFrame(onlyFrame) : {};
  }
  const nextIndex = frames.findIndex((frame) => frame.time >= time);
  if (nextIndex === -1) {
    const lastFrame = frames[frames.length - 1];
    return lastFrame ? cloneFrame(lastFrame) : {};
  }
  const nextFrame = frames[nextIndex];
  if (!nextFrame) {
    return {};
  }
  if (nextFrame.time === time || nextIndex === 0) {
    return cloneFrame(nextFrame);
  }

  const prevIndex = nextIndex - 1;
  const prev = frames[prevIndex];
  if (!prev) {
    return cloneFrame(nextFrame);
  }
  const next = nextFrame;
  const span = next.time - prev.time;
  const t = span > 1e-5 ? (time - prev.time) / span : 0;

  const result: SampleResult = {};
  const pool = getVec3Pool();
  if (prev.position && next.position) {
    result.position = lerpVec3(prev.position, next.position, t);
  } else if (next.position) {
    const vec = pool.acquire();
    vec[0] = next.position[0];
    vec[1] = next.position[1];
    vec[2] = next.position[2];
    result.position = vec;
  } else if (prev.position) {
    const vec = pool.acquire();
    vec[0] = prev.position[0];
    vec[1] = prev.position[1];
    vec[2] = prev.position[2];
    result.position = vec;
  }

  if (prev.rotation && next.rotation) {
    const out = [...prev.rotation] as Quat;
    quatSlerpOut(out, prev.rotation, next.rotation, t);
    result.rotation = [...out] as Quat;
  } else if (next.rotation) {
    result.rotation = [...next.rotation] as Quat;
  } else if (prev.rotation) {
    result.rotation = [...prev.rotation] as Quat;
  }

  return result;
}

/**
 * Clone a frame's position and rotation.
 * 
 * Returns pooled Vec3 that must be released after use.
 * The caller is responsible for releasing Vec3 back to the pool.
 */
function cloneFrame(frame: PreparedJointKeyframe): SampleResult {
  const result: SampleResult = {};
  if (frame.position) {
    const pool = getVec3Pool();
    const vec = pool.acquire();
    vec[0] = frame.position[0];
    vec[1] = frame.position[1];
    vec[2] = frame.position[2];
    result.position = vec;
  }
  if (frame.rotation) {
    result.rotation = [...frame.rotation] as Quat;
  }
  return result;
}

/**
 * Linear interpolation between two Vec3 values.
 * 
 * Returns a pooled Vec3 that must be released after use.
 * The caller is responsible for releasing the Vec3 back to the pool.
 */
function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  const pool = getVec3Pool();
  const out = pool.acquire();
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function wrapTime(time: number, length: number, loop: boolean): number {
  if (!loop) {
    return clamp(time, 0, length);
  }
  const wrapped = time % length;
  return wrapped < 0 ? wrapped + length : wrapped;
}
