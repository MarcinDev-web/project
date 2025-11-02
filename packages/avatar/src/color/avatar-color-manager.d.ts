import { Entity } from '@engine/world';
import type { RgbaColor } from '@engine/world';
import type { AvatarPartDefinition } from '../slots';
interface AvatarPartSelectionState {
    id: string;
    definition: AvatarPartDefinition;
    colors?: Record<string, RgbaColor>;
    materialId?: string;
    appliedColors?: Record<string, RgbaColor>;
}
/**
 * Manages color application for avatar parts.
 * Handles color hierarchy: overrides > defaults > fallbacks.
 */
export declare class AvatarColorManager {
    /**
     * Apply color slots to an entity based on selection state.
     * Returns the applied colors for use by material manager.
     */
    applyColorSlots(entity: Entity, selection: AvatarPartSelectionState): Record<string, RgbaColor>;
}
export {};
//# sourceMappingURL=avatar-color-manager.d.ts.map