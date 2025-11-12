/**
 * @engine/world - ECS Runtime
 *
 * World, Scene, Components, Systems, Physics
 */
export { Entity, type EntityId, type EntityData } from './core/Entity.js';
export { Scene, type SceneData } from './core/Scene.js';
export { Transform } from './core/Transform.js';
export * from './core/index.js';
export { Component } from './components/Component.js';
export { registerComponent, getComponentConstructor } from './components/registry.js';
export { CameraComponent } from './components/CameraComponent.js';
export { CharacterController, type CharacterInput, type CharacterControllerData } from './components/CharacterController.js';
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
export { CheckpointComponent, type CheckpointComponentJSON, } from './components/CheckpointComponent.js';
export { TimerGateComponent, type TimerGateComponentJSON, } from './components/TimerGateComponent.js';
export { LaunchPadComponent, type LaunchPadComponentJSON, } from './components/LaunchPadComponent.js';
export { BouncePadComponent, type BouncePadComponentJSON, } from './components/BouncePadComponent.js';
export { MovingPlatformComponent, type MovingPlatformComponentJSON, } from './components/MovingPlatformComponent.js';
export { HazardZoneComponent, type HazardZoneComponentJSON, } from './components/HazardZoneComponent.js';
export { SpeedZoneComponent, type SpeedZoneComponentJSON, } from './components/SpeedZoneComponent.js';
export type { RgbaColor } from './utils/colors.js';
export * from './utils/weaponHelpers.js';
export * from './factories/WeaponFactory.js';
export * from './factories/WaterFactory.js';
export * from './utils/waterHelpers.js';
export * from './components/index.js';
export { BVH } from './spatial/BVH';
export type { BVHEntry } from './spatial/BVH';
export { Raycaster, type Ray, type RaycastHit } from './systems/Raycaster.js';
export { SelectionManager, getSelectionHighlight, type SelectionHighlight, } from './systems/Selection.js';
export { WeaponSystem } from './systems/WeaponSystem.js';
export { WeaponPickupSystem } from './systems/WeaponPickupSystem.js';
export { InventorySystem } from './systems/InventorySystem.js';
export { InteractionSystem } from './systems/InteractionSystem.js';
export type { InteractionSystemConfig } from './systems/InteractionSystem.js';
export { InteractableComponent } from './components/InteractableComponent.js';
export type { InteractableComponentJSON } from './components/InteractableComponent.js';
export { InteractionPromptUI } from './systems/InteractionPromptUI.js';
export type { InteractionPromptUIStyle } from './systems/InteractionPromptUI.js';
export { PhysicsWorld } from './physics/PhysicsWorld.js';
export { Octree } from './physics/Octree.js';
export type { AABB } from './physics/BoundingVolume.js';
export * from './physics/PhysicsWorld.js';
export * from './physics/PhysicsSystem.js';
export * from './physics/CollisionDetection.js';
export * from './physics/BoundingVolume.js';
export * from './physics/Joint.js';
export * from './physics/Octree.js';
export * from './physics/PhysicsRaycast.js';
export * from './physics/inertia.js';
//# sourceMappingURL=index.d.ts.map