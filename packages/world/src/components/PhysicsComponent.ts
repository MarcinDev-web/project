import { Component } from './Component';
import { registerComponent } from './registry';
import type { Vec3 } from '@engine/core/math';
import type { Mat3 } from '@engine/core/math';
import { quatToMatrix3 } from '@engine/core/math';
import { calculateInertiaTensor } from '../physics/inertia';

/**
 * Rigidbody types determine how physics affects the object
 */
export enum RigidbodyType {
  /** Static objects don't move but can collide with dynamic objects */
  Static = 'static',
  /** Dynamic objects are fully simulated with physics */
  Dynamic = 'dynamic',
  /** Kinematic objects can be moved programmatically but aren't affected by forces */
  Kinematic = 'kinematic',
}

/**
 * Collider shape types
 */
export enum ColliderShape {
  Box = 'box',
  Sphere = 'sphere',
  Capsule = 'capsule',
}

/**
 * Base collider interface
 */
export interface Collider {
  /** Shape type */
  shape: ColliderShape;
  /** Center offset relative to entity position */
  center: Vec3;
  /** Whether this collider triggers collision events without physical response */
  isTrigger: boolean;
  /** Friction coefficient (0 = frictionless, 1 = high friction) */
  friction: number;
  /** Bounciness/restitution (0 = no bounce, 1 = perfectly elastic) */
  restitution: number;
}

/**
 * Box collider with size dimensions
 */
export interface BoxCollider extends Collider {
  shape: ColliderShape.Box;
  /** Half extents (half width, half height, half depth) */
  size: Vec3;
}

/**
 * Sphere collider with radius
 */
export interface SphereCollider extends Collider {
  shape: ColliderShape.Sphere;
  /** Sphere radius */
  radius: number;
}

/**
 * Capsule collider with radius and height
 */
export interface CapsuleCollider extends Collider {
  shape: ColliderShape.Capsule;
  /** Capsule radius */
  radius: number;
  /** Total height including hemispheres */
  height: number;
}

/**
 * Union type for all collider types
 */
export type AnyCollider = BoxCollider | SphereCollider | CapsuleCollider;

/**
 * Contact point information for collision resolution
 */
export interface ContactPoint {
  /** World position of contact */
  position: Vec3;
  /** Contact normal pointing from A to B */
  normal: Vec3;
  /** Penetration depth */
  depth: number;
}

/**
 * Physics material properties
 */
export interface PhysicsMaterial {
  /** Friction coefficient */
  friction: number;
  /** Bounciness (restitution) */
  restitution: number;
  /** Density (for mass calculation) */
  density: number;
}

/**
 * Default physics material
 */
export const DEFAULT_PHYSICS_MATERIAL: PhysicsMaterial = {
  friction: 0.5,
  restitution: 0.3,
  density: 1.0,
};

/**
 * PhysicsComponent provides rigidbody simulation and collision detection.
 * Can be attached to entities to make them participate in physics simulation.
 */
export class PhysicsComponent extends Component {
  static readonly type = 'Physics';

  /** Rigidbody type */
  rigidbodyType: RigidbodyType = RigidbodyType.Dynamic;

  /** Mass in kilograms (ignored for static/kinematic) */
  mass: number = 1.0;

  /** Linear velocity [x, y, z] in units/second */
  velocity: Vec3 = [0, 0, 0];

  /** Angular velocity [x, y, z] in radians/second */
  angularVelocity: Vec3 = [0, 0, 0];

  /** Linear drag coefficient (air resistance) */
  linearDrag: number = 0.05;

  /** Angular drag coefficient (rotation damping) */
  angularDrag: number = 0.05;

  /** Whether gravity affects this rigidbody */
  useGravity: boolean = true;

  /** Whether the rigidbody is kinematic (not affected by forces) */
  isKinematic: boolean = false;

  /** Constraints on movement axes */
  freezePositionX: boolean = false;
  freezePositionY: boolean = false;
  freezePositionZ: boolean = false;

  /** Constraints on rotation axes */
  freezeRotationX: boolean = false;
  freezeRotationY: boolean = false;
  freezeRotationZ: boolean = false;

  /** Colliders attached to this physics body */
  colliders: AnyCollider[] = [];

  /** Physics material properties */
  material: PhysicsMaterial = { ...DEFAULT_PHYSICS_MATERIAL };

  /** Whether this body is awake (actively simulated) */
  private _isAwake: boolean = true;

  /** Sleep threshold - if velocity is below this, body may sleep */
  sleepThreshold: number = 0.01;

