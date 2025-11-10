import {
  mat4FromQuatTranslation,
  quatMultiplyOut,
  quatNormalizeOut,
  type Mat4,
  type Quat,
  type Vec3,
} from '@engine/core/math';
import { getVec3Pool } from '@engine/core/utils/Vec3Pool';

export type AvatarJointName =
  | 'Root'
  | 'Hips'
  | 'Spine'
  | 'Chest'
  | 'Neck'
  | 'Head'
  | 'Arm.L.Upper'
  | 'Arm.L.Lower'
  | 'Hand.L'
  | 'Arm.R.Upper'
  | 'Arm.R.Lower'
  | 'Hand.R'
  | 'Leg.L.Upper'
  | 'Leg.L.Lower'
  | 'Foot.L'
  | 'Leg.R.Upper'
  | 'Leg.R.Lower'
  | 'Foot.R';

export interface AvatarJointDefinition {
  name: AvatarJointName;
  parent: AvatarJointName | null;
  defaultPosition: Vec3;
  defaultRotation?: Quat;
}

export interface AvatarJointTransform {
  position: Vec3;
  rotation: Quat;
}

type MutableVec3 = [number, number, number];
type MutableQuat = [number, number, number, number];

interface AvatarJointState {
  readonly name: AvatarJointName;
  readonly parentIndex: number | null;
  readonly defaultPosition: Vec3;
  readonly defaultRotation: Quat;
  readonly localPosition: MutableVec3;
  readonly localRotation: MutableQuat;
  readonly worldPosition: MutableVec3;
  readonly worldRotation: MutableQuat;
  readonly worldMatrix: Mat4;
}

const IDENTITY_QUAT: Quat = [0, 0, 0, 1];

const TMP_ROTATED: MutableVec3 = [0, 0, 0];

/**
 * Base humanoid skeleton used across runtime/editor.
 * Positions are authored for a ~1.8 unit tall character.
 *
 * BODY PROPORTIONS / UNIT SCALE:
 * ===============================
 * When accounting for bone offsets and hierarchy, the full character proportions are:
 * 
 * - Head:       ~0.56 units height
 * - Neck:       ~0.4  units height
 * - Torso:      ~1.1  units height (Hips → Spine → Chest)
 * - Upper Leg:  ~0.84 units height
 * - Lower Leg:  ~0.8  units height
 * - Foot:       ~0.24 units height
 * 
 * Total character height: ~1.7–1.9 units (~1.8m human-like "heroic" scale)
 * 
 * CRITICAL BALANCING INFO:
 * ========================
 * This scale is used for:
 * - Collision capsule height/radius
 * - Ladder climb height requirements
 * - Head camera offset (first/third person)
 * - Animation retargeting
 * - Environmental scale (doors, stairs, platforms)
 * 
 * DO NOT change these proportions without updating:
 * - Character controller capsule dimensions
 * - Camera offset constants
 * - Level design metrics (step height, door height, etc.)
 */
export const DEFAULT_AVATAR_JOINTS: readonly AvatarJointDefinition[] = [
  { name: 'Root', parent: null, defaultPosition: [0, 0, 0] },
  { name: 'Hips', parent: 'Root', defaultPosition: [0, 0.9, 0] },
  { name: 'Spine', parent: 'Hips', defaultPosition: [0, 0.2, 0] },
  { name: 'Chest', parent: 'Spine', defaultPosition: [0, 0.25, 0] },
  { name: 'Neck', parent: 'Chest', defaultPosition: [0, 0.2, 0] },
  { name: 'Head', parent: 'Neck', defaultPosition: [0, 0.25, 0] },
  { name: 'Arm.L.Upper', parent: 'Chest', defaultPosition: [0.35, 0.1, 0] },
  { name: 'Arm.L.Lower', parent: 'Arm.L.Upper', defaultPosition: [0, -0.45, 0] },
  { name: 'Hand.L', parent: 'Arm.L.Lower', defaultPosition: [0, -0.35, 0] },
  { name: 'Arm.R.Upper', parent: 'Chest', defaultPosition: [-0.35, 0.1, 0] },
  { name: 'Arm.R.Lower', parent: 'Arm.R.Upper', defaultPosition: [0, -0.45, 0] },
  { name: 'Hand.R', parent: 'Arm.R.Lower', defaultPosition: [0, -0.35, 0] },
  { name: 'Leg.L.Upper', parent: 'Hips', defaultPosition: [0.18, -0.45, 0] },
  { name: 'Leg.L.Lower', parent: 'Leg.L.Upper', defaultPosition: [0, -0.45, 0] },
  { name: 'Foot.L', parent: 'Leg.L.Lower', defaultPosition: [0, -0.05, 0.1] },
  { name: 'Leg.R.Upper', parent: 'Hips', defaultPosition: [-0.18, -0.45, 0] },
  { name: 'Leg.R.Lower', parent: 'Leg.R.Upper', defaultPosition: [0, -0.45, 0] },
  { name: 'Foot.R', parent: 'Leg.R.Lower', defaultPosition: [0, -0.05, 0.1] },
] as const;

