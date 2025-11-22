import { createSkeleton, type Skeleton, type Joint } from '@engine/animation';
import { mat4Invert, type Mat4 } from '@engine/core/math';
import type { AvatarSkeleton } from './skeleton';

/**
 * Converts AvatarSkeleton to generic Skeleton format for AnimationComponent.
 * 
 * AvatarSkeleton uses AvatarJointName types and has a different structure,
 * while AnimationComponent's Skeleton uses generic string bone names.
 * 
 * @param avatarSkeleton - AvatarSkeleton to convert
 * @returns Skeleton compatible with AnimationComponent
 */
export function avatarSkeletonToSkeleton(avatarSkeleton: AvatarSkeleton): Skeleton {
  const jointNames = avatarSkeleton.getJointNames();
  const jointCount = jointNames.length;
  
  const joints: Joint[] = [];
  const parents = new Int16Array(jointCount);
  const inverseBindMatrices = new Float32Array(jointCount * 16);
  
  // Reset skeleton to bind pose to ensure we capture bind matrices
  avatarSkeleton.resetPose();

  // Temporary matrix for inversion
  const invMatrix = new Float32Array(16) as unknown as Mat4;

  for (let i = 0; i < jointCount; i++) {
    const jointName = jointNames[i]!;
    const parentName = avatarSkeleton.getParent(jointName);
    
    // Find parent index
    let parentIndex = -1;
    if (parentName) {
      parentIndex = jointNames.indexOf(parentName);
    }
    parents[i] = parentIndex;
    
    joints.push({
      name: jointName,
    });

    // Calculate Inverse Bind Matrix
    // We assume the AvatarSkeleton is currently in its bind pose
    const worldMatrix = avatarSkeleton.getWorldMatrix(jointName);
    
    // Invert world matrix
    mat4Invert(invMatrix, worldMatrix);
    
    // Copy to flat array
    inverseBindMatrices.set(invMatrix, i * 16);
  }

  return createSkeleton(joints, parents, inverseBindMatrices);
}

