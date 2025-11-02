import { Entity } from '@engine/world';
import type { RgbaColor } from '@engine/world';
import type { AvatarMaterialBinding, AvatarMaterialResolver } from '../avatar-instance';
import type { AvatarPartDefinition } from '../slots';
interface AvatarPartSelectionState {
    id: string;
    definition: AvatarPartDefinition;
    colors?: Record<string, RgbaColor>;
    materialId?: string;
    appliedColors?: Record<string, RgbaColor>;
}
/**
 * Manages material resolution and application for avatar parts.
 */
export declare class AvatarMaterialManager {
    private readonly materialResolver;
    constructor(materialResolver?: AvatarMaterialResolver);
    /**
     * Apply material to an entity based on selection state.
     */
    applyMaterial(entity: Entity, selection: AvatarPartSelectionState, appliedColors: Record<string, RgbaColor>): void;
    /**
     * Resolve material binding from material ID.
     */
    resolveBinding(materialId: string): AvatarMaterialBinding | null;
    private ensureMaterialComponent;
}
export {};
//# sourceMappingURL=avatar-material-manager.d.ts.map