import { Component } from './Component';
import { registerComponent } from './registry';
import type { AttachmentDefinition, AttachmentType, StatModifiers } from '../types/weapon';

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
export class AttachmentComponent extends Component {
  static readonly type = 'Attachment';

  /** Map of attachment type to attachment definitions */
  private attachments: Map<AttachmentType, AttachmentDefinition> = new Map();

  /** Cached effective stat modifiers (recomputed when attachments change) */
  private cachedModifiers: StatModifiers | null = null;
  private modifiersDirty: boolean = true;

  constructor(data?: AttachmentComponentData) {
    super();
    if (data?.attachments) {
      // Load attachments by ID (would require importing attachment data)
      // For now, attachments must be added manually via addAttachment()
    }
  }

  getType(): string {
    return AttachmentComponent.type;
  }

  /**
   * Add an attachment
   * @param attachment - Attachment definition
   * @returns true if added successfully, false if slot already occupied
   */
  addAttachment(attachment: AttachmentDefinition): boolean {
    // Check if slot is already occupied
    if (this.attachments.has(attachment.type)) {
      return false;
    }

    this.attachments.set(attachment.type, attachment);
    this.modifiersDirty = true;
    return true;
  }

  /**
   * Remove an attachment by type
   * @param type - Attachment type to remove
   * @returns The removed attachment, or undefined if not found
   */
  removeAttachment(type: AttachmentType): AttachmentDefinition | undefined {
    const attachment = this.attachments.get(type);
    if (attachment) {
      this.attachments.delete(type);
      this.modifiersDirty = true;
      return attachment;
    }
    return undefined;
  }

  /**
   * Get attachment by type
   * @param type - Attachment type
   * @returns Attachment definition or undefined
   */
  getAttachment(type: AttachmentType): AttachmentDefinition | undefined {
    return this.attachments.get(type);
  }

  /**
   * Get all attachments
   * @returns Array of attachment definitions
   */
  getAllAttachments(): AttachmentDefinition[] {
    return Array.from(this.attachments.values());
  }

  /**
   * Check if has attachment of specific type
   * @param type - Attachment type
   */
  hasAttachment(type: AttachmentType): boolean {
    return this.attachments.has(type);
  }

  /**
   * Get effective stat modifiers from all attachments
   * @returns Combined stat modifiers
   */
  getEffectiveStats(): StatModifiers {
    if (!this.modifiersDirty && this.cachedModifiers !== null) {
      return this.cachedModifiers;
    }

    // Combine all modifiers
    const combined: StatModifiers = {};

    for (const attachment of this.attachments.values()) {
      const mods = attachment.modifiers;

      // Multipliers: multiply together
      if (mods.damageMultiplier !== undefined) {
        combined.damageMultiplier = (combined.damageMultiplier ?? 1.0) * mods.damageMultiplier;
      }
      if (mods.fireRateMultiplier !== undefined) {
        combined.fireRateMultiplier = (combined.fireRateMultiplier ?? 1.0) * mods.fireRateMultiplier;
      }
      if (mods.rangeMultiplier !== undefined) {
        combined.rangeMultiplier = (combined.rangeMultiplier ?? 1.0) * mods.rangeMultiplier;
      }
      if (mods.spreadMultiplier !== undefined) {
        combined.spreadMultiplier = (combined.spreadMultiplier ?? 1.0) * mods.spreadMultiplier;
      }
      if (mods.maxAmmoMultiplier !== undefined) {
        combined.maxAmmoMultiplier = (combined.maxAmmoMultiplier ?? 1.0) * mods.maxAmmoMultiplier;
      }
      if (mods.reloadDurationMultiplier !== undefined) {
        combined.reloadDurationMultiplier = (combined.reloadDurationMultiplier ?? 1.0) * mods.reloadDurationMultiplier;
      }
      if (mods.projectileSpeedMultiplier !== undefined) {
        combined.projectileSpeedMultiplier = (combined.projectileSpeedMultiplier ?? 1.0) * mods.projectileSpeedMultiplier;
      }

      // Additives: sum together
      if (mods.damageAdditive !== undefined) {
        combined.damageAdditive = (combined.damageAdditive ?? 0) + mods.damageAdditive;
      }
      if (mods.rangeAdditive !== undefined) {
        combined.rangeAdditive = (combined.rangeAdditive ?? 0) + mods.rangeAdditive;
      }
      if (mods.maxAmmoAdditive !== undefined) {
        combined.maxAmmoAdditive = (combined.maxAmmoAdditive ?? 0) + mods.maxAmmoAdditive;
      }
    }

    // Ensure defaults for multipliers
    if (combined.damageMultiplier === undefined) combined.damageMultiplier = 1.0;
    if (combined.fireRateMultiplier === undefined) combined.fireRateMultiplier = 1.0;
    if (combined.rangeMultiplier === undefined) combined.rangeMultiplier = 1.0;
    if (combined.spreadMultiplier === undefined) combined.spreadMultiplier = 1.0;
    if (combined.maxAmmoMultiplier === undefined) combined.maxAmmoMultiplier = 1.0;
    if (combined.reloadDurationMultiplier === undefined) combined.reloadDurationMultiplier = 1.0;
    if (combined.projectileSpeedMultiplier === undefined) combined.projectileSpeedMultiplier = 1.0;

    this.cachedModifiers = combined;
    this.modifiersDirty = false;
    return combined;
  }

  /**
   * Invalidate cached modifiers (call when attachments change externally)
   */
  invalidateCache(): void {
    this.modifiersDirty = true;
    this.cachedModifiers = null;
  }

  clone(): AttachmentComponent {
    const copy = new AttachmentComponent();
    // Deep copy attachments map
    for (const [type, attachment] of this.attachments.entries()) {
      copy.attachments.set(type, attachment);
    }
    copy.modifiersDirty = true;
    return copy;
  }

  toJSON(): {
    attachments: Array<{ type: AttachmentType; id: string }>;
  } {
    const attachments = [];
    for (const [type, attachment] of this.attachments.entries()) {
      attachments.push({ type, id: attachment.id });
    }
    return { attachments };
  }

  fromJSON(data: {
    attachments?: Array<{ type: AttachmentType; id: string }>;
  }): void {
    this.attachments.clear();
    if (data.attachments) {
      // Note: This requires attachment definitions to be loaded elsewhere
      // For now, attachments must be added via addAttachment() after deserialization
      this.modifiersDirty = true;
    }
  }
}

registerComponent(AttachmentComponent.type, AttachmentComponent);
