/**
 * PhysicsSystem - Main physics simulation system
 * Handles gravity, forces, velocity integration, and collision resolution
 * Powered by Rust (wasm-physics)
 */

import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { PhysicsComponent, RigidbodyType, ColliderShape } from '../components/PhysicsComponent.js';
import type { Vec3 } from '@engine/core/math';
import { init as initWasm, PhysicsWorld, BodyType } from '@engine/wasm-physics';
import { DEFAULT_OCTREE_CONFIG, type OctreeConfig } from './Octree.js';
import { 
    type Joint, 
    JointType,
    type AnyJointConfig 
} from './Joint.js';
import type { RaycastHit, RaycastOptions } from './PhysicsRaycast.js';

/**
 * Collision event data
 */
export interface CollisionEvent {
  /** First entity in collision */
  entityA: Entity;
  /** Second entity in collision */
  entityB: Entity;
  /** Physics component of first entity */
  physicsA: PhysicsComponent;
  /** Physics component of second entity */
  physicsB: PhysicsComponent;
  /** Contact normal pointing from A to B */
  normal: Vec3;
  /** Penetration depth */
  depth: number;
  /** Contact point in world space */
  contactPoint: Vec3;
}

/**
 * Trigger event data (for trigger colliders that don't have physical response)
 */
export interface TriggerEvent {
  /** Entity with trigger collider */
  triggerEntity: Entity;
  /** Other entity that entered/exited trigger */
  otherEntity: Entity;
}

/**
 * Physics simulation configuration
 */
export interface PhysicsConfig {
  /** Gravity vector (default: [0, -9.81, 0]) */
  gravity: Vec3;
  /** Maximum number of collision solver iterations per frame */
  solverIterations: number;
  /** Fixed timestep for physics simulation in seconds */
  fixedTimestep: number;
  /** Maximum substeps per frame to prevent spiral of death */
  maxSubsteps: number;
  /** Enable spatial partitioning (octree) for broad phase (default: true) */
  useSpatialPartitioning: boolean;
  /** Octree configuration (only used if useSpatialPartitioning is true) */
  octreeConfig?: Partial<OctreeConfig>;
  /** World bounds for octree (default: auto-calculated) */
  worldBounds?: { min: Vec3; max: Vec3 };
  /** Enable WASM acceleration if available (default: true) */
  useWasm: boolean;
}

/**
 * Default physics configuration
 */
export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  gravity: [0, -9.81, 0],
  solverIterations: 8,
  fixedTimestep: 1 / 60, // 60 Hz
  maxSubsteps: 4,
  useSpatialPartitioning: true,
  octreeConfig: DEFAULT_OCTREE_CONFIG,
  worldBounds: {
    min: [-100, -100, -100],
    max: [100, 100, 100],
  },
  useWasm: true,
};

/**
 * PhysicsSystem manages physics simulation for all entities with PhysicsComponent
 */
export class PhysicsSystem {
  private scene: Scene;
  private config: PhysicsConfig;
  private accumulator: number = 0;

  /** Collision event listeners */
  private collisionListeners: Array<(event: CollisionEvent) => void> = [];

  /** Trigger enter event listeners */
  private triggerEnterListeners: Array<(event: TriggerEvent) => void> = [];

  /** Trigger exit event listeners */
  private triggerExitListeners: Array<(event: TriggerEvent) => void> = [];

  /** WASM World */
  private world: PhysicsWorld | null = null;
  private initialized = false;
  
  private entityToBodyId = new Map<string, number>();
  private bodyIdToEntity = new Map<number, Entity>();
  private nextBodyId = 1;
  private nextJointId = 1;
  private joints = new Map<number, Joint>();
  private jointIdToWasmId = new Map<number, number>();

  constructor(scene: Scene, config: Partial<PhysicsConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };

