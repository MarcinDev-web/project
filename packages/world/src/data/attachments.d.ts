import type { AttachmentDefinition, AttachmentType } from '../types/weapon';
/**
 * Predefined attachment definitions for PvP gameplay
 * Balanced with trade-offs
 */
export declare const ATTACHMENTS: Record<string, AttachmentDefinition>;
/**
 * Get attachment definition by ID
 * @param id - Attachment ID
 * @returns Attachment definition or undefined
 */
export declare function getAttachment(id: string): AttachmentDefinition | undefined;
/**
 * Get all attachments of a specific type
 * @param type - Attachment type
 * @returns Array of attachment definitions
 */
export declare function getAttachmentsByType(type: AttachmentType): AttachmentDefinition[];
/**
 * Get all available attachments
 * @returns Array of all attachment definitions
 */
export declare function getAllAttachments(): AttachmentDefinition[];
//# sourceMappingURL=attachments.d.ts.map