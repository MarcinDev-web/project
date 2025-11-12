import { AnimationClip } from '@engine/stdlib/Animation';
import type { AvatarAnimation } from './animation';
/**
 * Converts AvatarAnimation format to AnimationClip format.
 *
 * AvatarAnimation uses keyframes per joint (all joints in one frame),
 * while AnimationClip uses tracks per property (all keyframes for one property).
 *
 * @param animation - AvatarAnimation to convert
 * @returns AnimationClip with tracks for each joint property
 */
export declare function avatarAnimationToClip(animation: AvatarAnimation): AnimationClip;
//# sourceMappingURL=animation-adapter.d.ts.map