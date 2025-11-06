import { Component } from './Component.js';
import type { Joint } from '../physics/Joint.js';

/**
 * Component for managing joints attached to an entity
 */
export class JointComponent extends Component {
  /** All joints attached to this entity */
  public joints: Joint[] = [];

  /**
   * Get the type of this component
   */
  getType(): string {
    return 'JointComponent';
  }

  /**
   * Add a joint to this component
   */
  addJoint(joint: Joint): void {
    if (!this.joints.includes(joint)) {
      this.joints.push(joint);
    }
  }

  /**
   * Remove a joint by reference
   */
  removeJoint(joint: Joint): boolean {
    const index = this.joints.indexOf(joint);
    if (index !== -1) {
      this.joints.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Remove a joint by ID
   */
  removeJointById(id: string): boolean {
    const index = this.joints.findIndex((j) => j.getId() === id);
    if (index !== -1) {
      this.joints.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get a joint by ID
   */
  getJointById(id: string): Joint | undefined {
    return this.joints.find((j) => j.getId() === id);
  }

  /**
   * Get all enabled joints
   */
  getEnabledJoints(): Joint[] {
    return this.joints.filter((j) => j.isEnabled());
  }

  /**
   * Remove all broken joints
   */
  removeBrokenJoints(): Joint[] {
    const broken = this.joints.filter((j) => j.isBroken());
    this.joints = this.joints.filter((j) => !j.isBroken());
    return broken;
  }

  /**
   * Clear all joints
   */
  clear(): void {
    this.joints = [];
  }

  /**
   * Get the number of joints
   */
  getJointCount(): number {
    return this.joints.length;
  }

  /**
   * Clone this component
   */
  clone(): JointComponent {
    const clone = new JointComponent();
    // Note: Joints reference entities, so we can't easily clone them
    // This would need special handling during entity cloning
    return clone;
  }

  /**
   * Serialize the component
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serialize(): any {
    return {
      type: this.getType(),
      joints: this.joints.map((joint) => ({
        id: joint.getId(),
        config: joint.config,
        state: joint.state,
      })),
    };
  }

  /**
   * Deserialize the component
   * Note: This requires entities to be resolved separately
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static deserialize(data: any): JointComponent {
    const component = new JointComponent();
    void data; // parameter intentionally unused for now
    // Joint deserialization would need entity reference resolution
    // This is a simplified version
    return component;
  }
}
