/**
 * PhysicsWorld - High-level API for physics simulation
 * Provides easy integration with the scene and entity system
 */
import { PhysicsSystem } from './PhysicsSystem';
import { Entity } from '../core/Entity';
import { PhysicsComponent, RigidbodyType } from '../components/PhysicsComponent';
import { Logger } from '@engine/core/utils';
import { JointComponent } from '../components/JointComponent';
import { createJoint, JointType, } from './Joint';
import { PhysicsRaycast } from './PhysicsRaycast';
/**
 * PhysicsWorld manages physics simulation for a scene
 */
export class PhysicsWorld {
    system;
    scene;
    isRunning = false;
    constructor(scene, config) {
        this.scene = scene;
        this.system = new PhysicsSystem(scene, config);
        const runtime = scene.scriptRuntime;
        if (runtime) {
            runtime.physicsWorld = this;
        }
    }
    /**
     * Starts the physics simulation
     */
    start() {
        this.isRunning = true;
    }
    /**
     * Stops the physics simulation
     */
    stop() {
        this.isRunning = false;
    }
    /**
     * Pauses the physics simulation
     */
    pause() {
        this.isRunning = false;
    }
    /**
     * Resumes the physics simulation
     */
    resume() {
        this.isRunning = true;
    }
    /**
     * Updates the physics simulation (call this in your game loop)
     */
    update(deltaTime) {
        if (!this.isRunning)
            return;
        this.system.update(deltaTime);
    }
    /**
     * Adds physics to an entity with default settings
     */
    addPhysics(entity, options = {}) {
        // Check if entity already has physics
        let physics = entity.getComponent(PhysicsComponent);
        if (physics) {
            Logger.warn(`Entity ${entity.name} already has PhysicsComponent`);
            return physics;
        }
        // Create new physics component
        physics = new PhysicsComponent();
        physics.rigidbodyType = options.type ?? RigidbodyType.Dynamic;
        physics.mass = options.mass ?? 1.0;
        physics.useGravity = options.useGravity ?? true;
        // Add default collider based on entity's mesh
        const colliderType = options.collider ?? 'box';
        const scale = entity.transform.scale;
        if (colliderType === 'box') {
            physics.addBoxCollider([scale[0], scale[1], scale[2]]);
        }
        else if (colliderType === 'sphere') {
            const radius = Math.max(scale[0], scale[1], scale[2]) / 2;
            physics.addSphereCollider(radius);
        }
        else if (colliderType === 'capsule') {
            const radius = Math.max(scale[0], scale[2]) / 2;
            const height = scale[1];
            physics.addCapsuleCollider(radius, height);
        }
        entity.addComponent(physics);
        return physics;
    }
    /**
     * Removes physics from an entity
     */
    removePhysics(entity) {
        entity.removeComponent(PhysicsComponent);
    }
    /**
     * Applies a force to an entity
     */
    applyForce(entity, force) {
        const physics = entity.getComponent(PhysicsComponent);
        if (physics) {
            physics.addForce(force);
        }
    }
    /**
     * Applies an impulse to an entity (instantaneous velocity change)
     */
    applyImpulse(entity, impulse) {
        const physics = entity.getComponent(PhysicsComponent);
        if (physics) {
            physics.addImpulse(impulse);
        }
    }
    /**
     * Applies a torque to an entity (rotational force)
     */
    applyTorque(entity, torque) {
        const physics = entity.getComponent(PhysicsComponent);
        if (physics) {
            physics.addTorque(torque);
        }
    }
    /**
     * Sets the velocity of an entity
     */
    setVelocity(entity, velocity) {
        const physics = entity.getComponent(PhysicsComponent);
        if (physics) {
            physics.velocity = [...velocity];
            physics.wakeUp();
        }
    }
    /**
     * Gets the velocity of an entity
     */
    getVelocity(entity) {
        const physics = entity.getComponent(PhysicsComponent);
        return physics ? [...physics.velocity] : null;
    }
    /**
     * Sets the angular velocity of an entity
     */
    setAngularVelocity(entity, angularVelocity) {
        const physics = entity.getComponent(PhysicsComponent);
        if (physics) {
            physics.angularVelocity = [...angularVelocity];
            physics.wakeUp();
        }
    }
    /**
     * Gets the angular velocity of an entity
     */
    getAngularVelocity(entity) {
        const physics = entity.getComponent(PhysicsComponent);
        return physics ? [...physics.angularVelocity] : null;
    }
    /**
     * Wakes up a sleeping rigidbody
     */
    wakeUp(entity) {
        const physics = entity.getComponent(PhysicsComponent);
        if (physics) {
            physics.wakeUp();
        }
    }
    /**
     * Puts a rigidbody to sleep
     */
    sleep(entity) {
        const physics = entity.getComponent(PhysicsComponent);
        if (physics) {
            physics.sleep();
        }
    }
    /**
     * Checks if an entity is awake
     */
    isAwake(entity) {
        const physics = entity.getComponent(PhysicsComponent);
        return physics ? physics.isAwake() : false;
    }
    /**
     * Sets the gravity for the physics world
     */
    setGravity(gravity) {
        this.system.setGravity(gravity);
    }
    /**
     * Gets the current gravity
     */
    getGravity() {
        return this.system.getGravity();
    }
    /**
     * Updates the physics configuration
     */
    setConfig(config) {
        this.system.setConfig(config);
    }
    /**
     * Gets the current physics configuration
     */
    getConfig() {
        return this.system.getConfig();
    }
    /**
     * Registers a collision event listener
     */
    onCollision(listener) {
        this.system.onCollision(listener);
    }
    /**
     * Registers a trigger enter event listener
     */
    onTriggerEnter(listener) {
        this.system.onTriggerEnter(listener);
    }
    /**
     * Registers a trigger exit event listener
     */
    onTriggerExit(listener) {
        this.system.onTriggerExit(listener);
    }
    /**
     * Removes a collision event listener
     */
    removeCollisionListener(listener) {
        this.system.removeCollisionListener(listener);
    }
    /**
     * Gets all entities with physics components
     */
    getPhysicsEntities() {
        return this.scene.queryEntities(PhysicsComponent);
    }
    /**
     * Gets the underlying physics system (for advanced usage)
     */
    getSystem() {
        return this.system;
    }
    /**
     * Gets octree statistics (if spatial partitioning is enabled)
     */
    getOctreeStats() {
        return this.system.getOctreeStats();
    }
    /**
     * Forces a rebuild of the spatial partitioning octree
     */
    rebuildOctree() {
        this.system.rebuildOctree();
    }
    /**
     * Enables or disables spatial partitioning
     */
    setSpatialPartitioning(enabled) {
        this.system.setSpatialPartitioning(enabled);
    }
    /**
     * Helper: Creates a dynamic box
     */
    static createDynamicBox(scene, position, size, mass = 1.0) {
        const entity = new Entity('DynamicBox');
        entity.transform.position = [...position];
        entity.transform.scale = [...size];
        const physics = new PhysicsComponent();
        physics.rigidbodyType = RigidbodyType.Dynamic;
        physics.mass = mass;
        physics.useGravity = true;
        physics.addBoxCollider([size[0], size[1], size[2]]);
        entity.addComponent(physics);
        scene.addEntity(entity);
        return entity;
    }
    // ========== Joint Management ==========
    /**
     * Creates and adds a joint to connect two entities
     */
    addJoint(config) {
        const joint = createJoint(config);
        // Ensure both entities have JointComponents
        let jointCompA = config.entityA.getComponent(JointComponent);
        if (!jointCompA) {
            jointCompA = new JointComponent();
            config.entityA.addComponent(jointCompA);
        }
        let jointCompB = config.entityB.getComponent(JointComponent);
        if (!jointCompB) {
            jointCompB = new JointComponent();
            config.entityB.addComponent(jointCompB);
        }
        // Add joint to both entities
        jointCompA.addJoint(joint);
        jointCompB.addJoint(joint);
        return joint;
    }
    /**
     * Removes a joint from the simulation
     */
    removeJoint(joint) {
        const jointCompA = joint.config.entityA.getComponent(JointComponent);
        const jointCompB = joint.config.entityB.getComponent(JointComponent);
        if (jointCompA) {
            jointCompA.removeJoint(joint);
        }
        if (jointCompB) {
            jointCompB.removeJoint(joint);
        }
    }
    /**
     * Gets all joints in the physics world
     */
    getAllJoints() {
        return this.system.getAllJoints();
    }
    /**
     * Creates a fixed joint between two entities
     */
    addFixedJoint(entityA, entityB, localAnchorA = [0, 0, 0], localAnchorB = [0, 0, 0], options = {}) {
        const config = {
            type: JointType.Fixed,
            entityA,
            entityB,
            localAnchorA,
            localAnchorB,
            ...options,
        };
        return this.addJoint(config);
    }
    /**
     * Creates a distance joint between two entities
     */
    addDistanceJoint(entityA, entityB, distance, localAnchorA = [0, 0, 0], localAnchorB = [0, 0, 0], options = {}) {
        const config = {
            type: JointType.Distance,
            entityA,
            entityB,
            localAnchorA,
            localAnchorB,
            distance,
            ...options,
        };
        return this.addJoint(config);
    }
    /**
     * Creates a spring joint between two entities
     */
    addSpringJoint(entityA, entityB, restLength, stiffness, damping, localAnchorA = [0, 0, 0], localAnchorB = [0, 0, 0], options = {}) {
        const config = {
            type: JointType.Spring,
            entityA,
            entityB,
            localAnchorA,
            localAnchorB,
            restLength,
            stiffness,
            damping,
            ...options,
        };
        return this.addJoint(config);
    }
    /**
     * Creates a hinge joint between two entities
     */
    addHingeJoint(entityA, entityB, axisA, axisB, localAnchorA = [0, 0, 0], localAnchorB = [0, 0, 0], options = {}) {
        const config = {
            type: JointType.Hinge,
            entityA,
            entityB,
            localAnchorA,
            localAnchorB,
            axisA,
            axisB,
            ...options,
        };
        return this.addJoint(config);
    }
    /**
     * Creates a ball socket joint between two entities
     */
    addBallSocketJoint(entityA, entityB, localAnchorA = [0, 0, 0], localAnchorB = [0, 0, 0], options = {}) {
        const config = {
            type: JointType.BallSocket,
            entityA,
            entityB,
            localAnchorA,
            localAnchorB,
            ...options,
        };
        return this.addJoint(config);
    }
    /**
     * Creates a slider joint between two entities
     */
    addSliderJoint(entityA, entityB, axisA, axisB, localAnchorA = [0, 0, 0], localAnchorB = [0, 0, 0], options = {}) {
        const config = {
            type: JointType.Slider,
            entityA,
            entityB,
            localAnchorA,
            localAnchorB,
            axisA,
            axisB,
            ...options,
        };
        return this.addJoint(config);
    }
    // ========== Physics Raycasting ==========
    /**
     * Casts a ray and returns the first hit
     */
    raycast(origin, direction, options = {}) {
        const ray = {
            origin,
            direction: this.normalizeDirection(direction),
            ...(options.maxDistance !== undefined && { maxDistance: options.maxDistance }),
        };
        const entities = this.scene.queryEntities(PhysicsComponent);
        let closestHit = null;
        for (const entity of entities) {
            // Skip ignored entities
            if (options.ignoreEntities && options.ignoreEntities.includes(entity)) {
                continue;
            }
            const hit = PhysicsRaycast.raycastEntity(ray, entity, options.hitTriggers ?? false);
            if (hit && (!closestHit || hit.distance < closestHit.distance)) {
                closestHit = hit;
            }
        }
        return closestHit;
    }
    /**
     * Casts a ray and returns all hits
     */
    raycastAll(origin, direction, options = {}) {
        const ray = {
            origin,
            direction: this.normalizeDirection(direction),
            ...(options.maxDistance !== undefined && { maxDistance: options.maxDistance }),
        };
        const entities = this.scene.queryEntities(PhysicsComponent);
        const hits = [];
        for (const entity of entities) {
            // Skip ignored entities
            if (options.ignoreEntities && options.ignoreEntities.includes(entity)) {
                continue;
            }
            const hit = PhysicsRaycast.raycastEntity(ray, entity, options.hitTriggers ?? false);
            if (hit) {
                hits.push(hit);
            }
        }
        // Sort by distance
        hits.sort((a, b) => a.distance - b.distance);
        return hits;
    }
    /**
     * Creates a ray from origin and direction
     */
    createRay(origin, direction, maxDistance) {
        return {
            origin: [...origin],
            direction: this.normalizeDirection(direction),
            ...(maxDistance !== undefined && { maxDistance }),
        };
    }
    /**
     * Helper to normalize direction vector
     */
    normalizeDirection(direction) {
        const length = Math.sqrt(direction[0] * direction[0] +
            direction[1] * direction[1] +
            direction[2] * direction[2]);
        if (length < 1e-6) {
            return [0, 0, 1]; // Default direction
        }
        return [
            direction[0] / length,
            direction[1] / length,
            direction[2] / length,
        ];
    }
    // ========== Static Helper Methods ==========
    /**
     * Helper: Creates a static floor
     */
    static createStaticFloor(scene, position, size) {
        const entity = new Entity('StaticFloor');
        entity.transform.position = [...position];
        entity.transform.scale = [...size];
        const physics = new PhysicsComponent();
        physics.rigidbodyType = RigidbodyType.Static;
        physics.useGravity = false;
        physics.addBoxCollider([size[0], size[1], size[2]]);
        entity.addComponent(physics);
        scene.addEntity(entity);
        return entity;
    }
    /**
     * Helper: Creates a dynamic sphere
     */
    static createDynamicSphere(scene, position, radius, mass = 1.0) {
        const entity = new Entity('DynamicSphere');
        entity.transform.position = [...position];
        entity.transform.scale = [radius * 2, radius * 2, radius * 2];
        const physics = new PhysicsComponent();
        physics.rigidbodyType = RigidbodyType.Dynamic;
        physics.mass = mass;
        physics.useGravity = true;
        physics.addSphereCollider(radius);
        entity.addComponent(physics);
        scene.addEntity(entity);
        return entity;
    }
    /**
     * Helper: Creates a kinematic platform
     */
    static createKinematicPlatform(scene, position, size) {
        const entity = new Entity('KinematicPlatform');
        entity.transform.position = [...position];
        entity.transform.scale = [...size];
        const physics = new PhysicsComponent();
        physics.rigidbodyType = RigidbodyType.Kinematic;
        physics.useGravity = false;
        physics.addBoxCollider([size[0], size[1], size[2]]);
        entity.addComponent(physics);
        scene.addEntity(entity);
        return entity;
    }
}
/**
 * Export main physics components and types
 */
export { PhysicsComponent, PhysicsSystem, RigidbodyType, JointComponent, JointType, PhysicsRaycast };
//# sourceMappingURL=PhysicsWorld.js.map