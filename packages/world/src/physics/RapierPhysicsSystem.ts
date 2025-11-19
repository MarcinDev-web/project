import { Scene } from '../core/Scene.js';
import { Entity } from '../core/Entity.js';
import { PhysicsComponent, RigidbodyType, ColliderShape } from '../components/PhysicsComponent.js';
import { init as initWasm, PhysicsWorld } from '@engine/wasm-physics';
import type { Vec3 } from '@engine/core/math';
import { DEFAULT_PHYSICS_CONFIG, type PhysicsConfig, type TriggerEvent, type CollisionEvent } from './PhysicsSystem.js';
import { Joint } from './Joint.js';

export class RapierPhysicsSystem {
  private scene: Scene;
  private world: PhysicsWorld | null = null;
  private wasmMemory: WebAssembly.Memory | null = null;
  private initialized = false;
  private rapierIdToEntity = new Map<number, Entity>();
  private collisionListeners: Array<(event: CollisionEvent) => void> = [];
  private triggerEnterListeners: Array<(event: TriggerEvent) => void> = [];
  private triggerExitListeners: Array<(event: TriggerEvent) => void> = [];
  private config: PhysicsConfig;

  // Dummy properties to satisfy PhysicsSystem interface compatibility
  // @ts-ignore
  private accumulator: number = 0;
  // @ts-ignore
  private previousTriggers: Set<string> = new Set();
  // @ts-ignore
  private currentTriggersScratch: Set<string> = new Set();
  // @ts-ignore
  private octree: any = null;
  
  constructor(scene: Scene, config: Partial<PhysicsConfig> = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
    this.init();
  }

  private async init() {
    try {
      // @ts-ignore
      const wasm = await initWasm();
      // @ts-ignore - wasm module might not have memory property directly if it's the init function result
      this.wasmMemory = wasm.memory || (wasm as any).wasm?.memory;
      this.world = new PhysicsWorld(this.config.gravity[0], this.config.gravity[1], this.config.gravity[2]);
      this.initialized = true;
      console.log('RapierPhysicsSystem initialized');
    } catch (e) {
      console.error('Failed to initialize RapierPhysicsSystem', e);
    }
  }

  onCollision(listener: (event: CollisionEvent) => void) {
    this.collisionListeners.push(listener);
  }

  removeCollisionListener(listener: (event: CollisionEvent) => void) {
    const index = this.collisionListeners.indexOf(listener);
    if (index !== -1) {
        this.collisionListeners.splice(index, 1);
    }
  }

  onTriggerEnter(listener: (event: TriggerEvent) => void) {
      this.triggerEnterListeners.push(listener);
  }

  onTriggerExit(listener: (event: TriggerEvent) => void) {
      this.triggerExitListeners.push(listener);
  }

  setGravity(gravity: Vec3) {
      this.config.gravity = [...gravity] as Vec3;
      if (this.world) {
          this.world.set_gravity(gravity[0], gravity[1], gravity[2]);
      }
  }

  getGravity(): Vec3 {
      return [...this.config.gravity] as Vec3;
  }

  setConfig(config: Partial<PhysicsConfig>) {
      this.config = { ...this.config, ...config };
      if (config.gravity) {
          this.setGravity(config.gravity);
      }
  }

  getConfig(): PhysicsConfig {
      return { ...this.config };
  }

  getOctreeStats() {
      return null;
  }

  rebuildOctree() {}

  setSpatialPartitioning(_enabled: boolean) {}

  getAllJoints(): Joint[] {
      return [];
  }