  /** Time body has been below sleep threshold */
  private _sleepTimer: number = 0;

  /** Accumulated forces to be applied this frame */
  private _accumulatedForce: Vec3 = [0, 0, 0];

  /** Accumulated torques to be applied this frame */
  private _accumulatedTorque: Vec3 = [0, 0, 0];

  /** Local-space inverse inertia tensor (diagonal) */
  private _inverseInertiaTensorLocal: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  /** Local-space inverse inertia tensor without freeze constraints (diagonal) */
  private _inverseInertiaTensorLocalBase: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  /** Flag indicating inertia needs recomputation */
  private _inertiaDirty: boolean = true;
  /** Cached values to detect changes */
  private _lastMassForInertia: number = this.mass;
  private _lastScaleForInertia: Vec3 | null = null;

  getType(): string {
    return PhysicsComponent.type;
  }

  /**
   * Adds a box collider to this physics body
   */
  addBoxCollider(size: Vec3, center: Vec3 = [0, 0, 0], isTrigger = false): BoxCollider {
    const collider: BoxCollider = {
      shape: ColliderShape.Box,
      size: [...size] as Vec3,
      center: [...center] as Vec3,
      isTrigger,
      friction: this.material.friction,
      restitution: this.material.restitution,
    };
    this.colliders.push(collider);
    this.markInertiaDirty();
    return collider;
  }

  /**
   * Adds a sphere collider to this physics body
   */
  addSphereCollider(radius: number, center: Vec3 = [0, 0, 0], isTrigger = false): SphereCollider {
    const collider: SphereCollider = {
      shape: ColliderShape.Sphere,
      radius,
      center: [...center] as Vec3,
      isTrigger,
      friction: this.material.friction,
      restitution: this.material.restitution,
    };
    this.colliders.push(collider);
    this.markInertiaDirty();
    return collider;
  }

  /**
   * Adds a capsule collider to this physics body
   */
  addCapsuleCollider(
    radius: number,
    height: number,
    center: Vec3 = [0, 0, 0],
    isTrigger = false
  ): CapsuleCollider {
    const collider: CapsuleCollider = {
      shape: ColliderShape.Capsule,
      radius,
      height,
      center: [...center] as Vec3,
      isTrigger,
      friction: this.material.friction,
      restitution: this.material.restitution,
    };
    this.colliders.push(collider);
    this.markInertiaDirty();
    return collider;
  }

  /**
   * Removes all colliders
   */
  clearColliders(): void {
    this.colliders = [];
    this.markInertiaDirty();
  }

  /**
   * Applies a force to the rigidbody
   */
  addForce(force: Vec3): void {
    if (this.rigidbodyType !== RigidbodyType.Dynamic) return;
    this._accumulatedForce[0] += force[0];
    this._accumulatedForce[1] += force[1];
    this._accumulatedForce[2] += force[2];
    this.wakeUp();
  }

  /**
   * Applies a torque to the rigidbody
   */
  addTorque(torque: Vec3): void {
    if (this.rigidbodyType !== RigidbodyType.Dynamic) return;
    this._accumulatedTorque[0] += torque[0];
    this._accumulatedTorque[1] += torque[1];
    this._accumulatedTorque[2] += torque[2];
    this.wakeUp();
  }

  /**
   * Applies an impulse (instantaneous velocity change)
   */
  addImpulse(impulse: Vec3): void {
    if (this.rigidbodyType !== RigidbodyType.Dynamic) return;
    const invMass = this.mass > 0 ? 1 / this.mass : 0;
    this.velocity[0] += impulse[0] * invMass;
    this.velocity[1] += impulse[1] * invMass;
    this.velocity[2] += impulse[2] * invMass;
    this.wakeUp();
  }

  /** Marks the inertia tensor as dirty (recomputed lazily). */
  markInertiaDirty(): void {
    this._inertiaDirty = true;
  }

