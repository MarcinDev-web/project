import { AnimationComponent } from '@engine/stdlib/Animation';
import type { AnimationClip } from '@engine/stdlib/Animation';
import type { AvatarAnimation } from './animation';
import type { AvatarSkeleton } from './skeleton';
/**
 * Converts multiple AvatarAnimation objects to AnimationClip objects.
 *
 * @param animations - Array of AvatarAnimation objects to convert
 * @returns Array of AnimationClip objects
 */
export declare function convertAvatarAnimationsToClips(animations: AvatarAnimation[]): AnimationClip[];
/**
 * Sets up AnimationComponent with avatar skeleton and animations.
 *
 * This function:
 * 1. Converts AvatarSkeleton to Skeleton
 * 2. Converts AvatarAnimation[] to AnimationClip[]
 * 3. Configures AnimationComponent with skeleton and clips
 * 4. Sets up default state machine states for each animation
 *
 * @param component - AnimationComponent to configure
 * @param avatarSkeleton - AvatarSkeleton to use
 * @param animations - Array of AvatarAnimation objects to add
 */
export declare function setupAvatarAnimationComponent(component: AnimationComponent, avatarSkeleton: AvatarSkeleton, animations: AvatarAnimation[]): void;
//# sourceMappingURL=animation-converter.d.ts.map