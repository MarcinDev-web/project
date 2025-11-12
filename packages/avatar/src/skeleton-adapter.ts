import { Skeleton, type Bone } from '@engine/stdlib/Animation';
import { getVec3Pool } from '@engine/core/utils/Vec3Pool';
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
  const bones: Bone[] = [];
  const jointNames = avatarSkeleton.getJointNames();
  const pool = getVec3Pool();

  for (const jointName of jointNames) {
    const parentName = avatarSkeleton.getParent(jointName);
    const localTransform = avatarSkeleton.getLocalTransform(jointName);
    
    // Find parent index
    let parentIndex = -1;
    if (parentName) {
      const parentIdx = jointNames.indexOf(parentName);
      if (parentIdx !== -1) {
        parentIndex = parentIdx;
      }
    }

    bones.push({
      name: jointName,
      parentIndex,
      bindPosition: [...localTransform.position],
      bindRotation: [...localTransform.rotation],
      bindScale: [1, 1, 1], // AvatarSkeleton doesn't use scale, default to [1,1,1]
    });
    
    // Release pooled Vec3 after cloning
    pool.release(localTransform.position);
  }

  return new Skeleton(bones);
}

