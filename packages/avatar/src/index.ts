export * from './skeleton';
export * from './slots';
export * from './animation';
export * from './avatar-instance';
export * from './animation-adapter';
export * from './skeleton-adapter';

export { generateHeroicTorsoMesh } from './geometry/torso-geometry';
export { generateSphereMesh } from './geometry/sphere-geometry';
export { generateCapsuleY } from './geometry/capsule-geometry';

// WASM-accelerated mesh generation
export { 
  initWasmMeshGenerator, 
  isWasmAvailable,
  benchmarkMeshGeneration,
} from './mesh/wasm-mesh-generator';
export { AvatarMeshGenerator } from './mesh/avatar-mesh-generator';

export { DEFAULT_AVATAR_PART_DEFINITIONS } from './default-parts';
export { DEFAULT_AVATAR_LOADOUT } from './default-loadout';
export { createAvatarPartLibrary, DEFAULT_AVATAR_PART_LIBRARY } from './part-library-factory';
export { IDLE_ANIMATION, RUN_ANIMATION, WALK_ANIMATION, JUMP_ANIMATION } from './default-animations';