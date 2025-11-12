import { type Mat4, type Quat, type Vec3 } from '@engine/core/math';
export type AvatarJointName = 'Root' | 'Hips' | 'Spine' | 'Chest' | 'Neck' | 'Head' | 'Arm.L.Upper' | 'Arm.L.Lower' | 'Hand.L' | 'Arm.R.Upper' | 'Arm.R.Lower' | 'Hand.R' | 'Leg.L.Upper' | 'Leg.L.Lower' | 'Foot.L' | 'Leg.R.Upper' | 'Leg.R.Lower' | 'Foot.R';
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
export declare const DEFAULT_AVATAR_JOINTS: readonly AvatarJointDefinition[];
/**
 * Joint hierarchy with cached transforms.
 */
export declare class AvatarSkeleton {
    private readonly joints;
    private readonly nameToIndex;
    private readonly jointNames;
    private worldDirty;
    private readonly jointDirty;
    constructor(definitions?: readonly AvatarJointDefinition[]);
    resetPose(): void;
    /**
     * Mark all joints as dirty (for full sync).
     */
    markAllDirty(): void;
    /**
     * Check if a joint is dirty.
     */
    isJointDirty(name: AvatarJointName): boolean;
    /**
     * Mark a joint as clean (not dirty).
     */
    markJointClean(name: AvatarJointName): void;
    /**
     * Get all dirty joint names.
     */
    getDirtyJoints(): readonly AvatarJointName[];
    getJointNames(): readonly AvatarJointName[];
    getParent(name: AvatarJointName): AvatarJointName | null;
    /**
     * Get local transform (position and rotation) for a joint.
     *
     * Returns pooled Vec3/Quat that may be reused. If you need to keep the values
     * long-term, clone them immediately after calling this method.
     *
     * @param name - Joint name
     * @returns Transform with pooled Vec3/Quat (clone if keeping long-term)
     */
    getLocalTransform(name: AvatarJointName): AvatarJointTransform;
    setLocalPosition(name: AvatarJointName, position: Vec3): void;
    setLocalRotation(name: AvatarJointName, rotation: Quat): void;
    applyLocalPose(pose: Partial<Record<AvatarJointName, Partial<AvatarJointTransform>>>): void;
    /**
     * Get world transform (position and rotation) for a joint.
     *
     * Returns pooled Vec3/Quat that may be reused. If you need to keep the values
     * long-term, clone them immediately after calling this method.
     *
     * @param name - Joint name
     * @returns Transform with pooled Vec3/Quat (clone if keeping long-term)
     */
    getWorldTransform(name: AvatarJointName): AvatarJointTransform;
    getWorldMatrix(name: AvatarJointName, out?: Mat4): Mat4;
    forEachJoint(callback: (name: AvatarJointName, parent: AvatarJointName | null) => void): void;
    private getJoint;
    private markJointDirty;
    private markDescendantsDirty;
    private updateWorldTransforms;
}
//# sourceMappingURL=skeleton.d.ts.map