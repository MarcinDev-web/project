import { AnimationComponent } from '@engine/stdlib/Animation';
import type { AnimationClip } from '@engine/stdlib/Animation';
import { avatarAnimationToClip } from './animation-adapter';
import { avatarSkeletonToSkeleton } from './skeleton-adapter';
import type { AvatarAnimation } from './animation';
import type { AvatarSkeleton } from './skeleton';

/**
 * Converts multiple AvatarAnimation objects to AnimationClip objects.
 * 
 * @param animations - Array of AvatarAnimation objects to convert
 * @returns Array of AnimationClip objects
 */
export function convertAvatarAnimationsToClips(animations: AvatarAnimation[]): AnimationClip[] {
  return animations.map((animation) => avatarAnimationToClip(animation));
}

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
export function setupAvatarAnimationComponent(
  component: AnimationComponent,
  avatarSkeleton: AvatarSkeleton,
  animations: AvatarAnimation[]
): void {
  // Convert skeleton
  const skeleton = avatarSkeletonToSkeleton(avatarSkeleton);
  component.setSkeleton(skeleton);

  // Convert and add animations
  const clips = convertAvatarAnimationsToClips(animations);
  for (const clip of clips) {
    component.addClip(clip);
  }
}

