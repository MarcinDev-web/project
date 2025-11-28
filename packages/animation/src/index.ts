export const ANIMATION_PACKAGE_VERSION = '0.2.0';

export * from './core/Skeleton';
export * from './core/Pose';
export * from './core/AnimationClip';
export * from './core/Blend';
export * from './sampling/Samplers';
export * from './sampling/WasmSampler';
export * from './runtime/AnimatorController';
export * from './runtime/Animator';
export * from './runtime/AnimatorOptimized';
export * from './skin/JointPalette';
export * from './core/Morph';
export * from './gltf/convertFromGltf';
export * from './gltf/parseGLB';
export * from './memory/TypedArrayPool';

export type AnimationPublicAPI = {
  version: string;
};

export function getAnimationPublicAPI(): AnimationPublicAPI {
  return { version: ANIMATION_PACKAGE_VERSION };
}
