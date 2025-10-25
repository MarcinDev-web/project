import { Component } from './Component';
/**
 * Component for managing joints attached to an entity
 */
export class JointComponent extends Component {
    /** All joints attached to this entity */
    joints = [];
    /**
     * Get the type of this component
     */
    getType() {
        return 'JointComponent';
    }
    /**
     * Add a joint to this component
     */
    addJoint(joint) {
        if (!this.joints.includes(joint)) {
            this.joints.push(joint);
        }
    }
    /**
     * Remove a joint by reference
     */
    removeJoint(joint) {
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
    removeJointById(id) {
        const index = this.joints.findIndex(j => j.getId() === id);
        if (index !== -1) {
            this.joints.splice(index, 1);
            return true;
        }
        return false;
    }
    /**
     * Get a joint by ID
     */
    getJointById(id) {
        return this.joints.find(j => j.getId() === id);
    }
    /**
     * Get all enabled joints
     */
    getEnabledJoints() {
        return this.joints.filter(j => j.isEnabled());
    }
    /**
     * Remove all broken joints
     */
    removeBrokenJoints() {
        const broken = this.joints.filter(j => j.isBroken());
        this.joints = this.joints.filter(j => !j.isBroken());
        return broken;
    }
    /**
     * Clear all joints
     */
    clear() {
        this.joints = [];
    }
    /**
     * Get the number of joints
     */
    getJointCount() {
        return this.joints.length;
    }
    /**
     * Clone this component
     */
    clone() {
        const clone = new JointComponent();
        // Note: Joints reference entities, so we can't easily clone them
        // This would need special handling during entity cloning
        return clone;
    }
    /**
     * Serialize the component
     */
    serialize() {
        return {
            type: this.getType(),
            joints: this.joints.map(joint => ({
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
    static deserialize(data) {
        const component = new JointComponent();
        void data; // parameter intentionally unused for now
        // Joint deserialization would need entity reference resolution
        // This is a simplified version
        return component;
    }
}
//# sourceMappingURL=JointComponent.js.map