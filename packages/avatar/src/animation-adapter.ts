import { type AnimationClip, createClip, type Track } from '@engine/animation';
import type { AvatarAnimation } from './animation';
import { type AvatarJointName, DEFAULT_AVATAR_JOINTS } from './skeleton';

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

  // Map joint names to indices
  const jointIndices = new Map<string, number>();
  for (let i = 0; i < DEFAULT_AVATAR_JOINTS.length; i++) {
    jointIndices.set(DEFAULT_AVATAR_JOINTS[i]!.name, i);
  }

  // Group keyframes by joint and property
  const tracksMap = new Map<string, Map<number, { position?: number[]; rotation?: number[]; scale?: number[] }>>();

  // First pass: collect all keyframes
  for (const frame of animation.frames) {
    const time = Math.max(0, Math.min(frame.time, animation.length));
    for (const [jointName, keyframe] of Object.entries(frame.joints)) {
      if (!keyframe) continue;
      
      // Only process known joints
      if (!jointIndices.has(jointName)) continue;
      
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
  const tracks: Track[] = [];

  for (const [jointName, jointTracks] of tracksMap.entries()) {
    const jointIndex = jointIndices.get(jointName)!;

    // Create position track
    const posTimes: number[] = [];
    const posValues: number[] = [];
    
    // Sort times
    const sortedTimes = Array.from(jointTracks.keys()).sort((a, b) => a - b);
    
    for (const time of sortedTimes) {
        const data = jointTracks.get(time);
        if (data && data.position) {
            posTimes.push(time);
            posValues.push(...data.position);
        }
    }
    
    if (posTimes.length > 0) {
        tracks.push({
            kind: 'translation',
            jointIndex,
            times: new Float32Array(posTimes),
            values: new Float32Array(posValues),
            interpolation: 'linear'
        });
    }

    // Create rotation track
    const rotTimes: number[] = [];
    const rotValues: number[] = [];
    
    for (const time of sortedTimes) {
        const data = jointTracks.get(time);
        if (data && data.rotation) {
            rotTimes.push(time);
            rotValues.push(...data.rotation);
        }
    }
    
    if (rotTimes.length > 0) {
        tracks.push({
            kind: 'rotation',
            jointIndex,
            times: new Float32Array(rotTimes),
            values: new Float32Array(rotValues),
            interpolation: 'linear'
        });
    }

    // Create scale track
    const sclTimes: number[] = [];
    const sclValues: number[] = [];
    
    for (const time of sortedTimes) {
        const data = jointTracks.get(time);
        if (data && data.scale) {
            sclTimes.push(time);
            sclValues.push(...data.scale);
        }
    }
    
    if (sclTimes.length > 0) {
        tracks.push({
            kind: 'scale',
            jointIndex,
            times: new Float32Array(sclTimes),
            values: new Float32Array(sclValues),
            interpolation: 'linear'
        });
    }
  }

  return createClip(animation.name, tracks);
}