  /** Ensures local inertia tensors are up-to-date with current mass, scale and colliders. */
  private ensureInertiaUpToDate(): void {
    if (this.rigidbodyType !== RigidbodyType.Dynamic) {
      // For non-dynamic bodies, keep zero inverse inertia
      this._inverseInertiaTensorLocal = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      this._inertiaDirty = false;
      return;
    }

    const scale = this.entity?.transform.scale ?? [1, 1, 1];
    const scaleChanged =
      !this._lastScaleForInertia ||
      this._lastScaleForInertia[0] !== scale[0] ||
      this._lastScaleForInertia[1] !== scale[1] ||
      this._lastScaleForInertia[2] !== scale[2];
    const massChanged = this._lastMassForInertia !== this.mass;

    if (!this._inertiaDirty && !scaleChanged && !massChanged) {
      // Still apply freeze toggles to the effective inverse tensor
      const base = this._inverseInertiaTensorLocalBase;
      const invLocal: Mat3 = [
        this.freezeRotationX ? 0 : base[0]!, 0, 0,
        0, this.freezeRotationY ? 0 : base[4]!, 0,
        0, 0, this.freezeRotationZ ? 0 : base[8]!,
      ];
      this._inverseInertiaTensorLocal = invLocal;
      return;
    }

    // Compute composite inertia as sum over colliders, mass split by volume
    const sx = scale[0];
    const sy = scale[1];
    const sz = scale[2];

    type Diag = { ixx: number; iyy: number; izz: number };
    const diagSum: Diag = { ixx: 0, iyy: 0, izz: 0 };

    const volumes: number[] = [];
    const calcVolume = (c: AnyCollider): number => {
      if (c.shape === ColliderShape.Box) {
        const w = (c as BoxCollider).size[0] * sx;
        const h = (c as BoxCollider).size[1] * sy;
        const d = (c as BoxCollider).size[2] * sz;
        return Math.max(0, w) * Math.max(0, h) * Math.max(0, d);
      }
      if (c.shape === ColliderShape.Sphere) {
        const r = (c as SphereCollider).radius * ((sx + sy + sz) / 3);
        return (4 / 3) * Math.PI * r * r * r;
      }
      // Capsule: height includes hemispheres; cylinder height = total - 2r
      const cap = c as CapsuleCollider;
      const r = cap.radius * Math.max(sx, sz);
      const totalH = cap.height * sy;
      const cylH = Math.max(0, totalH - 2 * r);
      return Math.PI * r * r * cylH + (4 / 3) * Math.PI * r * r * r;
    };

    let totalVolume = 0;
    for (const c of this.colliders) {
      const v = calcVolume(c);
      volumes.push(v);
      totalVolume += v;
    }

    // Fallback: no colliders -> approximate box from scale (unit cube scaled)
    if (this.colliders.length === 0 || totalVolume <= 0) {
      const w = Math.abs(sx);
      const h = Math.abs(sy);
      const d = Math.abs(sz);
      const I = calculateInertiaTensor({ type: 'box', size: [w, h, d] }, this.mass);
      diagSum.ixx += I[0];
      diagSum.iyy += I[4];
      diagSum.izz += I[8];
    } else {
      // Sum collider contributions with parallel axis correction
      for (let i = 0; i < this.colliders.length; i++) {
        const c = this.colliders[i]!;
        const m_i = (volumes[i]! / totalVolume) * this.mass;

        let I_local: Mat3;
        if (c.shape === ColliderShape.Box) {
          const b = c as BoxCollider;
          const size: Vec3 = [b.size[0] * sx, b.size[1] * sy, b.size[2] * sz];
          I_local = calculateInertiaTensor({ type: 'box', size }, m_i);
        } else if (c.shape === ColliderShape.Sphere) {
          const s = c as SphereCollider;
          const r = s.radius * ((sx + sy + sz) / 3);
          I_local = calculateInertiaTensor({ type: 'sphere', radius: r }, m_i);
        } else {
          const k = c as CapsuleCollider;
          const r = k.radius * Math.max(sx, sz);
          const totalH = k.height * sy;
          const cylH = Math.max(0, totalH - 2 * r);
          I_local = calculateInertiaTensor({ type: 'capsule', radius: r, height: cylH }, m_i);
        }

        // Parallel axis theorem for offset center
        const rcx = (c.center[0] ?? 0) * sx;
        const rcy = (c.center[1] ?? 0) * sy;
        const rcz = (c.center[2] ?? 0) * sz;
        const dxx = m_i * (rcy * rcy + rcz * rcz);
        const dyy = m_i * (rcx * rcx + rcz * rcz);
        const dzz = m_i * (rcx * rcx + rcy * rcy);

        diagSum.ixx += I_local[0] + dxx;
        diagSum.iyy += I_local[4] + dyy;
        diagSum.izz += I_local[8] + dzz;
      }
    }

    // Build diagonal local tensors and inverse
    const ixx = diagSum.ixx;
    const iyy = diagSum.iyy;
    const izz = diagSum.izz;

    // Local-space inertia tensor not currently used; only inverse is needed

    const invIxx = ixx > 0 ? 1 / ixx : 0;
    const invIyy = iyy > 0 ? 1 / iyy : 0;
    const invIzz = izz > 0 ? 1 / izz : 0;

    // Apply rotation freeze constraints by zeroing inverse along frozen axes at local level
    // Store base (unfrozen) inverse diag and compute effective inverse applying freeze
    this._inverseInertiaTensorLocalBase = [invIxx, 0, 0, 0, invIyy, 0, 0, 0, invIzz];
    const invLocal: Mat3 = [
      this.freezeRotationX ? 0 : invIxx, 0, 0,
      0, this.freezeRotationY ? 0 : invIyy, 0,
      0, 0, this.freezeRotationZ ? 0 : invIzz,
    ];
    this._inverseInertiaTensorLocal = invLocal;

    this._inertiaDirty = false;
    this._lastMassForInertia = this.mass;
    this._lastScaleForInertia = [sx, sy, sz];
  }

