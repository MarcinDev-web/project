export declare const ANIMATION_PACKAGE_VERSION = "0.1.0";
export * from './core/Skeleton';
export * from './core/Pose';
export * from './core/AnimationClip';
export * from './core/Blend';
export * from './sampling/Samplers';
export * from './runtime/AnimatorController';
export * from './runtime/Animator';
export * from './skin/JointPalette';
export * from './core/Morph';
export * from './gltf/convertFromGltf';
export * from './gltf/parseGLB';
export * from './memory/TypedArrayPool';
export type AnimationPublicAPI = {
    version: string;
};
export declare function getAnimationPublicAPI(): AnimationPublicAPI;
//# sourceMappingURL=index.d.ts.map