/**
 * Joint hierarchy with cached transforms.
 */
export class AvatarSkeleton {
  private readonly joints: AvatarJointState[];
  private readonly nameToIndex: Map<AvatarJointName, number>;
  private readonly jointNames: AvatarJointName[];
  private worldDirty = true;
  private readonly jointDirty: boolean[];

  constructor(definitions: readonly AvatarJointDefinition[] = DEFAULT_AVATAR_JOINTS) {
    if (definitions.length === 0) {
      throw new Error('AvatarSkeleton requires at least one joint definition');
    }
    this.nameToIndex = new Map();
    this.jointNames = definitions.map((def) => def.name);
    this.jointDirty = new Array(definitions.length).fill(true); // All joints dirty initially
    this.joints = definitions.map((definition, index) => {
      if (this.nameToIndex.has(definition.name)) {
        throw new Error(`Duplicate joint name "${definition.name}"`);
      }
      const parentIndex =
        definition.parent === null ? null : this.nameToIndex.get(definition.parent) ?? null;
      if (definition.parent && parentIndex === null) {
        throw new Error(`Unknown parent joint "${definition.parent}" for "${definition.name}"`);
      }
      this.nameToIndex.set(definition.name, index);
      const defaultRotation = normalizeQuat(definition.defaultRotation ?? IDENTITY_QUAT);
      return {
        name: definition.name,
        parentIndex,
        defaultPosition: [...definition.defaultPosition] as Vec3,
        defaultRotation,
        localPosition: [...definition.defaultPosition] as MutableVec3,
        localRotation: [...defaultRotation] as MutableQuat,
        worldPosition: [0, 0, 0],
        worldRotation: [0, 0, 0, 1],
        worldMatrix: new Float32Array(16),
      } satisfies AvatarJointState;
    });
    this.resetPose();
  }

  resetPose(): void {
    for (const joint of this.joints) {
      copyVec3(joint.localPosition, joint.defaultPosition);
      copyQuat(joint.localRotation, joint.defaultRotation);
    }
    this.markAllDirty();
  }

  /**
   * Mark all joints as dirty (for full sync).
   */
  markAllDirty(): void {
    this.worldDirty = true;
    for (let i = 0; i < this.jointDirty.length; i++) {
      this.jointDirty[i] = true;
    }
  }

  /**
   * Check if a joint is dirty.
   */
  isJointDirty(name: AvatarJointName): boolean {
    const index = this.nameToIndex.get(name);
    if (index === undefined) {
      return false;
    }
    return this.jointDirty[index] ?? false;
  }

  /**
   * Mark a joint as clean (not dirty).
   */
  markJointClean(name: AvatarJointName): void {
    const index = this.nameToIndex.get(name);
    if (index !== undefined) {
      this.jointDirty[index] = false;
    }
  }

  /**
   * Get all dirty joint names.
   */
  getDirtyJoints(): readonly AvatarJointName[] {
    const dirty: AvatarJointName[] = [];
    for (let i = 0; i < this.jointDirty.length; i++) {
      if (this.jointDirty[i]) {
        const joint = this.joints[i];
        if (joint) {
          dirty.push(joint.name);
        }
      }
    }
    return dirty;
  }

  getJointNames(): readonly AvatarJointName[] {
    return this.jointNames;
  }

  getParent(name: AvatarJointName): AvatarJointName | null {
    const joint = this.getJoint(name);
    if (joint.parentIndex === null) {
      return null;
    }
    const parent = this.joints[joint.parentIndex];
    if (!parent) {
      throw new Error(`Parent joint missing for "${name}"`);
    }
    return parent.name;
  }

  /**
   * Get local transform (position and rotation) for a joint.
   * 
   * Returns pooled Vec3/Quat that may be reused. If you need to keep the values
   * long-term, clone them immediately after calling this method.
   * 
   * @param name - Joint name
   * @returns Transform with pooled Vec3/Quat (clone if keeping long-term)
   */
  getLocalTransform(name: AvatarJointName): AvatarJointTransform {
    const joint = this.getJoint(name);
    const pool = getVec3Pool();
    const position = pool.acquire();
    position[0] = joint.localPosition[0];
    position[1] = joint.localPosition[1];
    position[2] = joint.localPosition[2];
    return {
      position,
      rotation: [...joint.localRotation],
    };
  }

  setLocalPosition(name: AvatarJointName, position: Vec3): void {
    const joint = this.getJoint(name);
    copyVec3(joint.localPosition, position);
    this.markJointDirty(name);
  }

  setLocalRotation(name: AvatarJointName, rotation: Quat): void {
    const joint = this.getJoint(name);
    copyQuat(joint.localRotation, normalizeQuat(rotation));
    this.markJointDirty(name);
  }

