import { Skeleton } from '@engine/stdlib/Animation';
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
export declare function avatarSkeletonToSkeleton(avatarSkeleton: AvatarSkeleton): Skeleton;
//# sourceMappingURL=skeleton-adapter.d.ts.map