    this.init().catch((err) => {
      console.error('Failed to initialize WASM physics', err);
    });
  }

  private async init() {
    if (this.config.useWasm) {
      try {
        await initWasm();
        this.world = new PhysicsWorld(
          this.config.gravity[0],
          this.config.gravity[1],
          this.config.gravity[2]
        );
        this.initialized = true;
        console.log('WASM Physics initialized');
      } catch (e) {
        console.warn('WASM init failed, falling back?', e);
      }
    }
  }

  /**
   * Updates the physics simulation by deltaTime
   * Uses fixed timestep with accumulator for stability
   */
  update(deltaTime: number): void {
    if (!this.initialized || !this.world) return;

    // Clamp deltaTime to prevent spiral of death
    const clampedDelta = Math.min(deltaTime, this.config.fixedTimestep * this.config.maxSubsteps);
    this.accumulator += clampedDelta;

    // Sync entities to WASM before stepping
    this.syncEntitiesToWasm();

    let steps = 0;
    while (this.accumulator >= this.config.fixedTimestep && steps < this.config.maxSubsteps) {
      this.world.step(this.config.fixedTimestep);
      this.accumulator -= this.config.fixedTimestep;
      steps++;
    }

    // Sync back to entities
    this.syncWasmToEntities();
    
    // Process Events
    this.processEvents();

    this.runScriptFixedUpdate(this.config.fixedTimestep * steps);
  }

  private syncEntitiesToWasm() {
    if (!this.world) return;

    const entities = this.scene.queryEntities(PhysicsComponent);
    const activeIds = new Set<number>();

    for (const entity of entities) {
      const physics = entity.getComponent(PhysicsComponent);
      if (!physics) continue;

      let bodyId = this.entityToBodyId.get(entity.id);

      if (bodyId === undefined) {
        // Create new body
        bodyId = this.nextBodyId++;
        this.entityToBodyId.set(entity.id, bodyId);
        this.bodyIdToEntity.set(bodyId, entity);

        let type = BodyType.Dynamic;
        if (physics.rigidbodyType === RigidbodyType.Static) type = BodyType.Static;
        if (physics.rigidbodyType === RigidbodyType.Kinematic) type = BodyType.Kinematic;

        const t = entity.transform;
        this.world.add_body(
          bodyId,
          type,
          t.position[0], t.position[1], t.position[2],
          t.rotation[0], t.rotation[1], t.rotation[2], t.rotation[3],
          physics.mass,
          physics.linearDrag,
          physics.angularDrag,
          physics.freezePositionX, physics.freezePositionY, physics.freezePositionZ
        );

        // Add Colliders
        for (const col of physics.colliders) {
          let shape = 0; // Box
          let sx = 1, sy = 1, sz = 1;
          
          if (col.shape === ColliderShape.Box) {
            shape = 0;
            sx = col.size[0]; sy = col.size[1]; sz = col.size[2];
          } else if (col.shape === ColliderShape.Sphere) {
            shape = 1;
            sx = col.radius;
          } else if (col.shape === ColliderShape.Capsule) {
            shape = 2;
            sx = col.radius;
            sy = col.height;
          }
          
          // Offset defaults to 0 if undefined
          const ox = (col as any).offset?.[0] ?? col.center[0] ?? 0;
          const oy = (col as any).offset?.[1] ?? col.center[1] ?? 0;
          const oz = (col as any).offset?.[2] ?? col.center[2] ?? 0;

          this.world.add_collider(
            bodyId,
            shape,
            sx, sy, sz,
            ox, oy, oz,
            col.isTrigger,
            physics.material.friction,
            physics.material.restitution
          );
        }
      } else {
        // Update Kinematic or Teleported bodies
        if (physics.rigidbodyType === RigidbodyType.Kinematic) {
             const t = entity.transform;
             this.world.set_kinematic_target(
                 bodyId,
                 t.position[0], t.position[1], t.position[2],
                 t.rotation[0], t.rotation[1], t.rotation[2], t.rotation[3]
             );
        }
      }
      
      activeIds.add(bodyId);
    }

    // Remove stale bodies
    for (const [id, bodyId] of this.entityToBodyId.entries()) {
        if (!activeIds.has(bodyId)) {
            this.world.remove_body(bodyId);
            this.entityToBodyId.delete(id);
            this.bodyIdToEntity.delete(bodyId);
        }
    }
  }

  private syncWasmToEntities() {
    if (!this.world) return;
    
    const buffer = this.world.sync_states(); 
    // [id, x, y, z, qx, qy, qz, qw, ...]
    
    for (let i = 0; i < buffer.length; i += 8) {
        const id = buffer[i];
        if (id === undefined) continue;

        const entity = this.bodyIdToEntity.get(id);
        if (entity) {
            const t = entity.transform;
            t.position[0] = buffer[i+1] || 0;
            t.position[1] = buffer[i+2] || 0;
            t.position[2] = buffer[i+3] || 0;
            t.rotation[0] = buffer[i+4] || 0;
            t.rotation[1] = buffer[i+5] || 0;
            t.rotation[2] = buffer[i+6] || 0;
            t.rotation[3] = buffer[i+7] || 0;
            t.position = t.position; // Trigger update
            t.rotation = t.rotation;
        }
    }
  }
  
  private processEvents() {
      if (!this.world) return;
      const events = this.world.get_event_buffer(); 
      // [id1, id2, type, nx, ny, nz, depth, px, py, pz, ...]
      
      for (let i = 0; i < events.length; i += 10) {
          const id1 = events[i];
          const id2 = events[i+1];
          // const type = events[i+2];
          const nx = events[i+3] || 0;
          const ny = events[i+4] || 0;
          const nz = events[i+5] || 0;
          const depth = events[i+6] || 0;
          const px = events[i+7] || 0;
          const py = events[i+8] || 0;
          const pz = events[i+9] || 0;
          
          if (id1 === undefined || id2 === undefined) continue;

          const entA = this.bodyIdToEntity.get(id1);
          const entB = this.bodyIdToEntity.get(id2);
          
          if (entA && entB) {
              const physA = entA.getComponent(PhysicsComponent);
              const physB = entB.getComponent(PhysicsComponent);
              if (physA && physB) {
                  const evt: CollisionEvent = {
                      entityA: entA,
                      entityB: entB,
                      physicsA: physA,
                      physicsB: physB,
                      normal: [nx, ny, nz],
                      depth: depth,
                      contactPoint: [px, py, pz]
                  };
                  this.fireCollisionEvent(evt);
              }
          }
      }
  }

  private fireCollisionEvent(event: CollisionEvent) {
      for (const listener of this.collisionListeners) {
          listener(event);
      }
  }

  private runScriptFixedUpdate(dt: number): void {
    const allEntities = this.scene.getAllEntities();
    for (const entity of allEntities) {
      const componentTypes = entity.getComponentTypes();
      for (const ctor of componentTypes) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        const comp: any = entity.getComponent(ctor as never);
        if (!comp || typeof comp.getInstances !== 'function') continue;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const instances = comp.getInstances();
        for (const behavior of instances) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (!behavior.enabled) continue;
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            behavior.onFixedUpdate(dt);
          } catch {
            // ignore behavior errors
          }
        }
      }
    }
  }

  /**
   * Adds a collision event listener
   */
  onCollision(listener: (event: CollisionEvent) => void): void {
    this.collisionListeners.push(listener);
  }

  /**
   * Adds a trigger enter event listener
   */
  onTriggerEnter(listener: (event: TriggerEvent) => void): void {
    this.triggerEnterListeners.push(listener);
  }

  /**
   * Adds a trigger exit event listener
   */
  onTriggerExit(listener: (event: TriggerEvent) => void): void {
    this.triggerExitListeners.push(listener);
  }

  /**
   * Removes a collision event listener
   */
  removeCollisionListener(listener: (event: CollisionEvent) => void): void {
    const index = this.collisionListeners.indexOf(listener);
    if (index !== -1) {
      this.collisionListeners.splice(index, 1);
    }
  }

  /**
   * Sets the gravity vector
   */
  setGravity(gravity: Vec3): void {
    this.config.gravity = [...gravity] as Vec3;
    // Recreate the physics world so existing bodies pick up the new gravity.
    if (this.world && this.initialized) {
      try {
        this.world = new PhysicsWorld(gravity[0], gravity[1], gravity[2]);
        this.entityToBodyId.clear();
        this.bodyIdToEntity.clear();
        this.nextBodyId = 1;
      } catch (err) {
        console.warn('Failed to recreate physics world with new gravity', err);
      }
    }
  }

  /**
   * Gets the current gravity vector
   */
  getGravity(): Vec3 {
    return [...this.config.gravity] as Vec3;
  }

  /**
   * Updates the physics configuration
   */
  setConfig(config: Partial<PhysicsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets the current physics configuration
   */
  getConfig(): PhysicsConfig {
    return { ...this.config };
  }

  /**
   * Gets octree statistics (if spatial partitioning is enabled)
   */
  getOctreeStats() {
    return null;
  }

  /**
   * Enables or disables spatial partitioning
   */
  setSpatialPartitioning(enabled: boolean): void {
    this.config.useSpatialPartitioning = enabled;
  }
  
  rebuildOctree() {}

  getPhysicsEntities(): Entity[] {
      return Array.from(this.bodyIdToEntity.values());
  }

  // Joint Methods
  addJoint(config: AnyJointConfig): Joint {
    const id = this.nextJointId++;
    const joint: Joint = {
        id: `joint_${id}`,
        ...config
    } as any; // Casting as id type might mismatch string vs number in types. Using simplified Joint type here.

    this.joints.set(id, joint);
    
    if (this.world && this.initialized) {
        const bodyA = this.entityToBodyId.get(config.entityA.id);
        const bodyB = this.entityToBodyId.get(config.entityB.id);
        
        if (bodyA !== undefined && bodyB !== undefined) {
            const anchorA = config.localAnchorA || [0,0,0];
            const anchorB = config.localAnchorB || [0,0,0];
            const axisA = (config as any).axisA || [0,1,0];
            const axisB = (config as any).axisB || [0,1,0];

            let type = 0; // Fixed
            let dist = 0, minD = 0, maxD = 0, stiff = 0, damp = 0;

            if (config.type === JointType.Distance) {
                type = 1;
                dist = (config as any).distance || 1.0;
            } else if (config.type === JointType.Spring) {
                type = 2;
                dist = (config as any).restLength || 1.0;
                stiff = (config as any).stiffness || 10.0;
                damp = (config as any).damping || 0.5;
            } else if (config.type === JointType.Hinge) {
                type = 3;
            } else if (config.type === JointType.BallSocket) {
                type = 4;
            } else if (config.type === JointType.Slider) {
                type = 5;
            }

            const wasmJointId = this.world.add_joint(
                type,
                bodyA, bodyB,
                anchorA[0], anchorA[1], anchorA[2],
                anchorB[0], anchorB[1], anchorB[2],
                dist, minD, maxD,
                stiff, damp,
                axisA[0], axisA[1], axisA[2],
                axisB[0], axisB[1], axisB[2]
            );
            this.jointIdToWasmId.set(id, wasmJointId);
        }
    }
    
    return joint;
  }

  removeJoint(_joint: Joint): void {
      let jointKey: number | undefined;
      for (const [id, stored] of this.joints.entries()) {
          if (stored === _joint || stored.id === _joint.id) {
              jointKey = id;
              break;
          }
      }

      if (jointKey === undefined) {
          return;
      }

      const wasmId = this.jointIdToWasmId.get(jointKey);
      if (wasmId !== undefined && this.world) {
          try {
              this.world.remove_joint(wasmId);
          } catch (err) {
              console.warn('Failed to remove joint from WASM world', err);
          }
      }
      this.joints.delete(jointKey);
      this.jointIdToWasmId.delete(jointKey);
  }

  getAllJoints(): Joint[] {
      return Array.from(this.joints.values());
  }

  addFixedJoint(
    entityA: Entity,
    entityB: Entity,
    localAnchorA: Vec3 = [0, 0, 0],
    localAnchorB: Vec3 = [0, 0, 0],
    options?: { breakable?: boolean; breakForce?: number }
  ): Joint {
      return this.addJoint({
          type: JointType.Fixed,
          entityA, entityB,
          localAnchorA, localAnchorB,
          ...options
      });
  }

  addDistanceJoint(
    entityA: Entity,
    entityB: Entity,
    distance: number,
    localAnchorA: Vec3 = [0, 0, 0],
    localAnchorB: Vec3 = [0, 0, 0],
    options?: { minDistance?: number; maxDistance?: number; damping?: number }
  ): Joint {
    return this.addJoint({
        type: JointType.Distance,
        entityA, entityB,
        distance,
        localAnchorA, localAnchorB,
        ...options
    });
  }

  addSpringJoint(
    entityA: Entity,
    entityB: Entity,
    restLength: number,
    stiffness: number,
    damping: number,
    localAnchorA: Vec3 = [0, 0, 0],
    localAnchorB: Vec3 = [0, 0, 0],
    options?: { minDistance?: number; maxDistance?: number }
  ): Joint {
    return this.addJoint({
        type: JointType.Spring,
        entityA, entityB,
        restLength,
        stiffness,
        damping,
        localAnchorA, localAnchorB,
        ...options
    });
  }

  addHingeJoint(
    entityA: Entity,
    entityB: Entity,
    axisA: Vec3,
    axisB: Vec3,
    localAnchorA: Vec3 = [0, 0, 0],
    localAnchorB: Vec3 = [0, 0, 0],
    options?: any
  ): Joint {
    return this.addJoint({
        type: JointType.Hinge,
        entityA, entityB,
        axisA, axisB,
        localAnchorA, localAnchorB,
        ...options
    });
  }

  addBallSocketJoint(
    entityA: Entity,
    entityB: Entity,
    localAnchorA: Vec3 = [0, 0, 0],
    localAnchorB: Vec3 = [0, 0, 0],
    options?: any
  ): Joint {
    return this.addJoint({
        type: JointType.BallSocket,
        entityA, entityB,
        localAnchorA, localAnchorB,
        ...options
    });
  }

  addSliderJoint(
    entityA: Entity,
    entityB: Entity,
    axisA: Vec3,
    axisB: Vec3,
    localAnchorA: Vec3 = [0, 0, 0],
    localAnchorB: Vec3 = [0, 0, 0],
    options?: any
  ): Joint {
    return this.addJoint({
        type: JointType.Slider,
        entityA, entityB,
        axisA, axisB,
        localAnchorA, localAnchorB,
        ...options
    });
  }

  // Raycast Stubs
  raycast(_origin: Vec3, _direction: Vec3, _options?: RaycastOptions): RaycastHit | null {
      return null;
  }

  raycastAll(_origin: Vec3, _direction: Vec3, _options?: RaycastOptions): RaycastHit[] {
      return [];
  }
}
