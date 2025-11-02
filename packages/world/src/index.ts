/**
 * @engine/world - ECS Runtime
 * 
 * World, Scene, Components, Systems, Physics
 */

// Explicit exports for core classes to help TypeScript/bundlers resolve them
export { Entity, type EntityId, type EntityData } from './core/Entity';
export { Scene, type SceneData } from './core/Scene';
export { Transform } from './core/Transform';
export * from './core';

// Explicit exports for commonly used types and classes from components
export { Component } from './components/Component';
export { registerComponent, getComponentConstructor } from './components/registry';
export { CameraComponent } from './components/CameraComponent';
export { CharacterController, type CharacterInput } from './components/CharacterController';

// Movement interfaces
export * from './movement/MovementInterface';
export { EnvironmentComponent } from './components/EnvironmentComponent';
export { LightComponent, type LightType } from './components/LightComponent';
export { MaterialComponent } from './components/MaterialComponent';
export { MeshComponent } from './components/MeshComponent';
export type { MeshKind, CustomMeshData } from './components/MeshComponent';
export { PhysicsComponent, RigidbodyType } from './components/PhysicsComponent';
export { WaterComponent } from './components/WaterComponent';
export type { WaterComponentJSON } from './components/WaterComponent';
export { SpawnPointComponent } from './components/SpawnPointComponent';
export { CheckpointComponent, type CheckpointComponentJSON } from './components/CheckpointComponent';
export { TimerGateComponent, type TimerGateComponentJSON } from './components/TimerGateComponent';
export { LaunchPadComponent, type LaunchPadComponentJSON } from './components/LaunchPadComponent';
export { BouncePadComponent, type BouncePadComponentJSON } from './components/BouncePadComponent';
export { MovingPlatformComponent, type MovingPlatformComponentJSON } from './components/MovingPlatformComponent';
export { HazardZoneComponent, type HazardZoneComponentJSON } from './components/HazardZoneComponent';
export { SpeedZoneComponent, type SpeedZoneComponentJSON } from './components/SpeedZoneComponent';

// Explicit exports for utility types
export type { RgbaColor } from './utils/colors';

// Weapon system utilities
export * from './utils/weaponHelpers';
export * from './factories/WeaponFactory';

// Water system utilities
export * from './factories/WaterFactory';
export * from './utils/waterHelpers';

// Export all other components
export * from './components';

// Systems (selective to avoid duplicates)
export { Raycaster, type Ray, type RaycastHit } from './systems/Raycaster';
export { SelectionManager, getSelectionHighlight, type SelectionHighlight } from './systems/Selection';
export { WeaponSystem } from './systems/WeaponSystem';
export { InventorySystem } from './systems/InventorySystem';

// Physics (selective to avoid duplicates with systems)
export { PhysicsWorld } from './physics/PhysicsWorld';
export { Octree } from './physics/Octree';
export type { AABB } from './physics/BoundingVolume';
export * from './physics/PhysicsWorld';
export * from './physics/PhysicsSystem';
export * from './physics/CollisionDetection';
export * from './physics/BoundingVolume';
export * from './physics/Joint';
export * from './physics/Octree';
export * from './physics/PhysicsRaycast';
export * from './physics/inertia';