  applyLocalPose(pose: Partial<Record<AvatarJointName, Partial<AvatarJointTransform>>>): void {
    for (const [key, transform] of Object.entries(pose)) {
      const jointName = key as AvatarJointName;
      if (!this.nameToIndex.has(jointName) || !transform) {
        continue;
      }
      if (transform.position) {
        this.setLocalPosition(jointName, transform.position);
      }
      if (transform.rotation) {
        this.setLocalRotation(jointName, transform.rotation);
      }
    }
  }

  /**
   * Get world transform (position and rotation) for a joint.
   * 
   * Returns pooled Vec3/Quat that may be reused. If you need to keep the values
   * long-term, clone them immediately after calling this method.
   * 
   * @param name - Joint name
   * @returns Transform with pooled Vec3/Quat (clone if keeping long-term)
   */
  getWorldTransform(name: AvatarJointName): AvatarJointTransform {
    const joint = this.getJoint(name);
    this.updateWorldTransforms();
    const pool = getVec3Pool();
    const position = pool.acquire();
    position[0] = joint.worldPosition[0];
    position[1] = joint.worldPosition[1];
    position[2] = joint.worldPosition[2];
    return {
      position,
      rotation: [...joint.worldRotation],
    };
  }

  getWorldMatrix(name: AvatarJointName, out?: Mat4): Mat4 {
    const joint = this.getJoint(name);
    this.updateWorldTransforms();
    if (out) {
      out.set(joint.worldMatrix);
      return out;
    }
    const matrix = new Float32Array(16);
    matrix.set(joint.worldMatrix);
    return matrix;
  }

  forEachJoint(callback: (name: AvatarJointName, parent: AvatarJointName | null) => void): void {
    for (const joint of this.joints) {
      const parentName =
        joint.parentIndex === null
          ? null
          : (this.joints[joint.parentIndex]?.name ?? null);
      callback(joint.name, parentName);
    }
  }

  private getJoint(name: AvatarJointName): AvatarJointState {
    const index = this.nameToIndex.get(name);
    if (index === undefined) {
      throw new Error(`Unknown joint "${name}"`);
    }
    const joint = this.joints[index];
    if (!joint) {
      throw new Error(`Joint data missing for "${name}"`);
    }
    return joint;
  }

  private markJointDirty(name: AvatarJointName): void {
    const index = this.nameToIndex.get(name);
    if (index !== undefined) {
      this.jointDirty[index] = true;
      this.worldDirty = true;
      // Mark all descendants as dirty too (since world transforms depend on parents)
      this.markDescendantsDirty(index);
    }
  }

  private markDescendantsDirty(parentIndex: number): void {
    for (let i = 0; i < this.joints.length; i++) {
      const joint = this.joints[i];
      if (joint && joint.parentIndex === parentIndex) {
        this.jointDirty[i] = true;
        this.markDescendantsDirty(i); // Recursively mark children
      }
    }
  }

  private updateWorldTransforms(): void {
    if (!this.worldDirty) {
      return;
    }
    for (const joint of this.joints) {
      if (joint.parentIndex === null) {
        copyVec3(joint.worldPosition, joint.localPosition);
        copyQuat(joint.worldRotation, joint.localRotation);
      } else {
        const parent = this.joints[joint.parentIndex];
        if (!parent) {
          throw new Error(`Parent joint missing for "${joint.name}"`);
        }
        rotateVec3(TMP_ROTATED, joint.localPosition, parent.worldRotation);
        joint.worldPosition[0] = parent.worldPosition[0] + TMP_ROTATED[0];
        joint.worldPosition[1] = parent.worldPosition[1] + TMP_ROTATED[1];
        joint.worldPosition[2] = parent.worldPosition[2] + TMP_ROTATED[2];
        quatMultiplyOut(joint.worldRotation, parent.worldRotation, joint.localRotation);
        quatNormalizeOut(joint.worldRotation, joint.worldRotation);
      }
      mat4FromQuatTranslation(joint.worldMatrix, joint.worldRotation, joint.worldPosition);
    }
    this.worldDirty = false;
  }
}

function copyVec3(target: MutableVec3, source: Vec3): void {
  target[0] = source[0];
  target[1] = source[1];
  target[2] = source[2];
}

function copyQuat(target: MutableQuat, source: Quat): void {
  target[0] = source[0];
  target[1] = source[1];
  target[2] = source[2];
  target[3] = source[3];
}

function normalizeQuat(quat: Quat): Quat {
  const out: MutableQuat = [quat[0], quat[1], quat[2], quat[3]];
  return quatNormalizeOut(out, out);
}

function rotateVec3(out: MutableVec3, vec: Vec3, rotation: Quat): void {
  const x = vec[0];
  const y = vec[1];
  const z = vec[2];
  const qx = rotation[0];
  const qy = rotation[1];
  const qz = rotation[2];
  const qw = rotation[3];

  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;

  out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
  out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
  out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
}