  update(dt: number) {
    if (!this.initialized || !this.world || !this.wasmMemory) return;

    const entities = this.scene.queryEntities(PhysicsComponent);

    // 1. Manage Bodies (Add/Remove)
    for (const entity of entities) {
      const physics = entity.getComponent(PhysicsComponent);
      if (!physics) continue;

      if (physics._rapierId === -1) {
        this.createBody(entity, physics);
      }
    }

    const currentIds = new Set<number>();
    for (const entity of entities) {
      const physics = entity.getComponent(PhysicsComponent);
      if (physics && physics._rapierId !== -1) {
        currentIds.add(physics._rapierId);
      }
    }
    
    for (const [id, entity] of this.rapierIdToEntity.entries()) {
      if (!currentIds.has(id)) {
        this.world.remove_rigid_body(id);
        this.rapierIdToEntity.delete(id);
        const physics = entity.getComponent(PhysicsComponent);
        if (physics) {
            physics._rapierId = -1;
        }
      }
    }

    // 2. Sync Kinematic bodies (JS -> Rust)
    for (const entity of entities) {
      const physics = entity.getComponent(PhysicsComponent);
      if (!physics || physics._rapierId === -1) continue;
      
      if (physics.rigidbodyType === RigidbodyType.Kinematic) {
          const t = entity.transform;
          const pos = t.getWorldPosition();
          const rot = t.rotation;
          
          this.world.set_kinematic_translation(physics._rapierId, pos[0], pos[1], pos[2]);
          this.world.set_kinematic_rotation(physics._rapierId, rot[0], rot[1], rot[2], rot[3]);
      }
    }

    // 3. Step simulation
    this.world.step(dt);

    // 4. Sync Dynamic bodies (Rust -> JS)
    const count = this.world.sync_states();
    if (count > 0) {
      const ptr = this.world.get_sync_buffer_ptr();
      const view = new Float32Array(this.wasmMemory.buffer, ptr, count * 8);
      
      for (let i = 0; i < count; i++) {
        const offset = i * 8;
        const id = view[offset];
        if (id === undefined) continue;

        const x = view[offset + 1];
        const y = view[offset + 2];
        const z = view[offset + 3];
        const qx = view[offset + 4];
        const qy = view[offset + 5];
        const qz = view[offset + 6];
        const qw = view[offset + 7];
        
        const entity = this.rapierIdToEntity.get(id);
        if (entity) {
            const t = entity.transform;
            if (x !== undefined) t.position[0] = x;
            if (y !== undefined) t.position[1] = y;
            if (z !== undefined) t.position[2] = z;
            if (qx !== undefined) t.rotation[0] = qx;
            if (qy !== undefined) t.rotation[1] = qy;
            if (qz !== undefined) t.rotation[2] = qz;
            if (qw !== undefined) t.rotation[3] = qw;
            t.position = t.position; // Trigger update
            t.rotation = t.rotation; // Trigger update
        }
      }
    }

    // 5. Dispatch collision events
    const eventCount = this.world.consume_events();
    if (eventCount > 0) {
        const ptr = this.world.get_event_buffer_ptr();
        const view = new Float32Array(this.wasmMemory.buffer, ptr, eventCount * 3);
        
        for (let i = 0; i < eventCount; i++) {
            const offset = i * 3;
            const id1 = view[offset];
            const id2 = view[offset + 1];
            const startedVal = view[offset + 2];
            
            if (id1 === undefined || id2 === undefined || startedVal === undefined) continue;

            const started = startedVal > 0.5;
            
            const entityA = this.rapierIdToEntity.get(id1);
            const entityB = this.rapierIdToEntity.get(id2);
            
            if (entityA && entityB) {
                const physicsA = entityA.getComponent(PhysicsComponent);
                const physicsB = entityB.getComponent(PhysicsComponent);
                
                if (physicsA && physicsB) {
                    const event: CollisionEvent = {
                        entityA,
                        entityB,
                        physicsA,
                        physicsB,
                        normal: [0, 1, 0], // Dummy
                        depth: 0,
                        contactPoint: [0, 0, 0]
                    };
                    
                    if (started) {
                        for (const listener of this.collisionListeners) {
                            listener(event);
                        }
                    }
                }
            }
        }
    }

    // 6. Dispatch trigger events
    const triggerCount = this.world.consume_trigger_events();
    if (triggerCount > 0) {
        const ptr = this.world.get_trigger_event_buffer_ptr();
        const view = new Float32Array(this.wasmMemory.buffer, ptr, triggerCount * 3);
        
        for (let i = 0; i < triggerCount; i++) {
            const offset = i * 3;
            const id1 = view[offset];
            const id2 = view[offset + 1];
            const startedVal = view[offset + 2];
            
            if (id1 === undefined || id2 === undefined || startedVal === undefined) continue;

            const started = startedVal > 0.5;
            
            const entityA = this.rapierIdToEntity.get(id1);
            const entityB = this.rapierIdToEntity.get(id2);
            
            if (entityA && entityB) {
                const event: TriggerEvent = {
                    triggerEntity: entityA,
                    otherEntity: entityB
                };
                
                if (started) {
                    for (const listener of this.triggerEnterListeners) {
                        listener(event);
                    }
                } else {
                    for (const listener of this.triggerExitListeners) {
                        listener(event);
                    }
                }
            }
        }
    }
  }

  private createBody(entity: Entity, physics: PhysicsComponent) {
    if (!this.world) return;

    const t = entity.transform;
    const pos = t.getWorldPosition();
    const rot = t.rotation;

    let type = 0;
    if (physics.rigidbodyType === RigidbodyType.Static) type = 1;
    else if (physics.rigidbodyType === RigidbodyType.Kinematic) type = 2;

    const id = this.world.add_rigid_body(
        type,
        pos[0], pos[1], pos[2],
        rot[0], rot[1], rot[2], rot[3],
        physics.linearDrag,
        physics.angularDrag
    );

    physics._rapierId = id;
    this.rapierIdToEntity.set(id, entity);

    for (const collider of physics.colliders) {
        let shapeType = 0;
        const args: number[] = [];
        
        if (collider.shape === ColliderShape.Box) {
            shapeType = 0;
            args.push(collider.size[0] / 2);
            args.push(collider.size[1] / 2);
            args.push(collider.size[2] / 2);
        } else if (collider.shape === ColliderShape.Sphere) {
            shapeType = 1;
            args.push(collider.radius);
        } else if (collider.shape === ColliderShape.Capsule) {
            shapeType = 2;
            const halfHeight = (collider.height / 2) - collider.radius;
            args.push(collider.radius);
            args.push(Math.max(0, halfHeight));
        }

        const argsArray = new Float32Array(args);
        
        this.world.add_collider(
            id,
            shapeType,
            argsArray,
            physics.material.friction,
            physics.material.restitution,
            physics.mass,
            collider.isTrigger
        );
    }
  }
}
