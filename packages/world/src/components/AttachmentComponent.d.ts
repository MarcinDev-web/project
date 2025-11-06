import { Component } from './Component.js';
import type { AttachmentDefinition, AttachmentType, StatModifiers } from '../types/weapon.js';
/**
 * Attachment component data
 */
export interface AttachmentComponentData {
    /** Initial attachments (by ID) */
    attachments?: string[];
}
/**
 * AttachmentComponent manages weapon attachments and stat modifications
 */
export declare class AttachmentComponent extends Component {
    static readonly type = "Attachment";
    /** Map of attachment type to attachment definitions */
    private attachments;
    /** Cached effective stat modifiers (recomputed when attachments change) */
    private cachedModifiers;
    private modifiersDirty;
    constructor(data?: AttachmentComponentData);
    getType(): string;
    /**
     * Add an attachment
     * @param attachment - Attachment definition
     * @returns true if added successfully, false if slot already occupied
     */
    addAttachment(attachment: AttachmentDefinition): boolean;
    /**
     * Remove an attachment by type
     * @param type - Attachment type to remove
     * @returns The removed attachment, or undefined if not found
     */
    removeAttachment(type: AttachmentType): AttachmentDefinition | undefined;
    /**
     * Get attachment by type
     * @param type - Attachment type
     * @returns Attachment definition or undefined
     */
    getAttachment(type: AttachmentType): AttachmentDefinition | undefined;
    /**
     * Get all attachments
     * @returns Array of attachment definitions
     */
    getAllAttachments(): AttachmentDefinition[];
    /**
     * Check if has attachment of specific type
     * @param type - Attachment type
     */
    hasAttachment(type: AttachmentType): boolean;
    /**
     * Get effective stat modifiers from all attachments
     * @returns Combined stat modifiers
     */
    getEffectiveStats(): StatModifiers;
    /**
     * Invalidate cached modifiers (call when attachments change externally)
     */
    invalidateCache(): void;
    clone(): AttachmentComponent;
    toJSON(): {
        attachments: Array<{
            type: AttachmentType;
            id: string;
        }>;
    };
    fromJSON(data: {
        attachments?: Array<{
            type: AttachmentType;
            id: string;
        }>;
    }): void;
}
//# sourceMappingURL=AttachmentComponent.d.ts.map