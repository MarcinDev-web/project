/**
 * Physics System - Complete physics simulation for game engine
 * 
 * Main exports:
 * - PhysicsWorld: High-level API for physics (recommended)
 * - PhysicsSystem: Low-level physics engine
 * - PhysicsComponent: Rigidbody and collider component
 * - Collision detection utilities
 */

// High-level API (recommended for most use cases)
export { PhysicsWorld } from './PhysicsWorld';

// Low-level API (for advanced users)
export { PhysicsSystem, DEFAULT_PHYSICS_CONFIG } from './PhysicsSystem';
export type { PhysicsConfig, CollisionEvent, TriggerEvent } from './PhysicsSystem';

// Component and types
export {
  PhysicsComponent,
  RigidbodyType,
  ColliderShape,
  DEFAULT_PHYSICS_MATERIAL,
} from '../scene/components/PhysicsComponent';

export type {
  AnyCollider,
  BoxCollider,
  SphereCollider,
  CapsuleCollider,
  ContactPoint,
  PhysicsMaterial,
} from '../scene/components/PhysicsComponent';

// Joint system
export { JointComponent } from '../scene/components/JointComponent';
export {
  JointType,
  createJoint,
  FixedJoint,
  DistanceJoint,
  SpringJoint,
  HingeJoint,
  BallSocketJoint,
  SliderJoint,
} from './Joint';

export type {
  Joint,
  AnyJointConfig,
  BaseJointConfig,
  FixedJointConfig,
  DistanceJointConfig,
  SpringJointConfig,
  HingeJointConfig,
  BallSocketJointConfig,
  SliderJointConfig,
  JointState,
} from './Joint';

// Collision detection (for custom physics implementations)
export { CollisionDetection } from './CollisionDetection';
export type { CollisionInfo, ColliderTransform } from './CollisionDetection';

// Spatial partitioning
export { Octree, DEFAULT_OCTREE_CONFIG } from './Octree';
export type { OctreeConfig, OctreeEntry } from './Octree';
export { BoundingVolume } from './BoundingVolume';
export type { AABB } from './BoundingVolume';

// Physics raycasting
export { PhysicsRaycast } from './PhysicsRaycast';
export type { PhysicsRay, RaycastHit, RaycastOptions } from './PhysicsRaycast';

// Inertia tensor utilities
export { calculateInertiaTensor } from './inertia';
export type { InertiaShape } from './inertia';