  /** Returns the world-space inverse inertia tensor Mat3 for the current rotation. */
  getWorldInverseInertiaTensor(): Mat3 {
    this.ensureInertiaUpToDate();
    const rotation = this.entity?.transform.rotation ?? [0, 0, 0, 1];
    const R = quatToMatrix3(rotation);
    // Columns of R (column-major)
    const c0: Vec3 = [R[0]!, R[1]!, R[2]!];
    const c1: Vec3 = [R[3]!, R[4]!, R[5]!];
    const c2: Vec3 = [R[6]!, R[7]!, R[8]!];

    const d0 = this._inverseInertiaTensorLocal[0]!;
    const d1 = this._inverseInertiaTensorLocal[4]!;
    const d2 = this._inverseInertiaTensorLocal[8]!;

    // W = R * diag(d) * R^T => sum_k d_k * c_k c_k^T
    const w00 = d0 * c0[0]! * c0[0]! + d1 * c1[0]! * c1[0]! + d2 * c2[0]! * c2[0]!;
    const w01 = d0 * c0[0]! * c0[1]! + d1 * c1[0]! * c1[1]! + d2 * c2[0]! * c2[1]!;
    const w02 = d0 * c0[0]! * c0[2]! + d1 * c1[0]! * c1[2]! + d2 * c2[0]! * c2[2]!;

    const w10 = d0 * c0[1]! * c0[0]! + d1 * c1[1]! * c1[0]! + d2 * c2[1]! * c2[0]!;
    const w11 = d0 * c0[1]! * c0[1]! + d1 * c1[1]! * c1[1]! + d2 * c2[1]! * c2[1]!;
    const w12 = d0 * c0[1]! * c0[2]! + d1 * c1[1]! * c1[2]! + d2 * c2[1]! * c2[2]!;

    const w20 = d0 * c0[2]! * c0[0]! + d1 * c1[2]! * c1[0]! + d2 * c2[2]! * c2[0]!;
    const w21 = d0 * c0[2]! * c0[1]! + d1 * c1[2]! * c1[1]! + d2 * c2[2]! * c2[1]!;
    const w22 = d0 * c0[2]! * c0[2]! + d1 * c1[2]! * c1[2]! + d2 * c2[2]! * c2[2]!;

    return [
      w00, w10, w20,
      w01, w11, w21,
      w02, w12, w22,
    ];
  }

  /**
   * Gets accumulated force and clears it
   */
  consumeForce(): Vec3 {
    const force = [...this._accumulatedForce] as Vec3;
    this._accumulatedForce = [0, 0, 0];
    return force;
  }

  /**
   * Gets accumulated torque and clears it
   */
  consumeTorque(): Vec3 {
    const torque = [...this._accumulatedTorque] as Vec3;
    this._accumulatedTorque = [0, 0, 0];
    return torque;
  }

  /**
   * Wakes up the rigidbody (makes it active)
   */
  wakeUp(): void {
    this._isAwake = true;
    this._sleepTimer = 0;
  }

  /**
   * Puts the rigidbody to sleep (stops simulation)
   */
  sleep(): void {
    this._isAwake = false;
    this.velocity = [0, 0, 0];
    this.angularVelocity = [0, 0, 0];
  }

  /**
   * Checks if rigidbody is awake
   */
  isAwake(): boolean {
    return this._isAwake;
  }

