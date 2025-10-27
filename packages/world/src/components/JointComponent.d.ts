import { Component } from './Component';
import type { Joint } from '../physics/Joint';
/**
 * Component for managing joints attached to an entity
 */
export declare class JointComponent extends Component {
    /** All joints attached to this entity */
    joints: Joint[];
    /**
     * Get the type of this component
     */
    getType(): string;
    /**
     * Add a joint to this component
     */
    addJoint(joint: Joint): void;
    /**
     * Remove a joint by reference
     */
    removeJoint(joint: Joint): boolean;
    /**
     * Remove a joint by ID
     */
    removeJointById(id: string): boolean;
    /**
     * Get a joint by ID
     */
    getJointById(id: string): Joint | undefined;
    /**
     * Get all enabled joints
     */
    getEnabledJoints(): Joint[];
    /**
     * Remove all broken joints
     */
    removeBrokenJoints(): Joint[];
    /**
     * Clear all joints
     */
    clear(): void;
    /**
     * Get the number of joints
     */
    getJointCount(): number;
    /**
     * Clone this component
     */
    clone(): JointComponent;
    /**
     * Serialize the component
     */
    serialize(): any;
    /**
     * Deserialize the component
     * Note: This requires entities to be resolved separately
     */
    static deserialize(data: any): JointComponent;
}
//# sourceMappingURL=JointComponent.d.ts.map