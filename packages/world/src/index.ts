/**
 * @engine/world - ECS Runtime
 *
 * World, Scene, Components, Systems, Physics
 */

// Explicit exports for core classes to help TypeScript/bundlers resolve them
export { Entity, type EntityId, type EntityData } from './core/Entity.js';
export {
  Scene,
  type SceneData,
  SCENE_EVENTS,
  type EntityAddedEvent,
  type EntityRemovedEvent,
} from './core/Scene.js';
export { Transform } from './core/Transform.js';
export { CameraManager } from './systems/CameraManager.js';
export * from './core/index.js';

// Explicit exports for commonly used types and classes from components
export { Component } from './components/Component.js';
export { registerComponent, getComponentConstructor } from './components/registry.js';
export { CameraComponent } from './components/CameraComponent.js';
export {
  CharacterController,
  type CharacterInput,
  type CharacterControllerData,
  CharacterState,
  type CharacterControllerConfig,
  DEFAULT_CHARACTER_CONFIG,
} from './components/CharacterController.js';
export * from './net/InputChannel.js';
export * from './sim/AuthoritativeWorld.js';

// Movement interfaces
export * from './movement/MovementInterface.js';
export type { MovementProfile, MovementProfileExtension } from './movement/MovementProfile.js';
export { EnvironmentComponent } from './components/EnvironmentComponent.js';
export { LightComponent, type LightType } from './components/LightComponent.js';
export { MaterialComponent } from './components/MaterialComponent.js';
export { MeshComponent } from './components/MeshComponent.js';
export type { MeshKind, CustomMeshData } from './components/MeshComponent.js';
export { LODComponent } from './components/LODComponent.js';
export type { LODLevel } from './components/LODComponent.js';
export { PhysicsComponent, RigidbodyType } from './components/PhysicsComponent.js';
export { WaterComponent } from './components/WaterComponent.js';
export type { WaterComponentJSON } from './components/WaterComponent.js';
export { SpawnPointComponent } from './components/SpawnPointComponent.js';
export {
  CheckpointComponent,
  type CheckpointComponentJSON,
} from './components/CheckpointComponent.js';
export {
  TimerGateComponent,
  type TimerGateComponentJSON,
} from './components/TimerGateComponent.js';
export {
  LaunchPadComponent,
  type LaunchPadComponentJSON,
} from './components/LaunchPadComponent.js';
export {
  BouncePadComponent,
  type BouncePadComponentJSON,
} from './components/BouncePadComponent.js';
export {
  MovingPlatformComponent,
  type MovingPlatformComponentJSON,
} from './components/MovingPlatformComponent.js';
export {
  HazardZoneComponent,
  type HazardZoneComponentJSON,
} from './components/HazardZoneComponent.js';
export {
  SpeedZoneComponent,
  type SpeedZoneComponentJSON,
} from './components/SpeedZoneComponent.js';
export { MicroBlockComponent } from './components/MicroBlockComponent.js';
export { ShieldComponent, type ShieldComponentJSON } from './components/ShieldComponent.js';
export { PowerUpComponent, type PowerUpComponentJSON, type PowerUpType, type ActiveBuff } from './components/PowerUpComponent.js';
export { PowerUpPickupComponent, type PowerUpPickupComponentJSON } from './components/PowerUpPickupComponent.js';

// Explicit exports for utility types
export type { RgbaColor } from './utils/colors.js';

// Weapon system utilities
export * from './utils/weaponHelpers.js';
export * from './factories/WeaponFactory.js';

// Water system utilities
export * from './factories/WaterFactory.js';
export * from './utils/waterHelpers.js';

// Export all other components
export * from './components/index.js';

// Spatial structures
export { BVH } from './spatial/BVH';
export type { BVHEntry } from './spatial/BVH';

// Systems (selective to avoid duplicates)
export { Raycaster, type Ray, type RaycastHit } from './systems/Raycaster.js';
export {
  SelectionManager,
  getSelectionHighlight,
  type SelectionHighlight,
} from './systems/Selection.js';
export { WeaponSystem } from './systems/WeaponSystem.js';
export { WeaponPickupSystem } from './systems/WeaponPickupSystem.js';
export { InventorySystem } from './systems/InventorySystem.js';
export { InteractionSystem } from './systems/InteractionSystem.js';
export type { InteractionSystemConfig } from './systems/InteractionSystem.js';
export { CheckpointSystem, type CheckpointActivation } from './systems/CheckpointSystem.js';
export { PvPRespawnManager } from './utils/PvPRespawnManager.js';
export { RespawnManager, type RespawnOptions, type RespawnResult } from './managers/RespawnManager.js';
export { StaticBlockManager } from './managers/StaticBlockManager.js';
export { PvPScoreboard, type PlayerStats } from './utils/PvPScoreboard.js';
export { InteractableComponent } from './components/InteractableComponent.js';
export type { InteractableComponentJSON } from './components/InteractableComponent.js';
export { InteractionPromptUI } from './systems/InteractionPromptUI.js';
export type { InteractionPromptUIStyle } from './systems/InteractionPromptUI.js';
export { MicroBlockSystem, type MicroBlockSystemConfig } from './systems/MicroBlockSystem.js';
export { MicroBlockMesher } from './utils/MicroBlockMesher.js';
export { PowerUpSystem } from './systems/PowerUpSystem.js';
export { MovingPlatformSystem } from './systems/MovingPlatformSystem.js';
export { ParkourSystem } from './systems/ParkourSystem.js';
export { NpcBehaviorSystem } from './systems/NpcBehaviorSystem.js';
export { WeatherSystem, type WeatherState, type WeatherSystemConfig } from './systems/WeatherSystem.js';
export {
  HazardZoneSystem,
  type HazardDamageEvent,
  type HazardKillEvent,
  type HazardZoneSystemOptions,
} from './systems/HazardZoneSystem.js';

// Physics (selective to avoid duplicates with systems)
export { PhysicsWorld } from './physics/PhysicsWorld.js';
export { Octree } from './physics/Octree.js';
export { LooseOctree, type LooseOctreeConfig, type LooseOctreeEntry } from './physics/LooseOctree.js';
export { DynamicBVH, type DynamicBVHConfig } from './physics/DynamicBVH.js';
export type { AABB } from './physics/BoundingVolume.js';
export * from './physics/PhysicsWorld.js';
export * from './physics/PhysicsSystem.js';
export * from './physics/CollisionDetection.js';
export * from './physics/BoundingVolume.js';
export * from './physics/Joint.js';
export * from './physics/Octree.js';
export * from './physics/PhysicsRaycast.js';
export * from './physics/inertia.js';

// WASM Animation System
export { WasmAnimationSystem } from './systems/WasmAnimationSystem.js';

// Engine
export * from './engine/index.js';

// WASM ECS Acceleration System
export {
  WasmEcsSystem,
  getWasmEcsSystem,
  initGlobalWasmEcs,
} from './systems/WasmEcsSystem.js';