  /**
   * Updates sleep state based on velocity
   */
  updateSleepState(deltaTime: number): void {
    if (this.rigidbodyType !== RigidbodyType.Dynamic) {
      this._isAwake = false;
      return;
    }

    const velMagnitude = Math.sqrt(
      this.velocity[0] ** 2 + this.velocity[1] ** 2 + this.velocity[2] ** 2
    );

    if (velMagnitude < this.sleepThreshold) {
      this._sleepTimer += deltaTime;
      // Sleep after 1 second of low velocity
      if (this._sleepTimer > 1.0) {
        this.sleep();
      }
    } else {
      this._sleepTimer = 0;
      this._isAwake = true;
    }
  }

  /**
   * Gets the inverse mass (0 for static/kinematic bodies)
   */
  getInverseMass(): number {
    if (this.rigidbodyType !== RigidbodyType.Dynamic || this.mass <= 0) {
      return 0;
    }
    return 1 / this.mass;
  }

  clone(): PhysicsComponent {
    const clone = new PhysicsComponent();
    clone.rigidbodyType = this.rigidbodyType;
    clone.mass = this.mass;
    clone.velocity = [...this.velocity] as Vec3;
    clone.angularVelocity = [...this.angularVelocity] as Vec3;
    clone.linearDrag = this.linearDrag;
    clone.angularDrag = this.angularDrag;
    clone.useGravity = this.useGravity;
    clone.isKinematic = this.isKinematic;
    clone.freezePositionX = this.freezePositionX;
    clone.freezePositionY = this.freezePositionY;
    clone.freezePositionZ = this.freezePositionZ;
    clone.freezeRotationX = this.freezeRotationX;
    clone.freezeRotationY = this.freezeRotationY;
    clone.freezeRotationZ = this.freezeRotationZ;
    clone.colliders = this.colliders.map((c) => ({ ...c, center: [...c.center] as Vec3 }));
    clone.material = { ...this.material };
    clone.sleepThreshold = this.sleepThreshold;
    return clone;
  }

  toJSON(): Record<string, unknown> {
    return {
      rigidbodyType: this.rigidbodyType,
      mass: this.mass,
      velocity: [...this.velocity],
      angularVelocity: [...this.angularVelocity],
      linearDrag: this.linearDrag,
      angularDrag: this.angularDrag,
      useGravity: this.useGravity,
      isKinematic: this.isKinematic,
      freezePositionX: this.freezePositionX,
      freezePositionY: this.freezePositionY,
      freezePositionZ: this.freezePositionZ,
      freezeRotationX: this.freezeRotationX,
      freezeRotationY: this.freezeRotationY,
      freezeRotationZ: this.freezeRotationZ,
      colliders: this.colliders.map((c) => ({
        ...c,
        center: [...c.center],
      })),
      material: { ...this.material },
      sleepThreshold: this.sleepThreshold,
    };
  }

  fromJSON(data: Record<string, unknown>): void {
    if (typeof data.rigidbodyType === 'string') {
      this.rigidbodyType = data.rigidbodyType as RigidbodyType;
    }
    if (typeof data.mass === 'number') this.mass = data.mass;
    if (Array.isArray(data.velocity) && data.velocity.length === 3) {
      this.velocity = [...data.velocity] as Vec3;
    }
    if (Array.isArray(data.angularVelocity) && data.angularVelocity.length === 3) {
      this.angularVelocity = [...data.angularVelocity] as Vec3;
    }
    if (typeof data.linearDrag === 'number') this.linearDrag = data.linearDrag;
    if (typeof data.angularDrag === 'number') this.angularDrag = data.angularDrag;
    if (typeof data.useGravity === 'boolean') this.useGravity = data.useGravity;
    if (typeof data.isKinematic === 'boolean') this.isKinematic = data.isKinematic;
    if (typeof data.freezePositionX === 'boolean') this.freezePositionX = data.freezePositionX;
    if (typeof data.freezePositionY === 'boolean') this.freezePositionY = data.freezePositionY;
    if (typeof data.freezePositionZ === 'boolean') this.freezePositionZ = data.freezePositionZ;
    if (typeof data.freezeRotationX === 'boolean') this.freezeRotationX = data.freezeRotationX;
    if (typeof data.freezeRotationY === 'boolean') this.freezeRotationY = data.freezeRotationY;
    if (typeof data.freezeRotationZ === 'boolean') this.freezeRotationZ = data.freezeRotationZ;
    if (Array.isArray(data.colliders)) {
      this.colliders = data.colliders as AnyCollider[];
    }
    if (data.material && typeof data.material === 'object') {
      this.material = data.material as PhysicsMaterial;
    }
    if (typeof data.sleepThreshold === 'number') this.sleepThreshold = data.sleepThreshold;
  }
}

registerComponent(PhysicsComponent.type, PhysicsComponent);