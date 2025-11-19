import { AnimationClip } from '@engine/stdlib/Animation';
import type { AnimationTrack } from '@engine/stdlib/Animation';
import type { Vec3, Quat } from '@engine/core/math';
import type { AvatarAnimation } from './animation';
import type { AvatarJointName } from './skeleton';

/**
 * Converts AvatarAnimation format to AnimationClip format.
 * 
 * AvatarAnimation uses keyframes per joint (all joints in one frame),
 * while AnimationClip uses tracks per property (all keyframes for one property).
 * 
 * @param animation - AvatarAnimation to convert
 * @returns AnimationClip with tracks for each joint property
 */
export function avatarAnimationToClip(animation: AvatarAnimation): AnimationClip {
  if (!(animation.length > 0)) {
    throw new Error(`Animation "${animation.name}" must have positive length`);
  }
  if (animation.frames.length === 0) {
    throw new Error(`Animation "${animation.name}" must have at least one frame`);
  }

  // Group keyframes by joint and property
  const tracksMap = new Map<string, Map<number, { position?: number[]; rotation?: number[]; scale?: number[] }>>();

  // First pass: collect all keyframes
  for (const frame of animation.frames) {
    const time = Math.max(0, Math.min(frame.time, animation.length));
    for (const [jointName, keyframe] of Object.entries(frame.joints)) {
      if (!keyframe) continue;
      const joint = jointName as AvatarJointName;
      
      let jointTracks = tracksMap.get(joint);
      if (!jointTracks) {
        jointTracks = new Map();
        tracksMap.set(joint, jointTracks);
      }

      const frameData = jointTracks.get(time) ?? {};
      if (keyframe.position) {
        frameData.position = [...keyframe.position];
      }
      if (keyframe.rotation) {
        frameData.rotation = [...keyframe.rotation];
      }
      if (keyframe.scale) {
        frameData.scale = [...keyframe.scale];
      }
      jointTracks.set(time, frameData);
    }
  }

  // Second pass: create tracks
  const tracks: AnimationTrack[] = [];

  for (const [jointName, jointTracks] of tracksMap.entries()) {
    // Create position track
    const positionKeyframes: Array<{ time: number; value: number[] }> = [];
    for (const [time, data] of jointTracks.entries()) {
      if (data.position) {
        positionKeyframes.push({ time, value: data.position });
      }
    }
    if (positionKeyframes.length > 0) {
      positionKeyframes.sort((a, b) => a.time - b.time);
      tracks.push({
        id: `${jointName}_position`,
        target: { type: 'bone', bone: jointName, property: 'position' },
        interpolation: 'linear',
        valueType: 'vec3',
        keyframes: positionKeyframes.map((kf) => ({ time: kf.time, value: kf.value as Vec3 })),
      });
    }

    // Create rotation track
    const rotationKeyframes: Array<{ time: number; value: number[] }> = [];
    for (const [time, data] of jointTracks.entries()) {
      if (data.rotation) {
        rotationKeyframes.push({ time, value: data.rotation });
      }
    }
    if (rotationKeyframes.length > 0) {
      rotationKeyframes.sort((a, b) => a.time - b.time);
      tracks.push({
        id: `${jointName}_rotation`,
        target: { type: 'bone', bone: jointName, property: 'rotation' },
        interpolation: 'linear',
        valueType: 'quat',
        keyframes: rotationKeyframes.map((kf) => ({ time: kf.time, value: kf.value as Quat })),
      });
    }

    // Create scale track
    const scaleKeyframes: Array<{ time: number; value: number[] }> = [];
    for (const [time, data] of jointTracks.entries()) {
      if (data.scale) {
        scaleKeyframes.push({ time, value: data.scale });
      }
    }
    if (scaleKeyframes.length > 0) {
      scaleKeyframes.sort((a, b) => a.time - b.time);
      tracks.push({
        id: `${jointName}_scale`,
        target: { type: 'bone', bone: jointName, property: 'scale' },
        interpolation: 'linear',
        valueType: 'vec3',
        keyframes: scaleKeyframes.map((kf) => ({ time: kf.time, value: kf.value as Vec3 })),
      });
    }
  }

  return new AnimationClip({
    name: animation.name,
    duration: animation.length,
    tracks,
  });
}

